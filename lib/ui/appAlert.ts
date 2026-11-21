/**
 * The app's own alert, in place of the system `Alert.alert` (which uses the system's plain
 * typography). Same call: `appAlert(title, message?, buttons?, options?)`. `AppAlertHost`, mounted
 * once at the root, draws it with the app's dialog design; calls made while one is open are queued.
 */
export interface AppAlertButton {
    text?: string;
    onPress?: (value?: string) => void;
    style?: 'default' | 'cancel' | 'destructive';
}

/** The look of the icon on top: blue for information, green for good news, orange for a warning, red for a problem. */
export type AppAlertTone = 'info' | 'success' | 'warning' | 'danger';

/** A fact the dialog is about (a day and time, an amount): shown big in its own block instead of inside the sentence. */
export interface AppAlertHighlight {
    /** What it is, small and above ("Booked service"). */
    label: string;
    /** The fact itself, large ("Tuesday, November 24"). */
    value: string;
    /** A second line under it, also large ("10:30 AM"). */
    sub?: string;
    /** An Ionicons name for the tile. */
    icon?: string;
}

export interface AppAlertOptions {
    /** A fact to show big under the title. */
    highlight?: AppAlertHighlight;
    /** Colour of the icon tile (a destructive button already makes it red). */
    tone?: AppAlertTone;
    /** An Ionicons name to show instead of the default for the tone. */
    icon?: string;
    /** Android's tap-outside; here: the dialog also closes on tap outside when it has a cancel button or none. */
    cancelable?: boolean;
    onDismiss?: () => void;
}

export interface AppAlertRequest {
    id: number;
    title: string;
    message?: string;
    buttons: AppAlertButton[];
    options?: AppAlertOptions;
}

type Listener = (queue: AppAlertRequest[]) => void;

let counter = 0;
let queue: AppAlertRequest[] = [];
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l(queue));

export function appAlert(title: string, message?: string, buttons?: AppAlertButton[], options?: AppAlertOptions): void {
    counter += 1;
    queue = [...queue, { id: counter, title: String(title ?? ''), message: message ? String(message) : undefined, buttons: buttons?.length ? buttons : [{ text: undefined }], options }];
    emit();
}

/** Host side: the alert on screen is the first of the queue. */
export function subscribeAppAlerts(listener: Listener): () => void {
    listeners.add(listener);
    listener(queue);
    return () => {
        listeners.delete(listener);
    };
}

export function dismissAppAlert(id: number): void {
    queue = queue.filter((a) => a.id !== id);
    emit();
}
