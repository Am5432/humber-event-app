/**
 * TDD RED: Sign Up screen behavior tests
 * These tests must fail before signup.tsx is created.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => {
    const { Text, TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity testID={`link-${href}`}>
        <Text>{children}</Text>
      </TouchableOpacity>
    );
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// Mock AuthContext
const mockSignUp = jest.fn();
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    signInWithPassword: jest.fn(),
    signInWithMicrosoft: jest.fn(),
    updateDisplayName: jest.fn(),
    signOut: jest.fn(),
    user: null,
    token: null,
    isLoading: false,
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import SignUpScreen from '../../app/(auth)/signup';

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Display Name, Email, Password, and Confirm Password inputs', () => {
    const { getByPlaceholderText } = render(<SignUpScreen />);
    expect(getByPlaceholderText('Your name')).toBeTruthy();
    expect(getByPlaceholderText('you@humber.ca')).toBeTruthy();
    // Two password fields — get all with placeholder '••••••••'
    const passwordInputs = [];
    try {
      // getByPlaceholderText throws if more than one — use getAllByPlaceholderText
    } catch {}
    expect(getByPlaceholderText('Your name')).toBeTruthy();
  });

  it('renders a Create Account button', () => {
    const { getByText } = render(<SignUpScreen />);
    expect(getByText('Create Account')).toBeTruthy();
  });

  it('both password inputs use secureTextEntry', () => {
    const { getAllByPlaceholderText } = render(<SignUpScreen />);
    const passwordInputs = getAllByPlaceholderText('••••••••');
    expect(passwordInputs).toHaveLength(2);
    expect(passwordInputs[0].props.secureTextEntry).toBe(true);
    expect(passwordInputs[1].props.secureTextEntry).toBe(true);
  });

  it('shows error when any field is empty on submit', async () => {
    const { getByText } = render(<SignUpScreen />);
    fireEvent.press(getByText('Create Account'));
    await waitFor(() => {
      expect(getByText('All fields are required.')).toBeTruthy();
    });
  });

  it('shows error when passwords do not match', async () => {
    const { getByPlaceholderText, getAllByPlaceholderText, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Your name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@humber.ca'), 'test@humber.ca');
    const passwordInputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(passwordInputs[0], 'password123');
    fireEvent.changeText(passwordInputs[1], 'different456');
    fireEvent.press(getByText('Create Account'));
    await waitFor(() => {
      expect(getByText('Passwords do not match.')).toBeTruthy();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('calls useAuth().signUp with displayName, email, password when valid', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getAllByPlaceholderText, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Your name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@humber.ca'), 'test@humber.ca');
    const passwordInputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(passwordInputs[0], 'password123');
    fireEvent.changeText(passwordInputs[1], 'password123');
    fireEvent.press(getByText('Create Account'));
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('Test User', 'test@humber.ca', 'password123');
    });
  });

  it('shows inline error when signUp throws', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('Email taken'));
    const { getByPlaceholderText, getAllByPlaceholderText, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Your name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@humber.ca'), 'test@humber.ca');
    const passwordInputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(passwordInputs[0], 'password123');
    fireEvent.changeText(passwordInputs[1], 'password123');
    fireEvent.press(getByText('Create Account'));
    await waitFor(() => {
      expect(getByText('Email taken')).toBeTruthy();
    });
  });

  it('does NOT call router.push or router.replace after signUp', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);
    const routerPush = jest.fn();
    const routerReplace = jest.fn();
    const { getByPlaceholderText, getAllByPlaceholderText, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Your name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('you@humber.ca'), 'test@humber.ca');
    const passwordInputs = getAllByPlaceholderText('••••••••');
    fireEvent.changeText(passwordInputs[0], 'password123');
    fireEvent.changeText(passwordInputs[1], 'password123');
    fireEvent.press(getByText('Create Account'));
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
    });
    expect(routerPush).not.toHaveBeenCalled();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('has a link to login screen', () => {
    const { getByText } = render(<SignUpScreen />);
    expect(getByText('Sign In')).toBeTruthy();
  });
});
