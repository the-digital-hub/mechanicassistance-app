import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const LAST_FATAL_ERROR_KEY = 'last_fatal_js_error';

/**
 * TestFlight diagnosis: show the error (message + top of the stack) in an alert so a
 * tester can screenshot it. Turn off before the App Store release.
 */
const SHOW_ERROR_DETAILS = true;
let alertVisible = false;

function showErrorDetails(err: Error): void {
    if (!SHOW_ERROR_DETAILS || alertVisible) return;
    alertVisible = true;
    const stackHead = (err.stack ?? '').split('\n').slice(0, 6).join('\n');
    Alert.alert(
        'Error',
        `${err.message}\n\n${stackHead}`.slice(0, 1200),
        [{ text: 'OK', onPress: () => { alertVisible = false; } }],
        { onDismiss: () => { alertVisible = false; } },
    );
}

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
    showErrorDetails(err);
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
