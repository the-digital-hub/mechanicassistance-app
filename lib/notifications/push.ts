import {
    AuthorizationStatus,
    deleteToken,
    getMessaging,
    getToken,
    hasPermission,
    onTokenRefresh,
    requestPermission,
    setBackgroundMessageHandler,
    type RemoteMessage as FirebaseRemoteMessage,
} from '@react-native-firebase/messaging';
import Constants from 'expo-constants';
import type { Href } from 'expo-router';
import { PermissionsAndroid, Platform } from 'react-native';
import i18next from '../i18n';
import { withTimeout } from '../api/apiClient';
import { notificationDAO } from '../dao/NotificationDAO';
import { requestPostNotifications } from '../../modules/app-badge';

/**
 * Push notifications, app side.
 *
 * Delivery is FCM on both platforms (APNs behind it for iOS), so the token is
 * always `messaging().getToken()`. The backend (notifications-service) decides
 * what to push; the app only registers the phone, and routes a tapped push to
 * its screen. While the app is open nothing is shown — the socket and
 * GlobalNotificationListener already cover that, and a banner on top would
 * say everything twice (firebase.json turns iOS foreground banners off; on
 * Android FCM never shows `notification` messages in the foreground).
 */

// A `notification` message in the background is displayed by the OS itself;
// the handler only has to exist so RNFB does not warn that none is set.
setBackgroundMessageHandler(getMessaging(), async () => undefined);

const granted = (s: number) =>
    s === AuthorizationStatus.AUTHORIZED || s === AuthorizationStatus.PROVISIONAL;

