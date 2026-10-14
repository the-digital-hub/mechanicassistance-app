import { useSocket } from '@/context/SocketContext';
import { videoCallDAO, type VideoCallState } from '@/lib/dao/VideoCallDAO';
import { useFocusEffect } from 'expo-router';
import React from 'react';

/**
 * Close-out state of a video-call appointment (finish note, confirm deadline,
 * dispute, outcome). Loaded on focus, again whenever an `appointment_update`
 * for this appointment arrives, and whenever `statusKey` changes (the
 * appointments list refreshed). Does nothing when `enabled` is false.
 */
export function useVideoCallState(appointmentId: string | undefined, enabled: boolean, statusKey?: string) {
    const { lastMessage } = useSocket();
    const [state, setState] = React.useState<VideoCallState | null>(null);

    const load = React.useCallback(async () => {
        if (!enabled || !appointmentId) return;
        try {
            setState(await videoCallDAO.getState(appointmentId));
        } catch (err) {
            console.warn('[useVideoCallState] load failed:', (err as Error).message);
        }
    }, [appointmentId, enabled]);

    useFocusEffect(
        React.useCallback(() => {
            load();
        }, [load]),
    );

    React.useEffect(() => {
        load();
    }, [load, statusKey]);

    React.useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'appointment_update') return;
        const payload: { id?: string; appointmentId?: string } = lastMessage.payload ?? {};
        if (payload.id === appointmentId || payload.appointmentId === appointmentId) load();
    }, [lastMessage, appointmentId, load]);

    return { state, setState, reload: load };
}
