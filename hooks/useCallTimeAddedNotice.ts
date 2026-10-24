import React from 'react';

import { useSocket } from '@/context/SocketContext';

/** How long the "time added" notice stays on screen. */
export const NOTICE_MS = 4000;

export interface CallTimeAddedNotice {
    minutes: number;
    /** Who this phone is on the call: the owner bought the time, the mechanic is told. */
    role: 'owner' | 'mechanic';
    key: string;
}

/**
 * The owner bought extra time on this video call: appointments-service sends
 * both sides `video_call_update` with `stage: 'extended'`. Returns the notice
 * to show for NOTICE_MS, then null. The same event (a re-render or a socket
 * reconnect replaying it) is shown once.
 */
export function useCallTimeAddedNotice(appointmentId: string | undefined) {
    const { lastMessage } = useSocket();
    const [notice, setNotice] = React.useState<CallTimeAddedNotice | null>(null);
    const lastKey = React.useRef<string | null>(null);
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const dismiss = React.useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setNotice(null);
    }, []);

    React.useEffect(() => {
        if (!appointmentId || lastMessage?.type !== 'video_call_update') return;
        const p: { appointmentId?: string; stage?: string; minutes?: string | number; at?: string; role?: string } =
            lastMessage.payload ?? {};
        if (p.stage !== 'extended' || p.appointmentId !== appointmentId) return;
        const minutes = Number(p.minutes);
        if (!Number.isFinite(minutes) || minutes <= 0) return;
        const key = `${p.at ?? ''}:${minutes}`;
        if (key === lastKey.current) return;
        lastKey.current = key;

        setNotice({ minutes, role: p.role === 'owner' ? 'owner' : 'mechanic', key });
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            timer.current = null;
            setNotice(null);
        }, NOTICE_MS);
    }, [lastMessage, appointmentId]);

    React.useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    return { notice, dismiss };
}
