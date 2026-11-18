import type * as ScreenOrientation from 'expo-screen-orientation';

import { forceOrientation } from '@/modules/screen-rotation';

// The app is portrait-only; the VIN scanner can be turned sideways on request (a button), since a wide
// barcode is easier to frame with the phone on its side. It always goes back upright afterwards.
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
    // The lock only says what is allowed; with the phone held sideways iOS also has to be asked to turn.
    module
        ?.lockAsync(module.OrientationLock.PORTRAIT_UP)
        .then(() => forceOrientation(false))
        .catch(() => undefined);
}

/** Turn the screen sideways (either landscape, whichever way the phone is held). */
export function lockLandscape(): void {
    module
        ?.lockAsync(module.OrientationLock.LANDSCAPE)
        .then(() => forceOrientation(true))
        .catch(() => undefined);
}
