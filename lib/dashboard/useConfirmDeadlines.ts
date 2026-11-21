import { useEffect, useState } from 'react';

import type { Appointment } from '@/context/AppointmentsContext';
import { onSiteDAO } from '@/lib/dao/OnSiteDAO';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';

/**
 * When each job waiting for the owner's confirmation confirms by itself (ISO), by appointment id. A video call keeps it in its own state,
 * an on-site visit in the visit. Best effort: one that cannot be read simply has no clock.
 */
export function useConfirmDeadlines(items: readonly Appointment[]): Record<string, string> {
    const [deadlines, setDeadlines] = useState<Record<string, string>>({});
    const key = items.map((a) => a.id).join(',');
    useEffect(() => {
        if (items.length === 0) {
            setDeadlines({});
            return;
        }
        let alive = true;
        void Promise.all(
            items.map(async (a) => {
                try {
                    const deadline = a.type === 'videocall'
                        ? (await videoCallDAO.getState(a.id)).confirmDeadline
                        : (await onSiteDAO.get(a.id))?.confirmDeadline;
                    return [a.id, deadline ?? null] as const;
                } catch {
                    return [a.id, null] as const;
                }
            }),
        ).then((pairs) => {
            if (!alive) return;
            setDeadlines(Object.fromEntries(pairs.filter((p): p is readonly [string, string] => !!p[1])));
        });
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return deadlines;
}
