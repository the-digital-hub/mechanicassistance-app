import * as Location from 'expo-location';

/** Mechanics see requests within this radius of their current location. */
export const MECHANIC_RADIUS_KM = 1000;

/** Best-effort current GPS coords; null if permission denied or lookup fails. */
export async function getCurrentCoords(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({});
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Query filters for a mechanic's pending-request feed.
 *
 * Shared by the assist tab and the dashboard on purpose: they used to ask the
 * backend different questions — the dashboard sent a geo center, assist sent
 * none — so the same account saw two different feeds and neither reading was
 * wrong. Without location permission the geo keys are simply absent, which the
 * backend reads as "no center" rather than as an empty radius.
 */
export async function buildMechanicFeedFilters(): Promise<
  Record<string, string | number>
> {
  const filters: Record<string, string | number> = { status: 'pending' };
  const coords = await getCurrentCoords();

  if (coords) {
    filters.lat = coords.latitude;
    filters.lng = coords.longitude;
    filters.radiusKm = MECHANIC_RADIUS_KM;
  }

  return filters;
}
