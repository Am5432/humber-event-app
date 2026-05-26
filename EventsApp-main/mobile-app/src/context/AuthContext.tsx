import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { apiClient } from "../lib/api";
import {
    AuthContextValue,
    AuthUser,
    CurrentUserResponse,
    PasswordLoginRequest,
    RegisterRequest,
    TokenResponse,
} from "../types/AuthContextTypes";

import { fireAndForgetAuthDebugLog } from "../lib/authDebugLog";
import { updateCurrentUserProfile } from "../lib/events";
import { getItem, setItem, clearStoredAuth, TOKEN_KEY, REFRESH_KEY, deleteItem } from "../lib/secureStore";
import { isTokenExpired, mapUser } from "../utils/authUtils";

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const persistTokensAndLoadUser = useCallback(async (tokens: TokenResponse): Promise<void> => {
        await setItem(TOKEN_KEY, tokens.access_token);
        await setItem(REFRESH_KEY, tokens.refresh_token);

        const { data } = await apiClient.get<CurrentUserResponse>("/auth/me");
        setToken(tokens.access_token);
        setUser(mapUser(data));
    }, []);

    useEffect(() => {
        let isMounted = true;

        const restoreSession = async () => {
            try {
                fireAndForgetAuthDebugLog("auth", "restore.start");
                const storedToken = await getItem(TOKEN_KEY);

                if (!storedToken) {
                    await deleteItem(REFRESH_KEY);
                    fireAndForgetAuthDebugLog("auth", "restore.no_stored_token");
                    if (isMounted) {
                        setUser(null);
                        setToken(null);
                    }
                    return;
                }

                if (!isTokenExpired(storedToken)) {
                    const { data } = await apiClient.get<CurrentUserResponse>("/auth/me");
                    fireAndForgetAuthDebugLog("auth", "restore.active_token_success", {
                        email: data.email,
                        role: data.role,
                    });
                    if (isMounted) {
                        setToken(storedToken);
                        setUser(mapUser(data));
                    }
                    return;
                }

                const refreshToken = await getItem(REFRESH_KEY);
                if (!refreshToken) {
                    await clearStoredAuth();
                    fireAndForgetAuthDebugLog("auth", "restore.refresh_missing");
                    if (isMounted) {
                        setUser(null);
                        setToken(null);
                    }
                    return;
                }

                fireAndForgetAuthDebugLog("auth", "restore.refresh_start");
                const { data: refreshed } = await apiClient.post<TokenResponse>("/auth/refresh", {
                    refresh_token: refreshToken,
                });
                await setItem(TOKEN_KEY, refreshed.access_token);
                await setItem(REFRESH_KEY, refreshed.refresh_token);

                const { data } = await apiClient.get<CurrentUserResponse>("/auth/me");
                fireAndForgetAuthDebugLog("auth", "restore.refresh_success", {
                    email: data.email,
                    role: data.role,
                });
                if (isMounted) {
                    setToken(refreshed.access_token);
                    setUser(mapUser(data));
                }
            } catch (error) {
                fireAndForgetAuthDebugLog("auth", "restore.failed", { error });
                await clearStoredAuth();
                if (isMounted) {
                    setUser(null);
                    setToken(null);
                }
            } finally {
                fireAndForgetAuthDebugLog("auth", "restore.complete");
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void restoreSession();

        return () => {
            isMounted = false;
        };
    }, []);

    const signInWithPassword = useCallback(async (email: string, password: string): Promise<void> => {
        fireAndForgetAuthDebugLog("auth", "password_sign_in.start", {
            email,
        });
        try {
            const { data: tokens } = await apiClient.post<TokenResponse>("/auth/login", {
                email,
                password,
            } as PasswordLoginRequest);

            await persistTokensAndLoadUser(tokens);
            fireAndForgetAuthDebugLog("auth", "password_sign_in.success", {
                email,
            });
        } catch (error) {
            fireAndForgetAuthDebugLog("auth", "password_sign_in.failed", {
                email,
                error,
            });
            throw error;
        }
    }, [persistTokensAndLoadUser]);

    const signUp = useCallback(
        async (displayName: string, email: string, password: string): Promise<void> => {
            const trimmedDisplayName = displayName.trim();
            const trimmedEmail = email.trim();
            fireAndForgetAuthDebugLog("auth", "register.start", {
                email: trimmedEmail,
                display_name_length: trimmedDisplayName.length,
            });

            try {
                const { data: tokens } = await apiClient.post<TokenResponse>("/auth/register", {
                    email: trimmedEmail,
                    password,
                    display_name: trimmedDisplayName,
                } as RegisterRequest);

                await persistTokensAndLoadUser(tokens);
                fireAndForgetAuthDebugLog("auth", "register.success", {
                    email: trimmedEmail,
                });
            } catch (error) {
                fireAndForgetAuthDebugLog("auth", "register.failed", {
                    email: trimmedEmail,
                    error,
                });
                throw error;
            }
        },
        [persistTokensAndLoadUser],
    );

    const signInWithMicrosoft = useCallback(
        async (code: string, redirectUri: string, codeVerifier: string): Promise<void> => {
            fireAndForgetAuthDebugLog("auth", "microsoft_sign_in.start", {
                redirect_uri: redirectUri,
                has_code: Boolean(code),
                verifier_length: codeVerifier.length,
            });
            try {
                const { data: tokens } = await apiClient.post<TokenResponse>("/auth/microsoft/callback", {
                    code,
                    redirect_uri: redirectUri,
                    code_verifier: codeVerifier,
                });

                await setItem(TOKEN_KEY, tokens.access_token);
                await setItem(REFRESH_KEY, tokens.refresh_token);
                fireAndForgetAuthDebugLog("auth", "microsoft_sign_in.tokens_persisted");

                const { data } = await apiClient.get<CurrentUserResponse>("/auth/me");
                setToken(tokens.access_token);
                setUser(mapUser(data));
                fireAndForgetAuthDebugLog("auth", "microsoft_sign_in.success", {
                    email: data.email,
                    role: data.role,
                });
            } catch (error) {
                fireAndForgetAuthDebugLog("auth", "microsoft_sign_in.failed", {
                    redirect_uri: redirectUri,
                    error,
                });
                throw error;
            }
        },
        [],
    );

    const updateDisplayName = useCallback(async (displayName: string): Promise<void> => {
        const trimmedDisplayName = displayName.trim();
        fireAndForgetAuthDebugLog("auth", "display_name_update.start", {
            display_name_length: trimmedDisplayName.length,
        });

        try {
            const data = await updateCurrentUserProfile(trimmedDisplayName);
            setUser(mapUser(data));
            fireAndForgetAuthDebugLog("auth", "display_name_update.success", {
                email: data.email,
                display_name: data.display_name,
            });
        } catch (error) {
            fireAndForgetAuthDebugLog("auth", "display_name_update.failed", {
                error,
            });
            throw error;
        }
    }, []);

    const signOut = useCallback(async (): Promise<void> => {
        const refreshToken = await getItem(REFRESH_KEY);
        fireAndForgetAuthDebugLog("auth", "sign_out.start", {
            has_refresh_token: Boolean(refreshToken),
        });

        if (refreshToken) {
            try {
                await apiClient.post("/auth/logout", { refresh_token: refreshToken });
            } catch (error) {
                fireAndForgetAuthDebugLog("auth", "sign_out.revoke_failed", {
                    error,
                });
            }
        }

        await clearStoredAuth();
        setUser(null);
        setToken(null);
        fireAndForgetAuthDebugLog("auth", "sign_out.complete");

        if (Platform.OS === "web") {
            window.location.href = "/login";
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                signUp,
                signInWithPassword,
                signInWithMicrosoft,
                updateDisplayName,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }

    return ctx;
}
