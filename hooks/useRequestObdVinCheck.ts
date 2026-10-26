import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

import type { RequestVinCheckVariant } from '@/components/video/RequestVinCheckModal';
import { useSocket } from '@/context/SocketContext';
import { onSiteDAO } from '@/lib/dao/OnSiteDAO';
import { requestObdDAO } from '@/lib/dao/RequestObdDAO';

export interface RequestVinCheck {
    vin: string;
    variant: RequestVinCheckVariant;
}

/**
 * What the owner should be asked about a read report: `mismatch` when its VIN
 * is another vehicle's, `unknown` when a VIN was read but the vehicle has none
 * on file to compare with (the backend then leaves `vinMismatch` null). Null
 * when there is nothing to ask: no VIN read yet, or the same vehicle.
 */
export function vinCheckVariant(vin: string | null | undefined, mismatch: boolean | null | undefined): RequestVinCheckVariant | null {
    if (!vin) return null;
    if (mismatch === true) return 'mismatch';
    if (mismatch == null) return 'unknown';
    return null;
}

/**
 * Watches the scanner report attached to a video-call request while the owner
 * waits for a mechanic. The reading lands in the background (a few seconds
 * after the request is created), by an `obd_update` socket event with
 * `scope: 'request'`; it may also have landed before this screen mounted, so
 * the report is fetched once too. Each reading is asked about once.
 */
export function useRequestObdVinCheck(requestId: string | undefined, enabled: boolean) {
    const { lastMessage } = useSocket();
    const [check, setCheck] = React.useState<RequestVinCheck | null>(null);
    const asked = React.useRef<string | null>(null);

    const consider = React.useCallback((vin: string | null | undefined, mismatch: boolean | null | undefined) => {
        const variant = vinCheckVariant(vin, mismatch);
        if (!variant || !vin) return;
        const key = `${vin}:${variant}`;
        if (asked.current === key) return;
        asked.current = key;
        setCheck({ vin, variant });
    }, []);

    React.useEffect(() => {
        if (!enabled || !requestId) return;
        let alive = true;
        requestObdDAO
            .get(requestId)
            .then((report) => {
                if (alive) consider(report.vin, report.vinMismatch);
            })
            // No report attached, or not readable yet: the socket will say.
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [enabled, requestId, consider]);

    React.useEffect(() => {
        if (!enabled || !requestId || lastMessage?.type !== 'obd_update') return;
        const p: { id?: string; scope?: string; obdVin?: string | null; obdVinMismatch?: boolean | null } = lastMessage.payload ?? {};
        if (p.scope !== 'request' || p.id !== requestId) return;
        consider(p.obdVin, p.obdVinMismatch);
    }, [enabled, requestId, lastMessage, consider]);

    const dismiss = React.useCallback(() => setCheck(null), []);

    /** Another report was attached: its reading is asked about even if the VIN is the same. */
    const replaced = React.useCallback(() => {
        asked.current = null;
        setCheck(null);
    }, []);

    return { check, dismiss, replaced };
}

export interface VisitVinCheck extends RequestVinCheck {
    vehicleVin: string | null;
}

/** Remembers, per appointment and VIN, that the owner was told, so reopening the job does not ask again. */
const toldKey = (appointmentId: string, vin: string) => `obd-vin-told:${appointmentId}:${vin}`;

/**
 * The owner's side of an on-site visit: the mechanic scanned the vehicle and
 * its VIN is another vehicle's, or the vehicle has none on file. The mechanic
 * answers it; the owner is told once. The reading arrives by an `obd_update`
 * socket event (sent to both sides), and may have landed before this screen
 * opened, so the visit is fetched on mount and on every event.
 */
export function useVisitObdVinCheck(appointmentId: string | undefined, enabled: boolean) {
    const { lastMessage } = useSocket();
    const [check, setCheck] = React.useState<VisitVinCheck | null>(null);
    const asked = React.useRef<string | null>(null);

    const refresh = React.useCallback(async () => {
        if (!appointmentId) return;
        const visit = await onSiteDAO.get(appointmentId).catch(() => null);
        const vin = visit?.obdVin;
        const variant = vinCheckVariant(vin, visit?.obdVinMismatch);
        if (!variant || !vin || asked.current === vin) return;
        asked.current = vin;
        const told = await AsyncStorage.getItem(toldKey(appointmentId, vin)).catch(() => null);
        if (told) return;
        setCheck({ vin, variant, vehicleVin: visit?.vehicleVin ?? null });
    }, [appointmentId]);

    React.useEffect(() => {
        if (enabled) refresh();
    }, [enabled, refresh]);

    React.useEffect(() => {
        if (!enabled || !appointmentId || lastMessage?.type !== 'obd_update') return;
        const p: { id?: string; scope?: string; obdVin?: string | null } = lastMessage.payload ?? {};
        if (p.scope === 'request' || p.id !== appointmentId || !p.obdVin) return;
        refresh();
    }, [enabled, appointmentId, lastMessage, refresh]);

    const dismiss = React.useCallback(() => {
        if (appointmentId && check) AsyncStorage.setItem(toldKey(appointmentId, check.vin), '1').catch(() => undefined);
        setCheck(null);
    }, [appointmentId, check]);

    return { check, dismiss };
}
