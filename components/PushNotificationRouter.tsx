import {
    getInitialNotification,
    getMessaging,
    onMessage,
    onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useUser } from '@/context/UserContext';
import { showInAppBanner } from '@/lib/notifications/inAppAlerts';
import i18n from '@/lib/i18n';
import {
    isForActiveRole,
    notifyCancellationDisputePush,
    routeForPush,
    syncPushRegistration,
    watchPushToken,
    type PushData,
    type RemoteMessage,
} from '@/lib/notifications/push';

/**
 * Push notifications, glue side. Renders nothing.
 *
 * - Registers this phone while someone is signed in: once with the system
 *   prompt when the session starts (iOS and Android only ever show it once),
 *   then silently on every return to the foreground and on token rotation.
 * - Opens the right screen when a push is tapped, whether the app was in the
 *   background or closed (cold start).
 * - Passes on cancellation-dispute pushes that arrive in the foreground, so an
 *   open appointment refreshes its charge/compensation banner.
 *
 * Mounted inside AppShell, after the session check, so the router is ready and
 * the signed-in user is known.
 */
export function PushNotificationRouter() {
    const router = useRouter();
    const { user } = useUser();
    const userId = user?.id;
    const role = user?.role;
    const handledInitial = useRef(false);
    const handledMessageIds = useRef(new Set<string>());
    const pendingRoute = useRef<Href | null>(null);
    const [pendingTick, setPendingTick] = useState(0);
    const navState = useRootNavigationState();
    const navReady = !!navState?.key;

    // Registration follows the session and the active role: the phone is saved
    // with the role in use, and only gets that role's pushes. Switching role
    // re-registers it, so the other role's pushes stop.
    useEffect(() => {
        if (!userId || !role) return;
        void syncPushRegistration({ ask: true });
        const stopWatching = watchPushToken();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') void syncPushRegistration({ ask: false });
        });
        return () => {
            stopWatching();
            sub.remove();
        };
    }, [userId, role]);

    // Tapped pushes. Only for a signed-in person: signed out, the target
    // screens would bounce to login anyway. A push meant for another account
    // (this phone changed hands) is ignored — the app just opens.
    //
    // A tap that opens the app can arrive before the root navigator has
    // mounted; navigating then throws ("Attempted to navigate before mounting
    // the Root Layout"), and from the onNotificationOpenedApp callback that
    // throw is uncaught and closes a release build. So a tap only records the
    // target, and the effect below navigates once the navigator is ready.
    useEffect(() => {
        if (!userId || !role) return;
        const open = (message: RemoteMessage | null) => {
            if (!message) return;
            // The launch tap can be delivered by both getInitialNotification
            // and onNotificationOpenedApp: navigate once.
            const key = message.messageId;
            if (key) {
                if (handledMessageIds.current.has(key)) return;
                handledMessageIds.current.add(key);
            }
            try {
                const route = routeForPush(message.data as PushData | undefined, { id: userId, role });
                if (route) {
                    pendingRoute.current = route;
                    setPendingTick((n) => n + 1);
                }
            } catch (err) {
                console.warn('[push] could not resolve the tapped notification', err);
            }
        };

        const messaging = getMessaging();
        if (!handledInitial.current) {
            handledInitial.current = true;
            getInitialNotification(messaging).then(open).catch(() => undefined);
        }
        return onNotificationOpenedApp(messaging, open);
    }, [userId, role]);

    // Pushes that arrive while the app is open: a cancellation-dispute push
    // refreshes the open detail screen's banner. Nothing navigates here.
    useEffect(() => {
        if (!userId || !role) return;
        return onMessage(getMessaging(), async (message) => {
            const data = message.data as PushData | undefined;
            if (data?.recipientId && data.recipientId !== userId) return;
            if (!isForActiveRole(data, role)) return;
            notifyCancellationDisputePush(data);
            // The system shows nothing while the app is open: a new request gets a small alert on screen instead
            // (unless the technician turned it off in Settings → Notifications).
            if (data?.kind === 'new_request') {
                const id = message.messageId ?? data.requestId ?? String(Date.now());
                void showInAppBanner({
                    id,
                    title: message.notification?.title || i18n.t('inAppAlert.newRequestTitle'),
                    body: message.notification?.body || i18n.t('inAppAlert.newRequestBody'),
                    route: routeForPush(data, { id: userId, role }),
                });
            }
        });
    }, [userId, role]);

    // Navigates to the recorded target once the root navigator is mounted.
    // Deferred one tick so it lands after the start-up <Redirect> in app/index.
    useEffect(() => {
        if (!navReady || !pendingRoute.current) return;
        const timer = setTimeout(() => {
            const route = pendingRoute.current;
            pendingRoute.current = null;
            if (!route) return;
            try {
                // navigate, not push: this runs from the root, where a push
                // that diverges at the root stack (start-up, before the tabs
                // have their state) stacks a second (tabs) on top of the first.
                // navigate reuses the (tabs) entry that is already there.
                router.navigate(route, { withAnchor: true });
            } catch (err) {
                console.warn('[push] could not open the tapped notification', err);
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [navReady, pendingTick, router]);

    return null;
}
