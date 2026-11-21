import { requireOptionalNativeModule } from 'expo-modules-core';

interface VinTextNative {
    recognize(uri: string): Promise<string[]>;
}

// Optional: a build made before this module existed (or Android, which has no implementation yet) has no text reader.
// The scanner then keeps working with the barcode alone.
const native = requireOptionalNativeModule<VinTextNative>('VinText');

/** True when this build can read text from a photo. */
export const canReadText = native != null;

/** The lines of text in the photo, best guess first. Never throws: an empty list when nothing could be read. */
export async function recognizeText(uri: string): Promise<string[]> {
    try {
        return (await native?.recognize(uri)) ?? [];
    } catch (err) {
        console.warn('[vin-text] recognize failed:', (err as Error).message);
        return [];
    }
}

export interface BackCameraZoomInfo {
    /** The camera's name, for expo-camera's `selectedLens`. */
    lens: string;
    /** Its zoom limit (a factor, e.g. 15). */
    max: number;
    /** The zoom factor where the main lens takes over: the "1x" of the Camera app (2 on a triple camera). */
    wideAt: number;
}

interface NativeWithZoom {
    backCameraZoomInfo?: () => BackCameraZoomInfo | null;
}

/**
 * The back camera as the Camera app uses it (the virtual camera that switches lenses by itself), or null when this build or
 * this phone does not have one: the scanner then keeps the single main lens.
 */
export function backCameraZoomInfo(): BackCameraZoomInfo | null {
    try {
        return (native as unknown as NativeWithZoom | null)?.backCameraZoomInfo?.() ?? null;
    } catch {
        return null;
    }
}
