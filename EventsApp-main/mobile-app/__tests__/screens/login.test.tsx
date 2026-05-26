import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockSignIn = jest.fn();
const mockReplace = jest.fn();
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    signInWithPassword: mockSignIn,
    signInWithMicrosoft: jest.fn(),
    updateDisplayName: jest.fn(),
    signOut: jest.fn(),
    user: null,
    token: null,
    isLoading: false,
  }),
}));

jest.mock('expo-auth-session', () => ({
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
  makeRedirectUri: jest.fn(() => 'humber-event-hub://auth/callback'),
  ResponseType: { Code: 'code' },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-router', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => {
    const { Text, TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity testID={`link-${href}`}>
        <Text>{children}</Text>
      </TouchableOpacity>
    );
  },
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
}));

import LoginScreen from '../../app/(auth)/login';

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Email and Password inputs', () => {
    const { getByPlaceholderText } = render(<LoginScreen />);
    expect(getByPlaceholderText('humber email')).toBeTruthy();
    expect(getByPlaceholderText('password')).toBeTruthy();
  });

  it('renders a Login button', () => {
    const { getByText } = render(<LoginScreen />);
    expect(getByText('Login')).toBeTruthy();
  });

  it('Email input has correct props (keyboardType, autoCapitalize)', () => {
    const { getByPlaceholderText } = render(<LoginScreen />);
    const emailInput = getByPlaceholderText('humber email');
    expect(emailInput.props.keyboardType).toBe('email-address');
    expect(emailInput.props.autoCapitalize).toBe('none');
  });

  it('Password input uses secureTextEntry', () => {
    const { getByPlaceholderText } = render(<LoginScreen />);
    const passwordInput = getByPlaceholderText('password');
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it('shows inline error when fields are empty and Sign In pressed', async () => {
    const { getByText } = render(<LoginScreen />);
    fireEvent.press(getByText('Login'));
    await waitFor(() => {
      expect(getByText('Please enter both email and password.')).toBeTruthy();
    });
  });

  it('calls useAuth().signInWithPassword with email and password on valid submission', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('humber email'), 'test@humber.ca');
    fireEvent.changeText(getByPlaceholderText('password'), 'password123');
    fireEvent.press(getByText('Login'));
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@humber.ca', 'password123');
    });
  });

  it('shows inline error when signIn throws', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials'));
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('humber email'), 'bad@humber.ca');
    fireEvent.changeText(getByPlaceholderText('password'), 'wrongpass');
    fireEvent.press(getByText('Login'));
    await waitFor(() => {
      expect(getByText('Invalid credentials')).toBeTruthy();
    });
  });

  it('does NOT contain Forgot Password text', () => {
    const { queryByText } = render(<LoginScreen />);
    expect(queryByText(/forgot/i)).toBeNull();
  });

  it('has a link to signup screen', () => {
    const { getByText } = render(<LoginScreen />);
    expect(getByText('Sign Up')).toBeTruthy();
  });

  it('replaces to tabs after signInWithPassword succeeds', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('humber email'), 'test@humber.ca');
    fireEvent.changeText(getByPlaceholderText('password'), 'password123');
    fireEvent.press(getByText('Login'));
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled();
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