async function androidPermission(ask: boolean): Promise<boolean> {
    // Before Android 13 posting notifications needs no runtime permission.
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (await PermissionsAndroid.check(permission)) return true;
    if (!ask) return false;
    // Through Expo's permission queue, not PermissionsAndroid.request: the two
    // overlapping (this prompt and a location or camera request) left Expo's
    // queue stuck, and the camera stopped opening until the app restarted.
    const viaExpo = await requestPostNotifications();
    if (viaExpo !== null) return viaExpo;
    return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

async function permitted(ask: boolean): Promise<boolean> {
    if (Platform.OS === 'android') return androidPermission(ask);
    const messaging = getMessaging();
    const status = ask ? await requestPermission(messaging) : await hasPermission(messaging);
    return granted(status);
}

async function register(token: string): Promise<void> {
    await notificationDAO.registerDevice({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        locale: i18next.language || undefined,
        appVersion: Constants.expoConfig?.version,
    });
}

/**
 * Registers this phone for the signed-in person.
 *
 * `ask: true` shows the system prompt if the person has not answered it yet —
 * call it at a moment where the reason is obvious (right after signing in,
 * or after posting a request), never on cold start. `ask: false` only
 * refreshes the registration when permission was already given; safe on
 * every app start and every return to the foreground.
 *
 * Never throws: push is a convenience, and a failure here must not break
 * sign-in. Answers whether the phone is now registered.
 */
export async function syncPushRegistration(options: { ask: boolean }): Promise<boolean> {
    try {
        if (!(await permitted(options.ask))) return false;
        const token = await getToken(getMessaging());
        if (!token) return false;
        await register(token);
        return true;
    } catch (err) {
        console.warn('[push] registration failed:', (err as Error).message);
        return false;
    }
}

/**
 * FCM rotates tokens now and then; re-register whenever it does. Returns the
 * unsubscribe function. Only meaningful while someone is signed in.
 */
export function watchPushToken(): () => void {
    return onTokenRefresh(getMessaging(), (token) => {
        register(token).catch((err) =>
            console.warn('[push] re-registration failed:', (err as Error).message),
        );
    });
}

/** Upper bound on one FCM token call (they have no timeout of their own). */
const FCM_TIMEOUT_MS = 3000;

/**
 * Stops pushes to this phone. Must run BEFORE the session is cleared: the
 * backend call needs the access token. Deleting the FCM token afterwards means
 * the next person to sign in on this phone gets a fresh one. Never throws.
 *
 * The FCM calls are bounded: on iOS without an APNs token `getToken` can hang
 * forever, and logout awaits this — the button looked dead.
 */
export async function disablePush(): Promise<void> {
    try {
        const messaging = getMessaging();
        const token = await withTimeout(getToken(messaging), FCM_TIMEOUT_MS, null);
        if (token) await notificationDAO.unregisterDevice(token);
        await withTimeout(deleteToken(messaging), FCM_TIMEOUT_MS, undefined);
    } catch (err) {
        console.warn('[push] unregistration failed:', (err as Error).message);
    }
}

/**
 * The session died without a logout, so the backend can no longer be told to
 * drop this phone. Deleting the FCM token locally is the next best thing: the
 * old token stops working, notifications-service prunes it on its next send,
 * and whoever signs in next registers a fresh one. Never throws.
 */
export async function forgetPushToken(): Promise<void> {
    try {
        await withTimeout(deleteToken(getMessaging()), FCM_TIMEOUT_MS, undefined);
    } catch (err) {
        console.warn('[push] token deletion failed:', (err as Error).message);
    }
}

/** What notifications-service puts in `data` (all strings, FCM rule). */
export interface PushData {
    kind?: string;
    /** Who the push was sent to. Missing on pushes sent before it existed. */
    recipientId?: string;
    /**
     * The side it is for: vehicle owner (`user`) or `mechanic`. Missing when the
     * backend could not tell, and on pushes sent before it existed.
     */
    recipientRole?: string;
    requestId?: string;
    appointmentId?: string;
    status?: string;
    /** chat_message_created: the chat to open (its appointment id). */
    conversationId?: string;
}

/** Who is signed in when a push is tapped. */
export interface PushViewer {
    id: string;
    role: 'mechanic' | 'user';
}

/**
 * Kinds that only make sense for one role: their screens assume it. Same list
 * as notifications-service (dispatch-rules ROLE_OF_KIND). Used when the push
 * does not say its `recipientRole` (older pushes).
 */
const ROLE_OF_KIND: Partial<Record<string, PushViewer['role']>> = {
    new_request: 'mechanic',
    offer_accepted: 'mechanic',
    offer_not_selected: 'mechanic',
    final_quote_approved: 'mechanic',
    final_quote_rejected: 'mechanic',
    obd_reminder: 'mechanic',
    video_call_confirmed: 'mechanic',
    video_call_disputed: 'mechanic',
    service_confirmed: 'mechanic',
    service_disputed: 'mechanic',
    mechanic_found: 'user',
    request_reopened: 'user',
    final_quote_proposed: 'user',
    request_status: 'user',
    service_redirected: 'user',
    review_requested: 'user',
    video_call_finished: 'user',
    service_awaiting_confirmation: 'user',
};

/**
 * Whether a push is for the role the person is using now. A person can be
 * vehicle owner and mechanic; after switching, the backend stops pushing the
 * other role, but pushes already on their way (or left in the tray) still
 * arrive. Those are ignored: they wait in the other role's notifications.
 */
export function isForActiveRole(data: PushData | undefined, role: PushViewer['role']): boolean {
    if (!data?.kind) return true;
    const side = data.recipientRole ?? ROLE_OF_KIND[data.kind];
    return side !== 'user' && side !== 'mechanic' ? true : side === role;
}

/**
 * Where a tapped push leads. The backend sends the kind and the ids, never a
 * route — routes are this app's business. Unknown kinds lead nowhere, and so
 * does a push meant for someone other than `viewer`: a phone can change
 * accounts while its notifications stay in the tray.
 */
export function routeForPush(data: PushData | undefined, viewer: PushViewer): Href | null {
    if (!data?.kind) return null;
    if (data.recipientId && data.recipientId !== viewer.id) return null;
    if (!isForActiveRole(data, viewer.role)) return null;
    const appointmentId = data.appointmentId ?? data.requestId;
    switch (data.kind) {
        case 'new_request':
            return data.requestId
                ? { pathname: '/assist/[id]', params: { id: data.requestId } }
                : '/assist';
        case 'mechanic_found':
            return data.requestId
                ? { pathname: '/request-assistance/mechanic-found', params: { requestId: data.requestId } }
                : null;
        case 'offer_accepted':
        case 'request_status':
        case 'service_redirected':
            return appointmentId
                ? { pathname: '/appointments/[id]', params: { id: appointmentId } }
                : '/appointments';
        case 'request_canceled':
            return '/appointments';
        case 'review_requested':
            // The mechanic asked the customer to rate them, from the close-out screen.
            return appointmentId
                // Typed routes regenerate on the next dev-server start; until then the new route is unknown.
                ? { pathname: '/appointments/review/[id]' as never, params: { id: appointmentId } }
                : '/appointments';
        case 'obd_reminder':
            // The dashboard opens the same report sheet as its "Needs your attention" alert (swipeable, one page per visit pending),
            // on the visit the reminder is about.
            return { pathname: '/(tabs)/dashboard' as never, params: appointmentId ? { obd: appointmentId } : { obd: '1' } };
        case 'video_call_finished':
        case 'video_call_confirmed':
        case 'video_call_disputed':
        case 'video_call_resolved':
        case 'video_call_reminder':
            // Video call close-out: the detail screen shows the confirm / dispute / outcome card.
            return appointmentId
                ? { pathname: '/appointments/[id]', params: { id: appointmentId } }
                : '/appointments';
        case 'service_awaiting_confirmation':
        case 'service_confirmed':
        case 'service_disputed':
        case 'service_dispute_resolved':
            // On-site close-out: the owner confirms or disputes the visit there;
            // the mechanic sees whether it was confirmed, disputed or settled.
            return appointmentId
                ? { pathname: '/appointments/[id]', params: { id: appointmentId } }
                : '/appointments';
        case 'cancellation_disputed':
        case 'cancellation_dispute_resolved':
            // Cancelled after the mechanic headed out: the detail screen shows the
            // charge (owner) or compensation (mechanic) banner.
            return appointmentId
                ? { pathname: '/appointments/[id]', params: { id: appointmentId } }
                : '/appointments';
        case 'video_call':
            return appointmentId
                ? { pathname: '/video-lobby/[id]', params: { id: appointmentId } }
                : null;
        case 'chat_message_created': {
            const chatId = data.conversationId ?? appointmentId;
            return chatId ? { pathname: '/chat/[id]', params: { id: chatId } } : null;
        }
        default:
            return null;
    }
}

export type RemoteMessage = FirebaseRemoteMessage;

/** Push kinds that change an appointment's cancellation dispute. */
export const CANCELLATION_DISPUTE_KINDS: ReadonlySet<string> = new Set(['cancellation_disputed', 'cancellation_dispute_resolved']);

type DisputePushListener = (appointmentId: string) => void;
const disputePushListeners = new Set<DisputePushListener>();

/**
 * A cancellation-dispute push arrived while the app was open. The detail screen
 * listens to refetch its banner; PushNotificationRouter is the only emitter.
 */
export function onCancellationDisputePush(listener: DisputePushListener): () => void {
    disputePushListeners.add(listener);
    return () => {
        disputePushListeners.delete(listener);
    };
}

/** Tells listeners about a foreground push, if it is a cancellation-dispute one. */
export function notifyCancellationDisputePush(data: PushData | undefined): void {
    if (!data?.kind || !CANCELLATION_DISPUTE_KINDS.has(data.kind)) return;
    const appointmentId = data.appointmentId ?? data.requestId;
    if (!appointmentId) return;
    disputePushListeners.forEach((listener) => listener(appointmentId));
}
