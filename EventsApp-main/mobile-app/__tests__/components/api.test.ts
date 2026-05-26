/**
 * Tests for src/lib/api.ts
 * Verifies axios instance is created and Bearer token interceptor is registered.
 */

process.env.EXPO_PUBLIC_API_URL = 'http://192.168.8.114:9000';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Inline mock — avoids hoisting issues with variables declared before jest.mock
jest.mock('axios', () => {
  const interceptorHandler: { fn?: (config: Record<string, unknown>) => Promise<Record<string, unknown>> } = {};
  const instance = {
    interceptors: {
      request: {
        use: jest.fn((fn: (config: Record<string, unknown>) => Promise<Record<string, unknown>>) => {
          interceptorHandler.fn = fn;
        }),
      },
      response: { use: jest.fn() },
    },
    _interceptorHandler: interceptorHandler,
  };
  return {
    __esModule: true,
    default: { create: jest.fn(() => instance) },
    create: jest.fn(() => instance),
    _testInstance: instance,
  };
});

import * as SecureStore from 'expo-secure-store';
import * as axiosMod from 'axios';
const { apiClient, resolveApiBaseUrl } = require('../../src/lib/api');

type AxiosMockModule = {
  default: { create: jest.Mock };
  _testInstance: {
    interceptors: { request: { use: jest.Mock } };
    _interceptorHandler: { fn?: (config: Record<string, unknown>) => Promise<Record<string, unknown>> };
  };
};

const axiosMock = axiosMod as unknown as AxiosMockModule;

describe('apiClient', () => {
  it('exports apiClient', () => {
    expect(apiClient).toBeDefined();
  });

  it('axios.create was called to build apiClient', () => {
    expect(axiosMock.default.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'http://192.168.8.114:9000' }),
    );
  });

  it('registers a request interceptor', () => {
    const instance = axiosMock._testInstance;
    expect(instance.interceptors.request.use).toHaveBeenCalled();
  });

  it('uses EXPO_PUBLIC_API_URL as the backend URL', () => {
    expect(resolveApiBaseUrl()).toBe('http://192.168.8.114:9000');
  });

  it('interceptor injects Bearer token when SecureStore has a token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('my-token');
    const instance = axiosMock._testInstance;
    const handler = instance._interceptorHandler.fn;
    expect(handler).toBeDefined();
    if (handler) {
      const config = { headers: {} as Record<string, string> };
      const result = await handler(config);
      expect((result as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer my-token');
    }
  });

  it('interceptor does not set Authorization when no token in SecureStore', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    const instance = axiosMock._testInstance;
    const handler = instance._interceptorHandler.fn;
    expect(handler).toBeDefined();
    if (handler) {
      const config = { headers: {} as Record<string, string> };
      const result = await handler(config);
      expect((result as { headers: Record<string, string> }).headers.Authorization).toBeUndefined();
    }
  });
});
