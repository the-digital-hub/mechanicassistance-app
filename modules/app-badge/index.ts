import { requireOptionalNativeModule } from 'expo-modules-core';

interface AppBadgeNative {
    clear(): Promise<void>;
    /** Android only. */
    requestPostNotificationsAsync?(): Promise<{ granted: boolean }>;
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

/**
 * Android 13+: asks for POST_NOTIFICATIONS through Expo's permission queue.
 * Returns `null` when the native function is missing (a dev client built
 * before it existed), so the caller can fall back. See AppBadgeModule.kt for
 * why React Native's PermissionsAndroid must not be used here.
 */
export async function requestPostNotifications(): Promise<boolean | null> {
    if (!native?.requestPostNotificationsAsync) return null;
    const result = await native.requestPostNotificationsAsync();
    return result.granted;
}
