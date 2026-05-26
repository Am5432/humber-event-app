import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const APP_LOG_STORAGE_KEY = "heh.app.debug.events";
const MAX_APP_LOG_EVENTS = 300;

type Serializable =
    | string
    | number
    | boolean
    | null
    | Serializable[]
    | { [key: string]: Serializable };

type LogDetails = Record<string, unknown> | undefined;
type LogLevel = "debug" | "info" | "warn" | "error";

type LoggerOptions = {
    prefix?: string;
};

export interface AppLogEntry {
    timestamp: string;
    level: LogLevel;
    prefix: string;
    source: string;
    event: string;
    details: Record<string, Serializable>;
}

function isSensitiveKey(key: string): boolean {
    return /token|secret|password|verifier|authorization|(^code$)/i.test(key);
}

function sanitizeValue(value: unknown, key = "", depth = 0): Serializable {
    if (isSensitiveKey(key)) {
        return "[redacted]";
    }

    if (value === null) {
        return null;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }

    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack ?? null,
        };
    }

    if (Array.isArray(value)) {
        if (depth >= 3) {
            return `[array:${value.length}]`;
        }

        return value.map((item) => sanitizeValue(item, key, depth + 1));
    }

    if (typeof value === "object") {
        if (depth >= 3) {
            return "[object]";
        }

        return Object.entries(value as Record<string, unknown>).reduce<Record<string, Serializable>>(
            (acc, [nestedKey, nestedValue]) => {
                acc[nestedKey] = sanitizeValue(nestedValue, nestedKey, depth + 1);
                return acc;
            },
            {},
        );
    }

    return String(value);
}

function sanitizeDetails(details: LogDetails): Record<string, Serializable> {
    if (!details) {
        return {};
    }

    return Object.entries(details).reduce<Record<string, Serializable>>((acc, [key, value]) => {
        acc[key] = sanitizeValue(value, key);
        return acc;
    }, {});
}

async function readStorageValue(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
        return localStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key);
}

async function writeStorageValue(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
        localStorage.setItem(key, value);
        return;
    }

    if (typeof SecureStore.setItemAsync !== "function") {
        return;
    }

    await SecureStore.setItemAsync(key, value);
}

function shouldSkipLogging(): boolean {
    return process.env.NODE_ENV === "test";
}

function shouldPrintToConsole(): boolean {
    return process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";
}

function consoleMethodForLevel(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
        case "info":
            return console.info;
        case "warn":
            return console.warn;
        case "error":
            return console.error;
        default:
            return console.log;
    }
}

export class AppLogger {
    static debug(source: string, event: string, details?: LogDetails, options?: LoggerOptions): void {
        void this.append("debug", source, event, details, options);
    }

    static info(source: string, event: string, details?: LogDetails, options?: LoggerOptions): void {
        void this.append("info", source, event, details, options);
    }

    static warn(source: string, event: string, details?: LogDetails, options?: LoggerOptions): void {
        void this.append("warn", source, event, details, options);
    }

    static error(source: string, event: string, details?: LogDetails, options?: LoggerOptions): void {
        void this.append("error", source, event, details, options);
    }

    static async readEntries(): Promise<AppLogEntry[]> {
        const raw = await readStorageValue(APP_LOG_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as AppLogEntry[]) : [];
        } catch {
            return [];
        }
    }

    static async readByPrefix(prefix: string): Promise<AppLogEntry[]> {
        const entries = await this.readEntries();
        return entries.filter((entry) => entry.prefix === prefix);
    }

    private static async append(
        level: LogLevel,
        source: string,
        event: string,
        details?: LogDetails,
        options?: LoggerOptions,
    ): Promise<void> {
        if (shouldSkipLogging()) {
            return;
        }

        const prefix = options?.prefix ?? "app-debug";
        const entry: AppLogEntry = {
            timestamp: new Date().toISOString(),
            level,
            prefix,
            source,
            event,
            details: sanitizeDetails(details),
        };

        if (shouldPrintToConsole()) {
            consoleMethodForLevel(level)(`[${prefix}] ${source}.${event}`, entry.details);
        }

        try {
            const nextEntries = [...(await this.readEntries()), entry].slice(-MAX_APP_LOG_EVENTS);
            await writeStorageValue(APP_LOG_STORAGE_KEY, JSON.stringify(nextEntries));
        } catch (error) {
            console.warn(`[${prefix}] Failed to persist app log`, error);
        }
    }
}
