jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'exp://127.0.0.1:8081/--/'),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

type InterceptorPair = {
  onFulfilled?: (value: unknown) => unknown;
  onRejected?: (error: unknown) => unknown;
};

const requestHandlers: InterceptorPair[] = [];
const responseHandlers: InterceptorPair[] = [];
const mockApiClient: any = jest.fn();

jest.mock('axios', () => {
  const create = jest.fn(() => {
    mockApiClient.interceptors = {
      request: {
        use: jest.fn((onFulfilled: any, onRejected: any) => {
          requestHandlers.push({
            onFulfilled,
            onRejected,
          });
          return requestHandlers.length - 1;
        }),
      },
      response: {
        use: jest.fn((onFulfilled: any, onRejected: any) => {
          responseHandlers.push({
            onFulfilled,
            onRejected,
          });
          return responseHandlers.length - 1;
        }),
      },
    };
    mockApiClient.defaults = { headers: { common: {} } };
    mockApiClient.post = jest.fn();
    return mockApiClient;
  });

  return { __esModule: true, default: { create } };
});

function createAxiosError(
  status: number,
  config: Partial<InternalAxiosRequestConfig & { _retry?: boolean }> = {},
): AxiosError {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: `Request failed with status ${status}`,
    config: {
      headers: {} as any,
      ...config,
    } as InternalAxiosRequestConfig,
    toJSON: () => ({}),
    response: {
      status,
      statusText: 'Unauthorized',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      data: {},
    } as AxiosResponse,
  } as AxiosError;
}

describe('api.ts 401 response interceptor', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    requestHandlers.length = 0;
    responseHandlers.length = 0;
  });

  async function loadInterceptor() {
    process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:9000';
    require('../../src/lib/api');
    const pair = responseHandlers.at(-1);
    if (!pair?.onRejected) {
      throw new Error('Response interceptor was not registered');
    }
    return {
      onRejected: pair.onRejected as (error: AxiosError) => Promise<unknown>,
      secureStore: require('expo-secure-store') as typeof import('expo-secure-store'),
    };
  }

  it('401 interceptor retries the request after successful token refresh', async () => {
    const { onRejected, secureStore } = await loadInterceptor();
    const originalRequest = {
      url: '/events',
      headers: {} as any,
    } as InternalAxiosRequestConfig & { _retry?: boolean };

    (secureStore.getItemAsync as jest.Mock).mockResolvedValue('refresh-token');
    (mockApiClient.post as jest.Mock).mockResolvedValue({
      data: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'bearer',
      },
    });
    mockApiClient.mockResolvedValue({
      data: [{ id: 1 }],
    });

    const response = await onRejected(createAxiosError(401, originalRequest));

    expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh', {
      refresh_token: 'refresh-token',
    });
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('heh.token', 'new-access-token');
    expect(secureStore.setItemAsync).toHaveBeenCalledWith('heh.refresh', 'new-refresh-token');
    expect(response).toEqual({ data: [{ id: 1 }] });
  });

  it('401 interceptor clears SecureStore and rejects when refresh returns 401', async () => {
    const { onRejected, secureStore } = await loadInterceptor();

    (secureStore.getItemAsync as jest.Mock).mockResolvedValue('refresh-token');
    (mockApiClient.post as jest.Mock).mockRejectedValue(createAxiosError(401, {
      url: '/auth/refresh',
      headers: {} as any,
      _retry: true,
    }));

    await expect(
      onRejected(
        createAxiosError(401, {
          url: '/events',
          headers: {} as any,
        }),
      ),
    ).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('heh.token');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('heh.refresh');
  });

  it('401 interceptor does not retry if _retry is already true', async () => {
    const { onRejected } = await loadInterceptor();
    const error = createAxiosError(401, {
      url: '/events',
      headers: {} as any,
      _retry: true,
    });

    await expect(onRejected(error)).rejects.toBe(error);
    expect(mockApiClient.post).not.toHaveBeenCalled();
  });
});
