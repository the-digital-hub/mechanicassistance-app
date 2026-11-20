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
