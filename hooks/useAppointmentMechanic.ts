import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { AssistanceOfferSummary } from '@/lib/dao/interfaces';
import { useEffect, useState } from 'react';

export type AppointmentMechanic = AssistanceOfferSummary['mechanic'];

/**
 * Resolved summaries by request id, shared by every card. A mechanic's name and
 * rating barely move within a session, and the list re-renders on every focus —
 * without this each refresh would re-ask the backend once per card.
 * Failures are not cached, so the next mount tries again.
 */
const cache = new Map<string, AppointmentMechanic>();
const inFlight = new Map<string, Promise<AppointmentMechanic | null>>();

function load(requestId: string): Promise<AppointmentMechanic | null> {
    const pending = inFlight.get(requestId);
    if (pending) return pending;
    const p = assistanceDAO
        .getOfferSummary(requestId)
        .then((s) => {
            cache.set(requestId, s.mechanic);
            return s.mechanic;
        })
        .catch((err) => {
            // The card simply shows no technician row; keep the reason visible in logs.
            console.warn(`[useAppointmentMechanic] offer summary for ${requestId} failed`, err);
            return null;
        })
        .finally(() => inFlight.delete(requestId));
    inFlight.set(requestId, p);
    return p;
}

/**
 * Name, initials, photo and rating of the mechanic on a request, for the
 * owner's appointment cards. Comes from the offer summary
 * (GET /api/assistance/:id/offer-summary), which only the customer who posted
 * the request may read — so pass `enabled: false` for a mechanic viewer, and
 * for a request no mechanic has taken yet (the endpoint answers 409 then).
 */
export function useAppointmentMechanic(requestId: string, enabled: boolean): AppointmentMechanic | null {
    const [mechanic, setMechanic] = useState<AppointmentMechanic | null>(() => cache.get(requestId) ?? null);

    useEffect(() => {
        if (!enabled) return;
        const cached = cache.get(requestId);
        if (cached) {
            setMechanic(cached);
            return;
        }
        let alive = true;
        load(requestId).then((m) => {
            if (alive && m) setMechanic(m);
        });
        return () => {
            alive = false;
        };
    }, [requestId, enabled]);

    return enabled ? mechanic : null;
}
