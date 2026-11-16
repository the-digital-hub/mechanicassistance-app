import type * as ScreenOrientation from 'expo-screen-orientation';

// The app is portrait-only; the VIN scanner is the one place that follows how the phone is held
// (people often scan a wide barcode with the phone on its side).
//
// Loaded defensively: a build made before expo-screen-orientation was added (an old dev client) has no
// native module, and importing it would take the whole app down. Without it these calls do nothing.
let module: typeof ScreenOrientation | null = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('expo-screen-orientation');
} catch {
    module = null;
}

/** Keep the app upright. Called once at start-up, and again when a screen that rotated is left. */
export function lockPortrait(): void {
    module?.lockAsync(module.OrientationLock.PORTRAIT_UP).catch(() => undefined);
}

/** Let the screen follow the phone: portrait or either landscape. */
export function unlockRotation(): void {
    module?.unlockAsync().catch(() => undefined);
}
