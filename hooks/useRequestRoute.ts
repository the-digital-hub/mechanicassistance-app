import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/apiClient';
import { ensureForegroundLocationPermission } from '@/lib/location/foregroundPermission';
import { approximateArea } from '@/lib/maps/approximateLocation';

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatEta(minutes: number): string {
    if (minutes < 1) return '1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

/**
 * How far a request is from the technician and how long it would take to get there: first a straight-line estimate at an
 * assumed speed, then the road figures from the backend when they arrive. Measured to the approximate zone, never to the
 * client's real point (the request is not accepted yet). Nothing without location permission or without the request's coordinates.
 */
export function useRequestRoute(requestId: string, lat: number | undefined, lng: number | undefined, enabled = true): { distKm: number | null; etaText: string | null } {
    const [etaText, setEtaText] = useState<string | null>(null);
    const [distKm, setDistKm] = useState<number | null>(null);
    const hasLocation = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);

    useEffect(() => {
        if (!enabled || !hasLocation) return undefined;
        let cancelled = false;
        (async () => {
            try {
                if (!(await ensureForegroundLocationPermission()) || cancelled) return;
                const loc = await Location.getCurrentPositionAsync({});
                if (cancelled) return;
                const { latitude, longitude } = loc.coords;
                const zone = approximateArea(lat as number, lng as number, requestId);

                const km = haversineKm(latitude, longitude, zone.latitude, zone.longitude);
                setDistKm(km);
                setEtaText(formatEta((km * 1.3 / 25) * 60));

                const route: any = await apiClient.get(
                    `/api/appointments/route?fromLat=${latitude}&fromLng=${longitude}&toLat=${zone.latitude}&toLng=${zone.longitude}`,
                ).catch(() => null);
                if (cancelled || !route?.available) return;
                if (typeof route.distanceKm === 'number') setDistKm(route.distanceKm);
                if (typeof route.minutesAway === 'number') setEtaText(formatEta(route.minutesAway));
            } catch {
                // ETA and distance stay null
            }
        })();
        return () => { cancelled = true; };
    }, [enabled, hasLocation, lat, lng, requestId]);

    return { distKm, etaText };
}
