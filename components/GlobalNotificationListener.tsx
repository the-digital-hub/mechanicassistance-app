import { useNotifications } from '@/context/NotificationsContext';
import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

/** How long the backend takes, roughly, to record a notification after the socket event. */
const INBOX_LAG_MS = 3000;

export function GlobalNotificationListener() {
    const { user } = useUser();
    const { lastMessage } = useSocket();
    const router = useRouter();
    const segments = useSegments();
    const { refresh, markSeen } = useNotifications();

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

    // Local state for custom notification UI (mechanic-side only)
    const [notification, setNotification] = useState<{ title: string, body: string, action: () => void } | null>(null);

    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type !== 'assistance_update') return;

        const payload = lastMessage.payload;
        const requestId = payload.id || payload.requestId;
        const { status } = payload;

        // Prevent duplicate notifications for the same event
        const notificationKey = `${requestId}-${status}`;
        if (notifiedIds.current.has(notificationKey)) return;

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

            // Show custom notification popup for mechanic
            setNotification({
                title: 'Offer Accepted!',
                body: 'The user has accepted your offer to help.',
                action: () => {
                    setNotification(null);
                    router.push({
                        pathname: '/appointments/[id]',
                        params: { id: requestId }
                    });
                }
            });
        }

        // 3. Mechanic Logic: Job Canceled (Status: canceled)
        if (isMechanicForRequest && status === 'canceled') {
            const key = `canceled-${requestId}`;
            if (notifiedIds.current.has(key)) return;
            notifiedIds.current.add(key);

            // Shows up in the notifications tab
            reloadInboxSoon();

            setNotification({
                title: 'Job Canceled',
                body: 'The user has canceled this request.',
                action: () => {
                    setNotification(null);
                    router.replace('/(tabs)/appointments');
                }
            });
        }

    }, [lastMessage, user?.role, user?.id, segments]);

    if (!notification) return null;

    return (
        // Full-screen overlay — centers the modal
        <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            paddingHorizontal: 24,
        }}>
            <View style={{
                backgroundColor: 'white',
                padding: 24,
                borderRadius: 16,
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 10,
            }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 8 }}>{notification.title}</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 20 }}>{notification.body}</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                    <TouchableOpacity onPress={() => setNotification(null)}>
                        <Text style={{ color: '#6b7280', fontWeight: '600' }}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={notification.action}
                        style={{ backgroundColor: '#1e3a8a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>OK</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
