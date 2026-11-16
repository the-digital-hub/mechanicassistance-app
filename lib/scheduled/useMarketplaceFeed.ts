import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { AssistanceRequest } from '@/lib/dao/interfaces';
import { apiErrorCode } from '@/lib/payments/cardRequired';
import { loadDeclined } from './declined';
import { feedProblem, toFeedRequest, type FeedProblem } from './provider';

/** Socket messages after which the feed may have changed. */
const REFRESH_ON = ['new_request', 'assistance_update', 'appointment_update', 'socket_connect', 'app_resumed'];

export interface MarketplaceFeed {
    /** Scheduled requests the provider can quote, shaped like the rest of the feed. */
    items: AssistanceRequest[];
    /** Why the provider cannot see any, when the backend said so. An empty list is not a problem. */
    problem: FeedProblem | null;
    loading: boolean;
    reload: () => void;
}

/**
 * Provider side of scheduled requests: they no longer come in `GET /assistance?status=pending`, only
 * in `GET /marketplace/requests`. Reloads on focus and on the socket events that can change the list.
 */
export function useMarketplaceFeed(enabled: boolean, lastMessage: { type: string } | null | undefined): MarketplaceFeed {
    const [items, setItems] = useState<AssistanceRequest[]>([]);
    const [problem, setProblem] = useState<FeedProblem | null>(null);
    const [loading, setLoading] = useState(enabled);
    const loaded = useRef(false);

    const load = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return;
        }
        if (!loaded.current) setLoading(true);
        try {
            const [list, declined] = await Promise.all([assistanceDAO.getMarketplaceRequests(), loadDeclined()]);
            // A request the technician already quoted stays listed even if it was skipped before.
            setItems(list.filter((r) => r.myOffer || !declined.includes(r.id)).map(toFeedRequest));
            setProblem(null);
            loaded.current = true;
        } catch (error) {
            setItems([]);
            setProblem(feedProblem(apiErrorCode(error)));
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    useEffect(() => {
        if (lastMessage && REFRESH_ON.includes(lastMessage.type)) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastMessage]);

    return { items, problem, loading, reload: load };
}
