import { useEffect, useState } from 'react';

import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { MarketplaceOffer } from '@/lib/dao/interfaces';

export interface AcceptedSlot {
    start: string;
    end: string | null;
}

/** The time window of the offer the owner accepted, or null when there is none (or it names no time). */
export function acceptedSlot(offers: readonly MarketplaceOffer[]): AcceptedSlot | null {
    const accepted = offers.find((o) => o.status === 'accepted' && !!o.proposedStart && Number.isFinite(Date.parse(o.proposedStart)));
    return accepted ? { start: accepted.proposedStart as string, end: accepted.proposedEnd ?? null } : null;
}

/** "Sat, Nov 21 · 4:00 AM – 12:00 PM"; just the start when there is no end. Null for an unreadable start. */
export function formatSlot(start?: string | null, end?: string | null, locale?: string): string | null {
    if (!start) return null;
    const s = new Date(start);
    if (Number.isNaN(s.getTime())) return null;
    const day = s.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = (d: Date) => d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    const e = end ? new Date(end) : null;
    return e && !Number.isNaN(e.getTime()) ? `${day} · ${time(s)} – ${time(e)}` : `${day} · ${time(s)}`;
}

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; slot: AcceptedSlot | null }>();

/**
 * The exact time the provider offered for an accepted scheduled service. The request only holds the
 * window the owner asked for; the booked time is on the accepted offer. Null while loading, when it
 * is not a scheduled service, or when it cannot be read.
 */
export function useAcceptedSlot(requestId: string | undefined, enabled: boolean): AcceptedSlot | null {
    const [slot, setSlot] = useState<AcceptedSlot | null>(() => (requestId ? cache.get(requestId)?.slot ?? null : null));

    useEffect(() => {
        if (!enabled || !requestId) return;
        const hit = cache.get(requestId);
        if (hit && Date.now() - hit.at < CACHE_MS) {
            setSlot(hit.slot);
            return;
        }
        let alive = true;
        assistanceDAO
            .getOffers(requestId)
            .then((offers) => {
                const found = acceptedSlot(offers);
                cache.set(requestId, { at: Date.now(), slot: found });
                if (alive) setSlot(found);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [requestId, enabled]);

    return enabled ? slot : null;
}
