export interface LatLng {
    latitude: number;
    longitude: number;
}

/** Decodes a Google encoded polyline (as returned by the Directions API) into coordinates. */
export function decodePolyline(encoded: string): LatLng[] {
    const points: LatLng[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
        let b: number;
        let shift = 0;
        let result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += result & 1 ? ~(result >> 1) : result >> 1;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += result & 1 ? ~(result >> 1) : result >> 1;
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
}

/** Google Maps directions link (opens the app when installed, the web otherwise). */
export function googleDirectionsUrl(origin: LatLng | null, destination: LatLng): string {
    const dest = `${destination.latitude},${destination.longitude}`;
    const from = origin ? `&origin=${origin.latitude},${origin.longitude}` : '';
    return `https://www.google.com/maps/dir/?api=1${from}&destination=${dest}&travelmode=driving`;
}
