import { requireOptionalNativeModule } from 'expo-modules-core';

interface ScreenRotationNative {
    force(landscape: boolean): Promise<boolean>;
}

// Optional: a build made before this module existed just keeps the orientation lock.
const native = requireOptionalNativeModule<ScreenRotationNative>('ScreenRotation');

/** Asks the system to turn the screen now (iOS: even when the phone is held sideways). Never throws. */
export async function forceOrientation(landscape: boolean): Promise<boolean> {
    try {
        return (await native?.force(landscape)) ?? false;
    } catch {
        return false;
    }
}
