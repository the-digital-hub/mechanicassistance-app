import * as Location from 'expo-location';

/**
 * Current position, or null when none arrives in time.
 *
 * On Android `getCurrentPositionAsync` can wait forever for a fix (indoors, no GPS signal, location just switched on) and any screen
 * that awaits it sits on a spinner. The last known position answers at once; otherwise a fresh fix gets `timeoutMs`.
 * Location permission must already be granted.
 */
export async function getCurrentPositionOrNull(timeoutMs = 8000): Promise<Location.LocationObject | null> {
    try {
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (last) return last;
        return await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
        ]);
    } catch {
        return null;
    }
}
