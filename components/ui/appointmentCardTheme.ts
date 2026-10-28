import { Appointment } from '@/context/AppointmentsContext';
import { Calendar, Clock, LucideIcon, ShieldCheck, Video } from 'lucide-react-native';

/** Which state the card renders — collapses the raw statuses the design treats alike. */
export type CardState =
    | 'pending'
    | 'offered'
    | 'ready'
    | 'enRoute'
    | 'scheduled'
    | 'awaitingConfirmation'
    | 'disputed'
    | 'completed'
    | 'notCharged'
    | 'canceled';

export function getCardState(appointment: Pick<Appointment, 'status' | 'type' | 'assistanceType' | 'currentStatus' | 'departedAt'>): CardState {
    const { status } = appointment;
    // A video call is remote: nobody is "en route" to it.
    if (status === 'accepted' && (appointment.assistanceType ?? appointment.type) === 'videocall') return 'scheduled';
    switch (status) {
        case 'pending':
            return 'pending';
        case 'offered':
            return 'offered';
        case 'accepted':
            // Accepted is not "en route": the mechanic is only on the way once they tap "Head out".
            return appointment.departedAt ? 'enRoute' : 'ready';
        case 'started':
        case 'in_progress':
            return 'enRoute';
        case 'awaiting_confirmation':
            return 'awaitingConfirmation';
        case 'disputed':
            return 'disputed';
        case 'completed':
            // Video call support ruled "not resolved": the payment was released.
            return appointment.currentStatus === 'not_resolved' ? 'notCharged' : 'completed';
        case 'canceled':
            return 'canceled';
        default:
            return 'scheduled';
    }
}

export function isPastState(state: CardState): boolean {
    return state === 'completed' || state === 'notCharged' || state === 'canceled';
}

/** Status banner colours (bg / small label / state / hint) per state. */
export const BANNER_COLORS: Record<CardState, { bg: string; label: string; title: string; hint: string }> = {
    pending: { bg: '#FFF4E8', label: '#F59E0B', title: '#EA580C', hint: '#FB923C' },
    offered: { bg: '#E9F1FF', label: '#6B8BD6', title: '#1E56E3', hint: '#3B6FE8' },
    ready: { bg: '#FFF4E8', label: '#F59E0B', title: '#EA580C', hint: '#FB923C' },
    enRoute: { bg: '#E7F6EE', label: '#6BAF8A', title: '#15803D', hint: '#22A35A' },
    scheduled: { bg: '#E9F1FF', label: '#6B8BD6', title: '#1E56E3', hint: '#3B6FE8' },
    awaitingConfirmation: { bg: '#FFF4E8', label: '#F59E0B', title: '#EA580C', hint: '#FB923C' },
    disputed: { bg: '#FDECEC', label: '#E58A8A', title: '#C53030', hint: '#E53E3E' },
    completed: { bg: '#EEF0F4', label: '#9CA3AF', title: '#4B5563', hint: '#9CA3AF' },
    notCharged: { bg: '#EEF0F4', label: '#9CA3AF', title: '#4B5563', hint: '#9CA3AF' },
    canceled: { bg: '#EEF0F4', label: '#9CA3AF', title: '#4B5563', hint: '#9CA3AF' },
};

/** Type bar: one blue for active jobs, slate once the job is over. */
export const TYPE_BAR_ACTIVE = '#2B4FD8';
export const TYPE_BAR_PAST = '#525E78';

export function getTypeBar(appointment: Appointment): { icon: LucideIcon; labelKey: string } {
    if (appointment.assistanceType === 'witness' || appointment.type === 'witness') {
        return { icon: ShieldCheck, labelKey: 'appointments.list.card.type.witness' };
    }
    switch (appointment.type) {
        case 'immediate':
            return { icon: Clock, labelKey: 'appointments.list.card.type.immediate' };
        case 'videocall':
            return { icon: Video, labelKey: 'appointments.list.card.type.videocall' };
        default:
            return { icon: Calendar, labelKey: 'appointments.list.card.type.scheduled' };
    }
}
