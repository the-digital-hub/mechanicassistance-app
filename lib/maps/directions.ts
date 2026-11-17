import { Linking } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';

export interface DirectionsTarget {
    /** Street address, used when there are no coordinates. */
    address?: string | null;
    lat?: number | string | null;
    lng?: number | string | null;
}

const num = (v: number | string | null | undefined): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/**
 * Google Maps "directions" link to the destination, driving, from wherever the phone is now.
 * Coordinates win over the address (the client's pin is exact); without either there is nothing to open.
 * The https form opens the Google Maps app when it is installed and Google Maps on the web when not.
 */
export function directionsUrl(target: DirectionsTarget): string | null {
    const lat = num(target.lat);
    const lng = num(target.lng);
    const destination = lat !== null && lng !== null ? `${lat},${lng}` : target.address?.trim();
    if (!destination) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/** Opens the route to the destination in Google Maps. Tells the user when it can't. */
export async function openDirections(target: DirectionsTarget, failedMessage: string): Promise<void> {
    const url = directionsUrl(target);
    if (!url) {
        appAlert(failedMessage);
        return;
    }
    try {
        await Linking.openURL(url);
    } catch {
        appAlert(failedMessage);
    }
}
