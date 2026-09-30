import {
    AuthorizationStatus,
    deleteToken,
    getMessaging,
    getToken,
    hasPermission,
    onTokenRefresh,
    requestPermission,
    setBackgroundMessageHandler,
    type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import Constants from 'expo-constants';
import type { Href } from 'expo-router';
import { PermissionsAndroid, Platform } from 'react-native';
import i18next from '../i18n';
import { notificationDAO } from '../dao/NotificationDAO';

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

/**
 * Stops pushes to this phone. Must run BEFORE the session is cleared: the
 * backend call needs the access token. Deleting the FCM token afterwards means
 * the next person to sign in on this phone gets a fresh one. Never throws.
 */
export async function disablePush(): Promise<void> {
    try {
        const messaging = getMessaging();
        const token = await getToken(messaging);
        if (token) await notificationDAO.unregisterDevice(token);
        await deleteToken(messaging);
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
        await deleteToken(getMessaging());
    } catch (err) {
        console.warn('[push] token deletion failed:', (err as Error).message);
    }
}

/** What notifications-service puts in `data` (all strings, FCM rule). */
export interface PushData {
    kind?: string;
    /** Who the push was sent to. Missing on pushes sent before it existed. */
    recipientId?: string;
    requestId?: string;
    appointmentId?: string;
    status?: string;
}

/** Who is signed in when a push is tapped. */
export interface PushViewer {
    id: string;
    role: 'mechanic' | 'user';
}

/**
 * Kinds that only make sense for one role: their screens assume it. A push
 * that reached the other role (an older push, from before `recipientId`,
 * left on a phone that changed accounts) leads nowhere.
 */
const ROLE_OF_KIND: Partial<Record<string, PushViewer['role']>> = {
    new_request: 'mechanic',
    offer_accepted: 'mechanic',
    mechanic_found: 'user',
};

/**
 * Where a tapped push leads. The backend sends the kind and the ids, never a
 * route — routes are this app's business. Unknown kinds lead nowhere, and so
 * does a push meant for someone other than `viewer`: a phone can change
 * accounts while its notifications stay in the tray.
 */
export function routeForPush(data: PushData | undefined, viewer: PushViewer): Href | null {
    if (!data?.kind) return null;
    if (data.recipientId && data.recipientId !== viewer.id) return null;
    const role = ROLE_OF_KIND[data.kind];
    if (role && role !== viewer.role) return null;
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
            return appointmentId
                ? { pathname: '/appointments/[id]', params: { id: appointmentId } }
                : '/appointments';
        case 'request_canceled':
            return '/appointments';
        case 'video_call':
            return appointmentId
                ? { pathname: '/video-lobby/[id]', params: { id: appointmentId } }
                : null;
        default:
            return null;
    }
}

export type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;
