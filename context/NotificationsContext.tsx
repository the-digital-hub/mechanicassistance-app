import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useUser } from '@/context/UserContext';
import { notificationDAO, type InboxItem } from '@/lib/dao/NotificationDAO';
import i18next from '@/lib/i18n';
import { clearAppBadge } from '@/modules/app-badge';

export interface AppNotification {
    id: string;
    /** The backend kind; `job_canceled` is what the app calls `request_canceled`. */
    type:
        | 'new_request'
        | 'mechanic_found'
        | 'offer_accepted'
        | 'request_status'
        | 'job_canceled'
        | 'video_call'
        | 'general';
    title: string;
    body: string;
    time: string; // e.g. "2m", "now"
    unread: boolean;
    requestId?: string;
    appointmentId?: string;
    status?: string;
    createdAt: number; // timestamp
}

interface NotificationsContextType {
    notifications: AppNotification[];
    /** Loads the inbox again from the backend. Never throws. */
    refresh: () => Promise<void>;
    /** Clears the number on the app icon (and the backend's count behind it). Never throws. */
    markSeen: () => Promise<void>;
    markAllRead: () => void;
    /** Hides it on this phone until the app restarts; the backend keeps it. */
    deleteNotification: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

function formatTime(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

const KNOWN: ReadonlySet<string> = new Set([
    'new_request',
    'mechanic_found',
    'offer_accepted',
    'request_status',
    'video_call',
]);

function toAppNotification(item: InboxItem): AppNotification {
    const createdAt = new Date(item.createdAt).getTime();
    const type: AppNotification['type'] =
        item.kind === 'request_canceled'
            ? 'job_canceled'
            : KNOWN.has(item.kind)
              ? (item.kind as AppNotification['type'])
              : 'general';
    return {
        id: item.id,
        type,
        title: item.title,
        body: item.body,
        time: formatTime(createdAt),
        unread: !item.read,
        requestId: item.requestId,
        appointmentId: item.appointmentId,
        status: item.status,
        createdAt,
    };
}

/**
 * The notifications screen and the number on the app icon, both backed by
 * notifications-service's inbox: every push the backend decided to send this
 * person, kept across restarts.
 *
 * The icon number is cleared whenever the app is opened or comes back to the
 * foreground — on the phone, and on the backend so the next push counts from 1.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
    const { user } = useUser();
    const userId = user?.id;
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const hidden = useRef<Set<string>>(new Set());

    const refresh = useCallback(async () => {
        if (!userId) return;
        try {
            const page = await notificationDAO.listInbox({ locale: i18next.language || undefined });
            setNotifications(page.items.filter((i) => !hidden.current.has(i.id)).map(toAppNotification));
        } catch (err) {
            console.warn('[inbox] load failed:', (err as Error).message);
        }
    }, [userId]);

    const markSeen = useCallback(async () => {
        await clearAppBadge();
        if (!userId) return;
        try {
            await notificationDAO.markSeen();
        } catch (err) {
            console.warn('[inbox] mark seen failed:', (err as Error).message);
        }
    }, [userId]);

    // Signed in, and every return to the foreground: fresh list, icon cleared.
    // Signed out: nothing to show, and nothing left on the icon.
    useEffect(() => {
        if (!userId) {
            setNotifications([]);
            hidden.current.clear();
            void clearAppBadge();
            return;
        }
        void markSeen();
        void refresh();
        const sub = AppState.addEventListener('change', (state) => {
            if (state !== 'active') return;
            void markSeen();
            void refresh();
        });
        return () => sub.remove();
    }, [userId, markSeen, refresh]);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
        notificationDAO.markRead().catch((err) =>
            console.warn('[inbox] mark read failed:', (err as Error).message),
        );
    }, []);

    const deleteNotification = useCallback((id: string) => {
        hidden.current.add(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const value = useMemo(
        () => ({ notifications, refresh, markSeen, markAllRead, deleteNotification }),
        [notifications, refresh, markSeen, markAllRead, deleteNotification],
    );

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
    return ctx;
}
