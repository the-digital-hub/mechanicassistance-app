import AsyncStorage from '@react-native-async-storage/async-storage';

export const LAST_FATAL_ERROR_KEY = 'last_fatal_js_error';

export interface FatalErrorRecord {
    message: string;
    stack?: string;
    isFatal: boolean;
    at: string;
}

/** Keeps the latest JS error on the device so a crash can be diagnosed after the fact. */
export function recordFatalError(error: unknown, isFatal: boolean): void {
    const err = error instanceof Error ? error : new Error(String(error));
    const record: FatalErrorRecord = {
        message: err.message,
        stack: err.stack,
        isFatal,
        at: new Date().toISOString(),
    };
    console.error('[GlobalError]', record.message, record.stack);
    AsyncStorage.setItem(LAST_FATAL_ERROR_KEY, JSON.stringify(record)).catch(() => {});
}

/** The error recorded by the previous run, if any. */
export async function readLastFatalError(): Promise<FatalErrorRecord | null> {
    try {
        const raw = await AsyncStorage.getItem(LAST_FATAL_ERROR_KEY);
        return raw ? (JSON.parse(raw) as FatalErrorRecord) : null;
    } catch {
        return null;
    }
}

let installed = false;

/**
 * Release builds only: record uncaught JS errors and keep the app alive instead of
 * letting React Native abort the process (RCTFatal). Render errors are caught by the
 * root ErrorBoundary; this covers errors thrown from timers, promise jobs and events.
 * In development the default handler is kept so the red box shows the real error.
 */
export function installGlobalErrorHandler(): void {
    if (installed || __DEV__) return;
    const errorUtils = (globalThis as { ErrorUtils?: {
        setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
    } }).ErrorUtils;
    if (!errorUtils) return;
    installed = true;
    errorUtils.setGlobalHandler((error, isFatal) => {
        recordFatalError(error, Boolean(isFatal));
    });
}
