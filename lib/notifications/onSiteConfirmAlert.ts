import { router } from 'expo-router';
import { Alert } from 'react-native';
import i18n from '@/lib/i18n';

/**
 * Foreground alert for the owner when the mechanic closes an on-site job as
 * resolved (appointment `awaiting_confirmation`): the owner has to confirm or
 * dispute it on the appointment's detail screen.
 *
 * The same fact reaches the app twice while it is open — the socket
 * `appointment_update` and the `service_awaiting_confirmation` push — and the
 * socket can repeat itself. One shared, module-level set dedupes all of them,
 * so the owner sees a single alert per appointment.
 */
const alerted = new Set<string>();

/** Appointment whose detail screen is focused right now (set by that screen). */
let viewingAppointmentId: string | null = null;

export function setViewingAppointment(id: string) {
    viewingAppointmentId = id;
}

export function clearViewingAppointment(id: string) {
    if (viewingAppointmentId === id) viewingAppointmentId = null;
}

/** Shows the alert once per appointment; skipped when its detail screen is already open. */
export function showOnSiteConfirmAlert(appointmentId: string | undefined | null) {
    if (!appointmentId || alerted.has(appointmentId)) return;
    alerted.add(appointmentId);
    // Already looking at it: the confirmation cards are on screen (and refresh themselves).
    if (viewingAppointmentId === appointmentId) return;

    Alert.alert(
        i18n.t('notificationsPopup.onSiteConfirmTitle'),
        i18n.t('notificationsPopup.onSiteConfirmBody'),
        [
            { text: i18n.t('notificationsPopup.onSiteConfirmLater'), style: 'cancel' },
            {
                text: i18n.t('notificationsPopup.onSiteConfirmReview'),
                onPress: () => {
                    try {
                        router.push({ pathname: '/appointments/[id]', params: { id: appointmentId } }, { withAnchor: true });
                    } catch (err) {
                        console.warn('[on-site] could not open the appointment', err);
                    }
                },
            },
        ],
    );
}
