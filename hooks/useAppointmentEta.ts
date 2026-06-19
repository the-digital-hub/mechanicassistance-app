import React from 'react';
import { useSocket } from '@/context/SocketContext';
import { apiClient } from '@/lib/api/apiClient';

export interface AppointmentEta {
    minutesAway: number | null;
    distanceKm: number | null;
    etaTime: string | null;
    loading: boolean;
}

/**
 * Fetches and live-tracks the mechanic's ETA for an appointment.
 *
 * - On mount (status accepted/started) it pulls `/api/appointments/:id/eta`,
 *   which returns the persisted ETA if no live mechanic position has arrived
 *   yet, or a freshly computed one otherwise.
 * - It then listens for `eta_update` WebSocket events (emitted to BOTH the
 *   client and the mechanic) and refreshes as the mechanic moves.
 *
 * Used by both UserTrackingTab (client) and MechanicAssistanceInfoTab (mechanic)
 * so the two roles show the same arrival time and arrival hour.
 */
export function useAppointmentEta(
    appointmentId: string | undefined,
    status: string | undefined,
): AppointmentEta {
    const { socket } = useSocket();

    const [eta, setEta] = React.useState<{
        minutesAway: number | null;
        distanceKm: number | null;
        etaTime: string | null;
    }>({ minutesAway: null, distanceKm: null, etaTime: null });
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!appointmentId) return;
        if (status !== 'started' && status !== 'accepted') {
            setLoading(false);
            return;
        }

        apiClient
            .get(`/api/appointments/${appointmentId}/eta`)
            .then((data: any) => {
                if (data?.available) {
                    setEta({
                        minutesAway: data.minutesAway ?? null,
                        distanceKm: data.distanceKm ?? null,
                        etaTime: data.etaTime ?? null,
                    });
                }
            })
            .catch(() => {/* silent fail */})
            .finally(() => setLoading(false));
    }, [appointmentId, status]);

    React.useEffect(() => {
        if (!socket || !appointmentId) return;

        const handler = (payload: any) => {
            if (payload?.appointmentId !== appointmentId) return;
            setEta({
                minutesAway: payload.minutesAway ?? null,
                distanceKm: payload.distanceKm ?? null,
                etaTime: payload.etaTime ?? null,
            });
            setLoading(false);
        };

        socket.on('eta_update', handler);
        return () => { socket.off('eta_update', handler); };
    }, [socket, appointmentId]);

    return { ...eta, loading };
}

/** Formats an ISO timestamp to a local arrival hour, e.g. "14:30". */
export function formatEtaTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
