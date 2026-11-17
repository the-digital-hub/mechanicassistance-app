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

export interface AppAlertOptions {
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
