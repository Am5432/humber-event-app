jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  onIdTokenChanged: jest.fn((_auth, callback) => {
    callback(null);
    return jest.fn();
  }),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock('../../src/lib/firebase', () => ({
  firebaseAuth: { currentUser: null },
}));

jest.mock('../../src/lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  },
}));

import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { apiClient } from '../../src/lib/api';

type AuthValue = ReturnType<typeof useAuth>;

function createMockJwt(exp: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`;
}

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

describe('AuthProvider startup and signOut', () => {
  let authValue: AuthValue | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    authValue = undefined;
  });

  it('startup restores session when heh.token is valid (not expired)', async () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 600);

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'heh.token') return validToken;
      return null;
    });
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        id: 1,
        email: 'test@humber.ca',
        display_name: 'Test User',
        role: 'student',
      },
    });

    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.isLoading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
    expect(authValue?.token).toBe(validToken);
    expect(authValue?.user).toEqual({
      id: 1,
      displayName: 'Test User',
      email: 'test@humber.ca',
      role: 'student',
    });
  });

  it('startup calls /auth/refresh when heh.token is expired, stores new tokens', async () => {
    const expiredToken = createMockJwt(Math.floor(Date.now() / 1000) - 60);

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'heh.token') return expiredToken;
      if (key === 'heh.refresh') return 'old-refresh-token';
      return null;
    });
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: {
        access_token: 'new-at',
        refresh_token: 'new-rt',
        token_type: 'bearer',
      },
    });
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        id: 1,
        email: 'test@humber.ca',
        display_name: 'Test User',
        role: 'student',
      },
    });

    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.isLoading).toBe(false));

    expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh', {
      refresh_token: 'old-refresh-token',
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('heh.token', 'new-at');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('heh.refresh', 'new-rt');
    expect(authValue?.token).toBe('new-at');
    expect(authValue?.user?.email).toBe('test@humber.ca');
  });

  it('startup clears both keys when /auth/refresh fails', async () => {
    const expiredToken = createMockJwt(Math.floor(Date.now() / 1000) - 60);

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'heh.token') return expiredToken;
      if (key === 'heh.refresh') return 'old-refresh-token';
      return null;
    });
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('refresh failed'));

    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.isLoading).toBe(false));

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('heh.token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('heh.refresh');
    expect(authValue?.user).toBeNull();
    expect(authValue?.token).toBeNull();
  });

  it('startup leaves user=null when no token in SecureStore', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.isLoading).toBe(false));

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(authValue?.user).toBeNull();
    expect(authValue?.token).toBeNull();
  });

  it('signOut calls /auth/logout and clears both SecureStore keys', async () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 600);

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'heh.token') return validToken;
      if (key === 'heh.refresh') return 'refresh-token';
      return null;
    });
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        id: 1,
        email: 'test@humber.ca',
        display_name: 'Test User',
        role: 'student',
      },
    });
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: undefined,
    });

    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.user?.email).toBe('test@humber.ca'));

    await act(async () => {
      await authValue?.signOut();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', {
      refresh_token: 'refresh-token',
    });
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('heh.token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('heh.refresh');
    expect(authValue?.user).toBeNull();
    expect(authValue?.token).toBeNull();
  });

  it('updateDisplayName patches the current user profile without changing tokens', async () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 600);

    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'heh.token') return validToken;
      return null;
    });
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        id: 1,
        email: 'test@humber.ca',
        display_name: 'Test User',
        role: 'student',
      },
    });
    (apiClient.patch as jest.Mock).mockResolvedValue({
      data: {
        id: 1,
        email: 'test@humber.ca',
        display_name: 'Updated Name',
        role: 'student',
      },
    });

    renderWithAuth((value) => {
      authValue = value;
    });

    await waitFor(() => expect(authValue?.user?.email).toBe('test@humber.ca'));

    await act(async () => {
      await authValue?.updateDisplayName('Updated Name');
    });

    expect(apiClient.patch).toHaveBeenCalledWith('/users/me', {
      display_name: 'Updated Name',
    });
    expect(authValue?.user?.displayName).toBe('Updated Name');
    expect(authValue?.token).toBe(validToken);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
