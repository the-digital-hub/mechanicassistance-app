import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/** What the request wizard stores as the address when the phone could not name the street ("My Current Location" / "Mi ubicación actual"). */
const PLACEHOLDER = /^\s*(my current location|mi ubicaci[oó]n actual)\s*$/i;

export const isPlaceholderAddress = (address: string | null | undefined): boolean => !!address && PLACEHOLDER.test(address);

/** "123 Main St, Miami, FL" from a reverse geocode, or null when the phone cannot name the place. */
export async function addressFromCoords(lat: number, lng: number): Promise<string | null> {
    try {
        const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (!a) return null;
        const street = [a.streetNumber, a.street].filter(Boolean).join(' ');
        const text = [street, a.city, a.region].filter(Boolean).join(', ');
        return text || null;
    } catch {
        return null;
    }
}

/**
 * The address to show for a request. When the stored one is only the placeholder, the real street is looked up from the request's
 * coordinates (and the placeholder stays until it arrives, or if nothing can be found).
 */
export function useReadableAddress(address: string | undefined, lat?: number, lng?: number): string | undefined {
    const [resolved, setResolved] = useState<string | null>(null);
    const needs = isPlaceholderAddress(address) && typeof lat === 'number' && typeof lng === 'number';
    useEffect(() => {
        if (!needs) return;
        let live = true;
        addressFromCoords(lat as number, lng as number).then((v) => { if (live) setResolved(v); });
        return () => { live = false; };
    }, [needs, lat, lng]);
    return needs && resolved ? resolved : address;
}
