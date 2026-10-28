import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useMechanicLocationBroadcast } from '@/hooks/useMechanicLocationBroadcast';

/**
 * Shares the mechanic's position for the job they are driving to or working on,
 * whatever screen they are on. Mounted once in the tabs layout: leaving the
 * appointment detail used to freeze the owner's map. Renders nothing.
 */
export function MechanicLocationBroadcaster() {
    const { user } = useUser();
    const { appointments } = useAppointments();

    const tracked = user?.role === 'mechanic'
        ? appointments.find(
            (a) =>
                (a.assistanceType ?? a.type) !== 'videocall' &&
                (a.status === 'started' || (a.status === 'accepted' && !!a.departedAt)),
        )
        : undefined;

    useMechanicLocationBroadcast({
        appointmentId: tracked?.id ?? '',
        status: tracked?.status ?? 'pending',
        role: user?.role,
        departed: !!tracked?.departedAt,
    });

    return null;
}
