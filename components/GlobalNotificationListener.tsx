import { useNotifications } from '@/context/NotificationsContext';
import { isCancelledStatus } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { refLabel } from '@/lib/refCode';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { appAlert, type AppAlertHighlight } from '@/lib/ui/appAlert';
import { splitJobTitle } from '@/lib/ui/jobTitle';
import { resolveRequestIssueLabel } from '@/lib/i18n/requestIssueLabel';
import { showOnSiteConfirmAlert } from '@/lib/notifications/onSiteConfirmAlert';

/** How long the backend takes, roughly, to record a notification after the socket event. */
const INBOX_LAG_MS = 3000;

export function GlobalNotificationListener() {
    const { user } = useUser();
    const { lastMessage } = useSocket();
    const router = useRouter();
    const segments = useSegments();
    const { refresh, markSeen } = useNotifications();
    const { t, i18n } = useTranslation();

    // The same event reaches notifications-service through SNS → SQS, a moment
    // after the socket: reload the inbox once its row exists. The app is open,
    // so the push it implies is already seen — keep it off the icon.
    const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reloadInboxSoon = () => {
        if (pendingReload.current) clearTimeout(pendingReload.current);
        pendingReload.current = setTimeout(() => {
            pendingReload.current = null;
            void markSeen().then(refresh);
        }, INBOX_LAG_MS);
    };
    useEffect(() => () => {
        if (pendingReload.current) clearTimeout(pendingReload.current);
    }, []);

    // Track notified IDs to avoid duplicate alerts
    const notifiedIds = useRef<Set<string>>(new Set());

    // Mechanic-side popups use the app's own dialog (big OK button), not a custom overlay.
    const popup = (title: string, body: string, action: () => void, look: { tone: 'success' | 'danger'; icon: string }, highlight?: AppAlertHighlight) =>
        appAlert(title, body, [{ text: t('common.ok'), onPress: action }], { cancelable: false, ...look, ...(highlight ? { highlight } : {}) });

    /** Which assistance an alert is about: its kind, what is wrong and the vehicle, so "accepted" says what was accepted. */
    const describeRequest = async (requestId: string): Promise<AppAlertHighlight | undefined> => {
        try {
            const r = await assistanceDAO.getById(requestId);
            if (!r) return undefined;
            const kind = r.assistanceType === 'witness' ? 'accident' : r.type === 'videocall' ? 'videocall' : r.type === 'scheduled' ? 'scheduled' : 'immediate';
            // The stored title keeps the catalog names in the customer's language: what is wrong is read from the catalog in this person's.
            const issue = (await resolveRequestIssueLabel(requestId, i18n.language)) || splitJobTitle(r.title).main;
            return {
                label: t(`appointments.detail.types.${kind}`),
                value: issue || r.car || '',
                sub: issue && r.car ? r.car : undefined,
                ref: refLabel(r.refCode, r.id),
                icon: kind === 'videocall' ? 'videocam-outline' : kind === 'scheduled' ? 'calendar-outline' : 'flash-outline',
            };
        } catch {
            return undefined;
        }
    };

    useEffect(() => {
        if (!lastMessage) return;

        // Owner: the mechanic closed an on-site job as resolved — confirm or dispute it.
        // Only the owner (active role 'user', not the job's mechanic) is asked.
        if (lastMessage.type === 'appointment_update') {
            const p = lastMessage.payload ?? {};
            if (p.onSiteStage === 'awaiting_confirmation' && user?.role === 'user' && !!user?.id && user.id !== p.mechanicId) {
                showOnSiteConfirmAlert(p.id);
            }
            return;
        }

        if (lastMessage.type !== 'assistance_update') return;

        const payload = lastMessage.payload;
        const requestId = payload.id || payload.requestId;
        const { status } = payload;

        // Prevent duplicate notifications for the same event
        const notificationKey = `${requestId}-${status}`;
        if (notifiedIds.current.has(notificationKey)) return;

        // An offer the owner let lapse (the request is back to pending): forget
        // that it was announced, so the next offer on it opens the screen again.
        if (user?.role === 'user' && status === 'pending' && payload.reason === 'offer_expired') {
            notifiedIds.current.delete(`${requestId}-offered`);
            return;
        }

        // 1. User Logic: Mechanic Found (Status: offered)
        // Instead of showing a popup, add to notifications section
        if (user?.role === 'user' && status === 'offered') {
            const currentSegments = segments as string[];
            const isSearchingOrFound = currentSegments.includes('searching') || currentSegments.includes('mechanic-found');

            notifiedIds.current.add(notificationKey);

            // Always shows up in the notifications tab
            reloadInboxSoon();

            // If user is NOT on the searching/mechanic-found screen, navigate them there
            if (!isSearchingOrFound) {
                router.push({
                    pathname: '/request-assistance/mechanic-found',
                    params: { requestId }
                });
            }

            return;
        }

        // 2. Mechanic Logic: Offer Accepted (Status: accepted)
        // Only the assigned mechanic: the same update is also broadcast to the
        // whole mechanics room to refresh feeds.
        const isMechanicForRequest = !!user?.id && user.id === payload.mechanicId;

        if (isMechanicForRequest && status === 'accepted') {
            notifiedIds.current.add(notificationKey);
            reloadInboxSoon();

            // Show custom notification popup for mechanic, saying which assistance was accepted.
            void describeRequest(requestId).then((highlight) =>
                popup(t('notificationsPopup.offerAcceptedTitle'), t('notificationsPopup.offerAcceptedBody'), () => {
                    router.push({
                        pathname: '/appointments/[id]',
                        params: { id: requestId }
                    }, { withAnchor: true });
                }, { tone: 'success', icon: 'checkmark-circle-outline' }, highlight?.value ? highlight : undefined),
            );
        }

        // 3. Mechanic Logic: Job Canceled (Status: canceled)
        if (isMechanicForRequest && isCancelledStatus(status)) {
            const key = `canceled-${requestId}`;
            if (notifiedIds.current.has(key)) return;
            notifiedIds.current.add(key);

            // Shows up in the notifications tab
            reloadInboxSoon();

            void describeRequest(requestId).then((highlight) =>
                popup(t('notificationsPopup.jobCanceledTitle'), t('notificationsPopup.jobCanceledBody'), () => {
                    router.navigate('/(tabs)/appointments');
                }, { tone: 'danger', icon: 'close-circle-outline' }, highlight?.value ? highlight : undefined),
            );
        }

    }, [lastMessage, user?.role, user?.id, segments]);

    return null;
}
