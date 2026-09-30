import {
    getInitialNotification,
    getMessaging,
    onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useUser } from '@/context/UserContext';
import {
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

    // Registration follows the session.
    useEffect(() => {
        if (!userId) return;
        void syncPushRegistration({ ask: true });
        const stopWatching = watchPushToken();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') void syncPushRegistration({ ask: false });
        });
        return () => {
            stopWatching();
            sub.remove();
        };
    }, [userId]);

    // Tapped pushes. Only for a signed-in person: signed out, the target
    // screens would bounce to login anyway. A push meant for another account
    // (this phone changed hands) is ignored — the app just opens.
    useEffect(() => {
        if (!userId || !role) return;
        const open = (message: RemoteMessage | null) => {
            const route = routeForPush(message?.data as PushData | undefined, { id: userId, role });
            if (route) router.push(route);
        };

        const messaging = getMessaging();
        if (!handledInitial.current) {
            handledInitial.current = true;
            getInitialNotification(messaging).then(open).catch(() => undefined);
        }
        return onNotificationOpenedApp(messaging, open);
    }, [userId, role, router]);

    return null;
}
