// utils/authUtils.ts
import { CurrentUserResponse, AuthUser } from "../types/AuthContextTypes";

export function decodeBase64Url(value: string): string {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4 || 4)) % 4)}`;
    return atob(padded);
}

export function isTokenExpired(token: string): boolean {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return true;

        const payload = JSON.parse(decodeBase64Url(parts[1]));
        if (typeof payload.exp !== "number") return true;

        // Adds a 30-second buffer before actual expiration
        return Date.now() / 1000 > payload.exp - 30;
    } catch {
        return true;
    }
}

export function mapUser(data: CurrentUserResponse): AuthUser {
    return {
        id: data.id,
        displayName: data.display_name,
        email: data.email,
        role: data.role,
    };
}