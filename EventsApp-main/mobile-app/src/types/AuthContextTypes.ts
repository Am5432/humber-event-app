export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export interface CurrentUserResponse {
    id: number;
    email: string;
    display_name: string;
    role: "student" | "organizer" | "admin";
}

export interface AuthUser {
    id: number;
    displayName: string;
    email: string;
    role: "student" | "organizer" | "admin";
}

export interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    signUp: (displayName: string, email: string, password: string) => Promise<void>;
    signInWithPassword: (email: string, password: string) => Promise<void>;
    signInWithMicrosoft: (code: string, redirectUri: string, codeVerifier: string) => Promise<void>;
    updateDisplayName: (displayName: string) => Promise<void>;
    signOut: () => Promise<void>;
}

export interface RegisterRequest {
    email: string;
    password: string;
    display_name: string;
}

export interface PasswordLoginRequest {
    email: string;
    password: string;
}
