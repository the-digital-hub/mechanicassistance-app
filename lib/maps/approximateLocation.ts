/**
 * Approximate ("zone only") location for the appointment list.
 *
 * The list card shows roughly where the owner is, never the exact point: the
 * centre is moved a few hundred metres away from the real coordinate and a
 * circle larger than that offset is drawn instead of a pin, so the real spot is
 * always inside the zone but cannot be read off the map.
 *
 * The offset is derived from a seed (the appointment id), not from
 * Math.random(): a random offset on every render would let someone average
 * several views back to the real point.
 */

export interface ApproximateArea {
    latitude: number;
    longitude: number;
    /** Circle radius in metres. Always larger than the offset applied. */
    radiusMeters: number;
}

export const APPROXIMATE_RADIUS_M = 800;
const MIN_OFFSET_M = 250;
const MAX_OFFSET_M = 550;
const METERS_PER_DEG_LAT = 111_320;

/** FNV-1a — small, stable 32-bit hash of the seed. */
function hash32(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function approximateArea(lat: number, lng: number, seed: string): ApproximateArea {
    const a = hash32(`${seed}:angle`) / 0xffffffff;
    const b = hash32(`${seed}:dist`) / 0xffffffff;
    const angle = a * 2 * Math.PI;
    const distance = MIN_OFFSET_M + b * (MAX_OFFSET_M - MIN_OFFSET_M);

    const dLat = (distance * Math.cos(angle)) / METERS_PER_DEG_LAT;
    const dLng = (distance * Math.sin(angle)) / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

    return { latitude: lat + dLat, longitude: lng + dLng, radiusMeters: APPROXIMATE_RADIUS_M };
}

/**
 * Drops the street line of an address, keeping city / state / zip:
 * "16329 Malibu Dr, Weston, FL 33326" → "Weston, FL 33326".
 * Falls back to the zip when the address has no comma-separated area.
 */
export function coarseAddress(address: string | undefined, zip?: string): string {
    const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts.slice(1).join(', ');
    return zip ?? '';
}
