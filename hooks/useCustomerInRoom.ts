import { useSocket } from '@/context/SocketContext';
import { apiClient } from '@/lib/api/apiClient';
import { useFocusEffect } from 'expo-router';
import React from 'react';

/**
 * Technician side of a video call: true once the customer has opened the video
 * room and is waiting in it. The server tells the other party with
 * `video_room_ready` when someone opens the room; on screen focus the room is
 * also looked up, for when the event came while the screen was closed.
 * Does nothing (and answers false) when `enabled` is false.
 */
export function useCustomerInRoom(appointmentId: string | undefined, enabled: boolean): boolean {
    const { lastMessage } = useSocket();
    const [inRoom, setInRoom] = React.useState(false);

    const check = React.useCallback(() => {
        if (!enabled || !appointmentId) return;
        apiClient
            .get<{ roomUrl: string | null; isExpired?: boolean }>(`/api/video-room/${appointmentId}`)
            .then((room) => setInRoom(!!room?.roomUrl && !room.isExpired))
            .catch(() => undefined);
    }, [appointmentId, enabled]);

    useFocusEffect(check);

    React.useEffect(() => {
        if (lastMessage?.type === 'video_room_ready' && lastMessage.payload?.appointmentId === appointmentId) setInRoom(true);
    }, [lastMessage, appointmentId]);

    return enabled && inRoom;
}
