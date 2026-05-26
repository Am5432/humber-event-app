import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { fireAndForgetAuthDebugLog } from "./authDebugLog";

const TOKEN_KEY = "heh.token";
const REFRESH_KEY = "heh.refresh";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
};

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

export function resolveApiBaseUrl(): string {
  const explicitBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  if (explicitBaseUrl) {
    fireAndForgetAuthDebugLog("api", "base_url.explicit", {
      base_url: explicitBaseUrl,
    });
    return explicitBaseUrl;
  }

  const error = new Error(
    "[api] Missing EXPO_PUBLIC_API_URL. Set the backend URL explicitly in the mobile env so auth targets are fully env-controlled.",
  );
  fireAndForgetAuthDebugLog("api", "base_url.missing_env", {
    error: error.message,
  });
  throw error;
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export function stripJsonContentTypeForFormData(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  if (
    typeof FormData !== "undefined" &&
    config.data instanceof FormData &&
    config.headers
  ) {
    const headers = config.headers as Record<string, unknown> & {
      delete?: (headerName: string) => void;
    };
    if (typeof headers.delete === "function") {
      headers.delete("Content-Type");
      headers.delete("content-type");
    } else {
      delete headers["Content-Type"];
      delete headers["content-type"];
    }
  }
  return config;
}

function shouldLogAuthRequest(url?: string): boolean {
  return Boolean(url?.includes("/auth/"));
}

apiClient.interceptors.request.use(async (config) => {
  stripJsonContentTypeForFormData(config);
  try {
    const token = await getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    fireAndForgetAuthDebugLog("api", "request.token_read_failed", {
      url: config.url,
      error,
    });
  }

  if (shouldLogAuthRequest(config.url)) {
    fireAndForgetAuthDebugLog("api", "request.start", {
      method: config.method?.toUpperCase(),
      url: config.url,
      base_url: config.baseURL ?? apiClient.defaults.baseURL,
      has_authorization_header: Boolean(config.headers.Authorization),
      retry: Boolean((config as RetryableRequestConfig)._retry),
    });
  }

  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }

    if (token) {
      resolve(token);
      return;
    }

    reject(new Error("Token refresh did not return a new access token."));
  });

  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => {
    if (shouldLogAuthRequest(response.config.url)) {
      fireAndForgetAuthDebugLog("api", "response.success", {
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        status: response.status,
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (shouldLogAuthRequest(originalRequest?.url)) {
      fireAndForgetAuthDebugLog("api", "response.error", {
        method: originalRequest?.method?.toUpperCase(),
        url: originalRequest?.url,
        status: error.response?.status ?? null,
        detail: error.message,
      });
    }

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes("/auth/refresh") || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (nextToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${nextToken}`;
            }
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getItem(REFRESH_KEY);
      if (!refreshToken) {
        fireAndForgetAuthDebugLog("api", "refresh.skipped_missing_token", {
          url: originalRequest.url,
        });
        throw error;
      }

      fireAndForgetAuthDebugLog("api", "refresh.start", {
        url: originalRequest.url,
      });

      const { data } = await apiClient.post<TokenResponse>("/auth/refresh", {
        refresh_token: refreshToken,
      });

      await setItem(TOKEN_KEY, data.access_token);
      await setItem(REFRESH_KEY, data.refresh_token);

      apiClient.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      }

      processQueue(null, data.access_token);

      fireAndForgetAuthDebugLog("api", "refresh.success", {
        url: originalRequest.url,
      });

      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await deleteItem(TOKEN_KEY);
      await deleteItem(REFRESH_KEY);
      delete apiClient.defaults.headers.common.Authorization;
      fireAndForgetAuthDebugLog("api", "refresh.failed", {
        url: originalRequest.url,
        error: refreshError,
      });
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
