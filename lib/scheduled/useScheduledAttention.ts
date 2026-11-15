import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { canSelect, quoteIsOpen } from './offers';
import { hasProgress, loadDraft } from './draft';

interface RequestRef {
    id: string;
    type?: string;
    status?: string;
}

export interface ScheduledAttention {
    /** Scheduled requests still collecting offers that already have something selectable. */
    withOffers: { id: string; count: number }[];
    /** Accepted scheduled services with a final quote waiting for the owner. */
    quotes: string[];
    /** An unfinished scheduled request saved on this phone. */
    draft: boolean;
}

const EMPTY: ScheduledAttention = { withOffers: [], quotes: [], draft: false };

/**
 * What the owner dashboard should flag about scheduled requests: offers to compare, a final quote to
 * decide, an unfinished draft. Everything is best effort: a failed call just means no alert.
 * `refreshKey` changes (a socket message) re-run it.
 */
export function useScheduledAttention(
    enabled: boolean,
    userId: string | undefined,
    requests: readonly RequestRef[],
    refreshKey: unknown,
): ScheduledAttention {
    const [state, setState] = useState<ScheduledAttention>(EMPTY);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    const scheduled = requests.filter((r) => r.type === 'scheduled');
    const pendingIds = scheduled.filter((r) => r.status === 'pending' || r.status === 'offered').map((r) => r.id);
    const acceptedIds = scheduled.filter((r) => r.status === 'accepted' || r.status === 'scheduled' || r.status === 'in_progress').map((r) => r.id);
    const key = `${pendingIds.join(',')}|${acceptedIds.join(',')}`;

    const run = useCallback(async () => {
        if (!enabled || !userId) {
            setState(EMPTY);
            return;
        }
        const now = new Date();
        const [withOffers, quotes, draft] = await Promise.all([
            Promise.all(
                pendingIds.map(async (id) => {
                    try {
                        const offers = await assistanceDAO.getOffers(id);
                        return { id, count: offers.filter((o) => canSelect(o, now)).length };
                    } catch {
                        return { id, count: 0 };
                    }
                }),
            ),
            Promise.all(
                acceptedIds.map(async (id) => {
                    try {
                        const v = await assistanceDAO.getFinalQuote(id);
                        return v && quoteIsOpen(v.quote.status, v.quote.expiresAt, now) ? id : null;
                    } catch {
                        return null;
                    }
                }),
            ),
            loadDraft(`user:${userId}`).then((d) => !!d && hasProgress(d)).catch(() => false),
        ]);
        if (!alive.current) return;
        setState({ withOffers: withOffers.filter((o) => o.count > 0), quotes: quotes.filter((q): q is string => !!q), draft });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, userId, key]);

    useFocusEffect(useCallback(() => { void run(); }, [run]));
    useEffect(() => {
        if (refreshKey) void run();
    }, [refreshKey, run]);

    return state;
}
