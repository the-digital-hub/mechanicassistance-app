import React from 'react';

import { useSocket } from '@/context/SocketContext';
import { type PendingExtensionRequest, videoCallDAO } from '@/lib/dao/VideoCallDAO';

/** How an extra-time request that was waiting for the technician ended (owner side). */
export type ExtensionOutcome = 'declined' | 'expired' | 'failed';

const OUTCOME_STAGES: Record<string, ExtensionOutcome> = {
    extension_declined: 'declined',
    extension_expired: 'expired',
    extension_failed: 'failed',
};

/**
 * The extra-time request waiting for the technician, kept fresh by `video_call_update`
 * (`extension_requested`, `extended`, `extension_declined`, `extension_expired`,
 * `extension_failed`) and rebuilt from `GET …/video/extensions` on open / reconnect.
 * `outcome` is set once when a request this phone saw pending ends without adding time.
 */
export function usePendingExtension(appointmentId: string | undefined, enabled = true) {
    const { lastMessage } = useSocket();
    const [pending, setPending] = React.useState<PendingExtensionRequest | null>(null);
    const [outcome, setOutcome] = React.useState<ExtensionOutcome | null>(null);
    const lastKey = React.useRef<string | null>(null);

    const reload = React.useCallback(async () => {
        if (!enabled || !appointmentId) return;
        try {
            const data = await videoCallDAO.getExtensions(appointmentId);
            setPending(data.pendingRequest ?? null);
        } catch {
            /* not a running video call, or no access */
        }
    }, [appointmentId, enabled]);

    React.useEffect(() => {
        void reload();
    }, [reload]);

    React.useEffect(() => {
        if (!enabled || !appointmentId || lastMessage?.type !== 'video_call_update') return;
        const p: { appointmentId?: string; stage?: string; extensionId?: string; at?: string; code?: string } = lastMessage.payload ?? {};
        if (p.appointmentId !== appointmentId || !p.stage?.startsWith('extension') && p.stage !== 'extended') return;
        const key = `${p.stage}:${p.extensionId ?? ''}:${p.at ?? ''}`;
        if (key === lastKey.current) return;
        lastKey.current = key;

        const ended = OUTCOME_STAGES[p.stage];
        if (ended) setOutcome(ended);
        if (p.stage !== 'extension_requested') setPending(null);
        void reload();
    }, [lastMessage, appointmentId, enabled, reload]);

    const clearOutcome = React.useCallback(() => setOutcome(null), []);
    return { pending, outcome, clearOutcome, reload };
}
