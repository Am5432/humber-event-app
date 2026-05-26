// lib/secureStore.ts
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const TOKEN_KEY = "heh.token";
export const REFRESH_KEY = "heh.refresh";

export async function getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
        localStorage.setItem(key, value);
        return;
    }
    await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
        localStorage.removeItem(key);
        return;
    }
    await SecureStore.deleteItemAsync(key);
}

export async function clearStoredAuth(): Promise<void> {
    await deleteItem(TOKEN_KEY);
    await deleteItem(REFRESH_KEY);
}