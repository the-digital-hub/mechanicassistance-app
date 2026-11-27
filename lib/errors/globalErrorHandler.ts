import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Share } from 'react-native';

export const LAST_FATAL_ERROR_KEY = 'last_fatal_js_error';

/**
 * TestFlight diagnosis: show the error (message + top of the stack) in an alert so a
 * tester can screenshot it. Turn off before the App Store release.
 */
const SHOW_ERROR_DETAILS = true;
let alertVisible = false;

/** React attaches the component tree (with names) to render errors it reports. */
function componentStackOf(err: Error): string {
    const stack = (err as Error & { componentStack?: unknown }).componentStack;
    return typeof stack === 'string' ? stack.trim() : '';
}

/** The error as text a tester can read on the screen: the message and the top of the component tree (or of the JS stack). */
export function errorSummary(error: unknown): string {
    const err = error instanceof Error ? error : new Error(String(error));
    const components = componentStackOf(err).split('\n').slice(0, 10).join('\n');
    const head = components || (err.stack ?? '').split('\n').slice(0, 8).join('\n');
    return `${err.message}\n\n${head}`.trim();
}

/** The full report (time, message, component tree and JS stack) to copy or send. */
export function errorReportText(error: unknown): string {
    const err = error instanceof Error ? error : new Error(String(error));
    return `${new Date().toISOString()}\n${err.message}\n\nComponents:\n${componentStackOf(err)}\n\n${err.stack ?? ''}`;
}

/** Opens the share sheet with the full report: it has "Copy", and also sends it straight to Notes, Mail or a chat. */
export function shareErrorReport(error: unknown): void {
    void Share.share({ message: errorReportText(error) }).catch(() => {});
}

function showErrorDetails(err: Error): void {
    if (!SHOW_ERROR_DETAILS || alertVisible) return;
    alertVisible = true;
    // The component tree names the screen; the JS stack of a render error is only React internals.
    const components = componentStackOf(err).split('\n').slice(0, 8).join('\n');
    const stackHead = components || (err.stack ?? '').split('\n').slice(0, 6).join('\n');
    const close = () => { alertVisible = false; };
    Alert.alert(
        'Error',
        `${err.message}\n\n${stackHead}`.slice(0, 1200),
        [
            {
                // The share sheet has "Copy", and also sends the full text straight to Notes, Mail or a chat.
                text: 'Copy / Share',
                onPress: () => {
                    close();
                    shareErrorReport(err);
                },
            },
            { text: 'OK', onPress: close },
        ],
        { onDismiss: close },
    );
}

export interface FatalErrorRecord {
    message: string;
    stack?: string;
    componentStack?: string;
    isFatal: boolean;
    at: string;
}

/** Keeps the latest JS error on the device so a crash can be diagnosed after the fact. */
export function recordFatalError(error: unknown, isFatal: boolean): void {
    const err = error instanceof Error ? error : new Error(String(error));
    const record: FatalErrorRecord = {
        message: err.message,
        stack: err.stack,
        componentStack: componentStackOf(err) || undefined,
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
