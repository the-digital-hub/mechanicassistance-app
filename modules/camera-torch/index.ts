import { requireOptionalNativeModule } from 'expo-modules-core';

interface CameraTorchNative {
    isAvailable(): boolean;
    setTorch(on: boolean): Promise<boolean>;
}

// Optional: a build made before this module existed has no flashlight, and must not crash.
const native = requireOptionalNativeModule<CameraTorchNative>('CameraTorch');

/** The phone has a flashlight on its rear camera (and this build knows how to drive it). */
export function isTorchAvailable(): boolean {
    try {
        return !!native?.isAvailable();
    } catch {
        return false;
    }
}

/** Switches the rear-camera flashlight; resolves false when it could not (never throws). */
export async function setTorch(on: boolean): Promise<boolean> {
    try {
        return (await native?.setTorch(on)) ?? false;
    } catch {
        return false;
    }
}
