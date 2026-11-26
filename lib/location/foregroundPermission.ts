import * as Location from 'expo-location';

/**
 * Whether the app may read the foreground location, asking only when the
 * person has never answered.
 *
 * Use this instead of `requestForegroundPermissionsAsync()` anywhere that runs
 * on its own (a feed refresh, a mount, a socket event). On Android every
 * request call opens the system's permission activity, even when the
 * permission is already granted: the app is paused and resumed, AppState goes
 * background → active, SocketContext emits `app_resumed`, the mechanic feed
 * reloads and asks again. That loop pushed the app to the home screen and
 * brought it back on every launch. iOS answers a granted request without any
 * UI, which is why it only happened on Android.
 */
export async function ensureForegroundLocationPermission(): Promise<boolean> {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === Location.PermissionStatus.GRANTED) return true;
    if (current.status !== Location.PermissionStatus.UNDETERMINED) return false;
    const asked = await Location.requestForegroundPermissionsAsync();
    return asked.status === Location.PermissionStatus.GRANTED;
}
