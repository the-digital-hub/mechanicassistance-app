import { useLocationRevalidation } from '@/hooks/useLocationRevalidation';

/**
 * Revalidates location on every app entry, for both roles. Mounted once in the
 * tabs layout, next to `MechanicLocationBroadcaster`. Renders nothing.
 */
export function LocationRevalidator() {
    useLocationRevalidation();
    return null;
}
