import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { useEffect, useState } from 'react';

/** Minutes added to a finished call, by request id, shared by every card (the list re-renders on each focus). */
const cache = new Map<string, number>();

/**
 * How many minutes were added to a video call on top of the one chosen (`contractedMinutes - baseMinutes`),
 * for the list card of a finished call. 0 while unknown or when nothing was added; never throws, so a card
 * simply shows no extra-time row if the lookup fails.
 */
export function useCallExtraMinutes(appointmentId: string, enabled: boolean): number {
    const [minutes, setMinutes] = useState(() => cache.get(appointmentId) ?? 0);

    useEffect(() => {
        if (!enabled) return;
        const cached = cache.get(appointmentId);
        if (cached !== undefined) {
            setMinutes(cached);
            return;
        }
        let alive = true;
        videoCallDAO
            .getExtensions(appointmentId)
            .then((r) => {
                const added = Math.max(0, (r.contractedMinutes ?? 0) - (r.baseMinutes ?? 0));
                cache.set(appointmentId, added);
                if (alive) setMinutes(added);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [appointmentId, enabled]);

    return minutes;
}
