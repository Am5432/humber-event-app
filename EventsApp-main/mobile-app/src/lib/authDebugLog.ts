import { AppLogEntry, AppLogger } from "./appLogger";

type AuthDebugDetails = Record<string, unknown> | undefined;

const AUTH_DEBUG_PREFIX = "auth-debug";

export async function appendAuthDebugLog(
    source: string,
    event: string,
    details?: AuthDebugDetails,
): Promise<void> {
    AppLogger.debug(source, event, details, { prefix: AUTH_DEBUG_PREFIX });
}

export function fireAndForgetAuthDebugLog(
    source: string,
    event: string,
    details?: AuthDebugDetails,
): void {
    AppLogger.debug(source, event, details, { prefix: AUTH_DEBUG_PREFIX });
}

export async function readAuthDebugLog(): Promise<AppLogEntry[]> {
    return AppLogger.readByPrefix(AUTH_DEBUG_PREFIX);
}
