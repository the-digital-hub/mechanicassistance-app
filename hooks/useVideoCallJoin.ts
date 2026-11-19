import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { useVideoCallState } from '@/hooks/useVideoCallState';
import { apiClient } from '@/lib/api/apiClient';
import { ApiError } from '@/lib/api/types';
import { userDAO } from '@/lib/dao/UserDAO';
import { appAlert } from '@/lib/ui/appAlert';
import { DEFAULT_CALL_MINUTES } from '@/lib/video/callLength';
import { hasPreCallConsent, recordConsent } from '@/lib/video/consent';

export interface VideoRoomEntry {
    roomUrl: string;
    token: string;
    expiry: number;
}

/**
 * Everything it takes to get into a video call from the appointment: the room (the owner creates it, the technician
 * waits for it), the conditions both people accept first, and the call's own data. The sheet that opens from
 * "Join video call" draws it; nothing here is a screen.
 *
 * `enabled` is whether the sheet is open: the room is only looked up (and polled) while someone is about to enter.
 * `onEnter` receives the room to open once the person has connected.
 */
export function useVideoCallJoin(appointmentId: string, enabled: boolean, onEnter: (room: VideoRoomEntry) => void) {
    const { t } = useTranslation();
    const { user } = useUser();
    const { getAppointmentById } = useAppointments();
    const { lastMessage } = useSocket();
    const { state: callState } = useVideoCallState(appointmentId || undefined, enabled && !!appointmentId);

    const appointment = getAppointmentById(appointmentId);
    const isUserRole = user?.role === 'user';
    const participantName = user ? `${user.name} ${user.surname}`.trim() : 'Participant';
    const participantRole: 'user' | 'mechanic' = isUserRole ? 'user' : 'mechanic';
    const consentRole: 'owner' | 'mechanic' = isUserRole ? 'owner' : 'mechanic';

    const [connecting, setConnecting] = useState(false);
    const [roomUrl, setRoomUrl] = useState<string | null>(null);
    const [checkingRoom, setCheckingRoom] = useState(true);
    const [otherPartyName, setOtherPartyName] = useState('');
    const [accepted, setAccepted] = useState(false);
    const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

    // Who is on the other side.
    useEffect(() => {
        if (!enabled) return;
        const otherId = isUserRole ? appointment?.mechanicId : appointment?.userId;
        if (!otherId) return;
        let cancelled = false;
        userDAO
            .getPublicProfile(otherId)
            .then((p) => { if (!cancelled && p) setOtherPartyName(`${p.name || ''} ${p.surname || ''}`.trim()); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [enabled, isUserRole, appointment?.mechanicId, appointment?.userId]);

    // Is there a room already? The technician keeps asking every 3 s until the owner opens it.
    useEffect(() => {
        if (!enabled || !appointmentId) return;
        let cancelled = false;
        let interval: ReturnType<typeof setInterval> | undefined;
        const look = async (): Promise<boolean> => {
            try {
                const data = await apiClient.get<{ roomUrl: string | null; expiry: number; isExpired: boolean }>(`/api/video-room/${appointmentId}`);
                if (!cancelled && data?.roomUrl && !data.isExpired) {
                    setRoomUrl(data.roomUrl);
                    return true;
                }
            } catch (e) {
                // 404 = no room yet. 401 / 403 will not change by asking again: say so and stop.
                if (e instanceof ApiError && (e.statusCode === 401 || e.statusCode === 403)) {
                    appAlert(t('videoCall.lobby.errorTitle'), t('videoCall.lobby.notOnAppointment'));
                    return true;
                }
            } finally {
                if (!cancelled) setCheckingRoom(false);
            }
            return false;
        };
        setCheckingRoom(true);
        look().then((done) => {
            if (done || isUserRole || cancelled) return;
            interval = setInterval(async () => {
                if (await look()) clearInterval(interval);
            }, 3000);
        });
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [enabled, appointmentId, isUserRole, t]);

    // `video_room_ready` carries no URL (the room is private): ask for it.
    useEffect(() => {
        if (!enabled || lastMessage?.type !== 'video_room_ready' || lastMessage?.payload?.appointmentId !== appointmentId) return;
        apiClient
            .get<{ roomUrl: string | null; isExpired: boolean }>(`/api/video-room/${appointmentId}`)
            .then((data) => { if (data?.roomUrl && !data.isExpired) setRoomUrl(data.roomUrl); })
            .catch(() => undefined);
    }, [enabled, lastMessage, appointmentId]);

    // The conditions both people accept before entering; the answer is kept with its time and the version of the text.
    useEffect(() => {
        if (!enabled || !appointmentId) return;
        hasPreCallConsent(appointmentId, consentRole).then((c) => {
            if (c) {
                setAccepted(true);
                setAcceptedAt(c.at);
            }
        });
    }, [enabled, appointmentId, consentRole]);

    const start = useCallback(async () => {
        const data = await apiClient.post<{ roomUrl: string; expiry: number; token: string }>('/api/video-room', { appointmentId, participantName, role: participantRole });
        setRoomUrl(data.roomUrl);
        onEnter({ roomUrl: data.roomUrl, token: data.token, expiry: data.expiry });
    }, [appointmentId, participantName, participantRole, onEnter]);

    const join = useCallback(async () => {
        const data = await apiClient.get<{ roomUrl: string; token: string | null; expiry: number }>(
            `/api/video-room/${appointmentId}?participantName=${encodeURIComponent(participantName)}&role=${participantRole}`,
        );
        if (!data.token) {
            appAlert(t('videoCall.lobby.errorTitle'), t('videoCall.lobby.roomExpired'));
            return;
        }
        onEnter({ roomUrl: data.roomUrl, token: data.token, expiry: data.expiry });
    }, [appointmentId, participantName, participantRole, onEnter, t]);

    /** "Connect": keeps the acceptance, then opens (owner) or joins (technician) the room. */
    const connect = useCallback(async () => {
        if (!accepted || connecting) return;
        setConnecting(true);
        try {
            if (!acceptedAt) {
                const record = await recordConsent(appointmentId, { kind: 'precall', role: consentRole, accepted: true });
                setAcceptedAt(record.at);
            }
            await (isUserRole ? start() : join());
        } catch (error) {
            console.error('Failed to enter the video call:', error);
            appAlert(t('videoCall.lobby.errorTitle'), t(isUserRole ? 'videoCall.lobby.startFailed' : 'videoCall.lobby.joinFailed'));
        } finally {
            setConnecting(false);
        }
    }, [accepted, connecting, acceptedAt, appointmentId, consentRole, isUserRole, start, join, t]);

    const minutes = callState?.contractedMinutes ?? callState?.baseMinutes ?? appointment?.durationMinutes ?? DEFAULT_CALL_MINUTES;
    // The call already started: whoever left and came back is rejoining, not starting.
    const rejoin = callState?.startedAtLocalMs != null && (callState.status === 'accepted' || callState.status === 'in_progress');

    return {
        appointment,
        callState,
        isUserRole,
        otherPartyName,
        roomUrl,
        checkingRoom,
        connecting,
        accepted,
        acceptedAt,
        setAccepted,
        minutes,
        rejoin,
        /** The owner can always open the room; the technician needs it to exist. Both need to have accepted. */
        canConnect: accepted && (isUserRole || !!roomUrl),
        connect,
    };
}
