import { requireOptionalNativeModule } from 'expo-modules-core';

interface AppBadgeNative {
    clear(): Promise<void>;
}

// Optional: a dev client built before this module existed simply has no badge
// to clear, and must not crash on start.
const native = requireOptionalNativeModule<AppBadgeNative>('AppBadge');

/**
 * Removes the number from the app icon. On iOS that is the badge the last
 * push set (`aps.badge`); on Android the launcher counts the notifications in
 * the tray, so the tray is emptied. Never throws.
 */
export async function clearAppBadge(): Promise<void> {
    try {
        await native?.clear();
    } catch (err) {
        console.warn('[badge] clear failed:', (err as Error).message);
    }
}
