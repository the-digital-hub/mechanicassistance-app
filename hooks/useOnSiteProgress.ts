import React from 'react';

import { onSiteDAO, type OnSiteVisit } from '@/lib/dao/OnSiteDAO';

/** How often the owner's screen asks for the visit while the technician works: the server announces check-in and close, not each step in between. */
const POLL_MS = 15_000;

/**
 * The technician's visit as the owner can follow it (check-in done, the vehicle being checked, the fix, the wrap-up).
 * Reloaded when `refreshKey` changes (an `appointment_update` moved the appointment) and on a short timer while `active`.
 */
export function useOnSiteProgress(appointmentId: string | undefined, active: boolean, refreshKey?: string): OnSiteVisit | null {
    const [visit, setVisit] = React.useState<OnSiteVisit | null>(null);
    React.useEffect(() => {
        if (!active || !appointmentId) {
            setVisit(null);
            return;
        }
        let cancelled = false;
        const load = () => {
            onSiteDAO.get(appointmentId).then((v) => { if (!cancelled) setVisit(v); }).catch(() => undefined);
        };
        load();
        const id = setInterval(load, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [appointmentId, active, refreshKey]);
    return visit;
}

export type VisitStage = 'arrived' | 'inspecting' | 'fixing' | 'wrapping';

/** Where the visit is, from the step the technician saved. */
export function visitStage(visit: OnSiteVisit | null): VisitStage {
    switch (visit?.step) {
        case 'resolve':
        case 'options-execution':
            return 'fixing';
        case 'video-out':
        case 'close':
        case 'done':
            return 'wrapping';
        case undefined:
            return 'arrived';
        default:
            return 'inspecting';
    }
}
