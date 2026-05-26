const mockPromptAsync = jest.fn();
const mockUseAuthRequest = jest.fn();
const mockMakeRedirectUri = jest.fn();
const mockUseRouter = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockUseURL = jest.fn();
const mockGetInitialURL = jest.fn();

jest.mock('expo-auth-session', () => ({
  useAuthRequest: (...args: unknown[]) => mockUseAuthRequest(...args),
  makeRedirectUri: (...args: unknown[]) => mockMakeRedirectUri(...args),
  ResponseType: { Code: 'code' },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => mockUseRouter(),
    useLocalSearchParams: () => mockUseLocalSearchParams(),
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('expo-linking', () => ({
  useURL: () => mockUseURL(),
  getInitialURL: () => mockGetInitialURL(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  },
}));

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { AuthContext, AuthProvider, useAuth } from '../../src/context/AuthContext';
import LoginScreen from '../../app/(auth)/login';
import SignUpScreen from '../../app/(auth)/signup';
import AuthCallbackScreen from '../../app/auth/callback';
import { apiClient } from '../../src/lib/api';

type AuthValue = ReturnType<typeof useAuth>;

function TestConsumer({ onValue }: { onValue: (value: AuthValue) => void }) {
  const auth = useAuth();

  React.useEffect(() => {
    onValue(auth);
  }, [auth, onValue]);

  return null;
}

function renderWithAuth(onValue: (value: AuthValue) => void) {
  return render(
    React.createElement(
      AuthProvider,
      null,
      React.createElement(TestConsumer, { onValue }),
    ),
  );
}

function renderLoginScreen(contextValue: React.ContextType<typeof AuthContext>) {
  return render(
    React.createElement(
      AuthContext.Provider,
      { value: contextValue },
      React.createElement(LoginScreen),
    ),
  );
}

function renderCallbackScreen(contextValue: React.ContextType<typeof AuthContext>) {
  return render(
    React.createElement(
      AuthContext.Provider,
      { value: contextValue },
      React.createElement(AuthCallbackScreen),
    ),
  );
}

describe('AuthProvider signInWithMicrosoft', () => {
  let authValue: AuthValue | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    authValue = undefined;
    mockUseAuthRequest.mockReturnValue([null, null, mockPromptAsync]);
    mockMakeRedirectUri.mockReturnValue('humber-event-hub://auth/callback');
    mockUseRouter.mockReturnValue({ replace: jest.fn() });
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        id: 1,
        email: 'user@humber.ca',
        display_name: 'Test User',
        role: 'student',
      },
    });
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: {
        access_token: 'at',
        refresh_token: 'rt',
        token_type: 'bearer',
      },
    });
  });

  it('signInWithMicrosoft stores access token and refresh token in SecureStore', async () => {
    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.isLoading).toBe(false));

    await act(async () => {
      await authValue?.signInWithMicrosoft(
        'test-code',
        'humber-event-hub://auth/callback',
        'v'.repeat(43),
      );
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/microsoft/callback', {
      code: 'test-code',
      redirect_uri: 'humber-event-hub://auth/callback',
      code_verifier: 'v'.repeat(43),
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('heh.token', 'at');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('heh.refresh', 'rt');
  });

  it('signInWithMicrosoft sets user state from /auth/me response', async () => {
    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.isLoading).toBe(false));

    await act(async () => {
      await authValue?.signInWithMicrosoft(
        'test-code',
        'humber-event-hub://auth/callback',
        'v'.repeat(43),
      );
    });

    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
    expect(authValue?.token).toBe('at');
    expect(authValue?.user).toEqual({
      id: 1,
      displayName: 'Test User',
      email: 'user@humber.ca',
      role: 'student',
    });
  });

  it('signInWithMicrosoft throws when backend returns 401', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('unauthorized'), {
        response: { status: 401 },
      }),
    );

    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.isLoading).toBe(false));

    await expect(
      authValue?.signInWithMicrosoft(
        'test-code',
        'humber-event-hub://auth/callback',
        'v'.repeat(43),
      ),
    ).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('Auth screens', () => {
  const authContextValue = {
    user: null,
    token: null,
    isLoading: false,
    signUp: jest.fn().mockResolvedValue(undefined),
    signInWithPassword: jest.fn().mockResolvedValue(undefined),
    signInWithMicrosoft: jest.fn().mockResolvedValue(undefined),
    updateDisplayName: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthRequest.mockReturnValue([
      { codeVerifier: 'v'.repeat(43) },
      null,
      mockPromptAsync,
    ]);
    mockMakeRedirectUri.mockReturnValue('humber-event-hub://auth/callback');
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseURL.mockReturnValue(null);
    mockGetInitialURL.mockResolvedValue(null);
  });

  it('login screen shows a fallback error when promptAsync rejects', async () => {
    mockPromptAsync.mockRejectedValueOnce(new Error('launch failed'));

    const view = renderLoginScreen(authContextValue);

    await act(async () => {
      fireEvent.press(view.getByText('Sign in with Microsoft'));
    });

    expect(view.getByText('Microsoft sign in failed. Please try again.')).toBeTruthy();
  });

  it('login screen clears stale errors when the auth session is canceled', async () => {
    mockUseAuthRequest.mockReturnValueOnce([
      { codeVerifier: 'v'.repeat(43) },
      { type: 'error' },
      mockPromptAsync,
    ]);

    const view = renderLoginScreen(authContextValue);

    await waitFor(() =>
      expect(view.getByText('Microsoft sign in failed. Please try again.')).toBeTruthy(),
    );

    mockUseAuthRequest.mockReturnValueOnce([
      { codeVerifier: 'v'.repeat(43) },
      { type: 'cancel' },
      mockPromptAsync,
    ]);

    view.rerender(
      React.createElement(
        AuthContext.Provider,
        { value: authContextValue },
        React.createElement(LoginScreen),
      ),
    );

    await waitFor(() =>
      expect(view.queryByText('Microsoft sign in failed. Please try again.')).toBeNull(),
    );
  });

  it('signup screen links back to the login route', async () => {
    const view = render(
      React.createElement(
        AuthContext.Provider,
        { value: authContextValue },
        React.createElement(SignUpScreen),
      ),
    );

    await waitFor(() => expect(view.getByText('Sign In')).toBeTruthy());
  });

  it('callback screen can recover the Microsoft code from the full callback URL', async () => {
    const replace = jest.fn();
    mockUseRouter.mockReturnValue({ replace });
    mockUseURL.mockReturnValue('humber-event-hub://auth/callback?code=test-code');
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('v'.repeat(43))
      .mockResolvedValueOnce('humber-event-hub://auth/callback');

    renderCallbackScreen(authContextValue);

    await waitFor(() =>
      expect(authContextValue.signInWithMicrosoft).toHaveBeenCalledWith(
        'test-code',
        'humber-event-hub://auth/callback',
        'v'.repeat(43),
      ),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/(tabs)'));
  });
});
