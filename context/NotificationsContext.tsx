import { ApiError } from '@/lib/api/types';
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
    /** The backend kind, untouched — what `routeForPush` needs to pick a screen. */
    kind: string;
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
    /**
     * Deletes them from the inbox on the backend, so they stay gone after a
     * restart and on other phones. Removed from the list at once; put back if
     * the backend call fails. Never throws: `ok: false` carries the HTTP status
     * when the server answered, none when it was unreachable.
     */
    deleteNotifications: (ids: string[]) => Promise<DeleteResult>;
    /** Deletes every notification of the role on the backend (only unread ones with `onlyUnread`). */
    deleteAll: (onlyUnread: boolean) => Promise<DeleteResult>;
    /** Real totals from the backend, not the size of the loaded list. */
    totals: { all: number; unread: number };
    /** More older notifications to load. */
    hasMore: boolean;
    loadingMore: boolean;
    /** Loads the next (older) page and appends it. Never throws. */
    loadMore: () => Promise<void>;
    /** The "Unread" tab: the list pages over unread notifications only. */
    setUnreadOnly: (on: boolean) => void;
}

type DeleteResult = { ok: boolean; status?: number };

const PAGE_SIZE = 30;

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

function formatTime(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

/**
 * Kinds the backend keeps in the inbox that the app does not list. A new request is an opportunity that goes stale (another
 * technician takes it, or it expires) and the technician already has it live in the feed and in the in-app alert; as a
 * list item it only piles up and opens a request that may be gone. It still arrives as a push.
 */
const NOT_LISTED: ReadonlySet<string> = new Set(['new_request']);

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
        kind: item.kind,
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
    // Each role (vehicle owner, mechanic) has its own inbox on the backend:
    // switching role reloads the list and the icon number for the new one.
    const role = user?.role;
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [totals, setTotals] = useState({ all: 0, unread: 0 });
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const hidden = useRef<Set<string>>(new Set());
    // Mirrors of state for callbacks that must not go stale or re-create.
    const listRef = useRef<AppNotification[]>([]);
    listRef.current = notifications;
    const loadingMoreRef = useRef(false);

    // What was left out of the list (id -> was unread), so the totals the backend sends — which count it — can be corrected.
    const skipped = useRef<Map<string, boolean>>(new Map());
    // Where the next older page starts: the last item the backend sent, listed or not.
    const cursor = useRef<number | null>(null);

    /** The items to list from a page; the left-out ones are only counted. */
    const listable = useCallback((items: InboxItem[]): AppNotification[] => {
        for (const i of items) {
            if (NOT_LISTED.has(i.kind)) skipped.current.set(i.id, !i.read);
        }
        const last = items[items.length - 1];
        if (last) cursor.current = new Date(last.createdAt).getTime();
        return items.filter((i) => !NOT_LISTED.has(i.kind) && !hidden.current.has(i.id)).map(toAppNotification);
    }, []);

    const applyTotals = useCallback((page: { total?: number; unread?: number }, loaded: AppNotification[]) => {
        const skippedUnread = [...skipped.current.values()].filter(Boolean).length;
        // Older backends send no totals: fall back to what was loaded.
        setTotals({
            all: page.total !== undefined ? Math.max(0, page.total - skipped.current.size) : loaded.length,
            unread: page.unread !== undefined ? Math.max(0, page.unread - skippedUnread) : loaded.filter((n) => n.unread).length,
        });
    }, []);

    const refresh = useCallback(async () => {
        if (!userId) return;
        try {
            const page = await notificationDAO.listInbox({
                locale: i18next.language || undefined,
                limit: PAGE_SIZE,
                unread: unreadOnly || undefined,
            });
            skipped.current.clear();
            const list = listable(page.items);
            setNotifications(list);
            setHasMore(page.items.length === PAGE_SIZE);
            applyTotals(page, list);
        } catch (err) {
            console.warn('[inbox] load failed:', (err as Error).message);
        }
    }, [userId, unreadOnly, applyTotals, listable]);

    const loadMore = useCallback(async () => {
        if (!userId || cursor.current === null || !hasMore || loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        try {
            const page = await notificationDAO.listInbox({
                locale: i18next.language || undefined,
                limit: PAGE_SIZE,
                before: new Date(cursor.current).toISOString(),
                unread: unreadOnly || undefined,
            });
            const more = listable(page.items);
            setNotifications((prev) => {
                const known = new Set(prev.map((n) => n.id));
                return [...prev, ...more.filter((n) => !known.has(n.id))];
            });
            setHasMore(page.items.length === PAGE_SIZE);
            if (page.total !== undefined && page.unread !== undefined) {
                applyTotals(page, []);
            }
        } catch (err) {
            console.warn('[inbox] load more failed:', (err as Error).message);
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [userId, hasMore, unreadOnly, listable, applyTotals]);

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
            setTotals({ all: 0, unread: 0 });
            setHasMore(false);
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
    }, [userId, role, markSeen, refresh]);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
        setTotals(prev => ({ ...prev, unread: 0 }));
        notificationDAO.markRead().catch((err) =>
            console.warn('[inbox] mark read failed:', (err as Error).message),
        );
    }, []);

    // `hidden` keeps a refresh that is already in flight from bringing back
    // what is being deleted; once the backend has them hidden, it never lists them.
    const deleteNotifications = useCallback(async (ids: string[]): Promise<DeleteResult> => {
        if (ids.length === 0) return { ok: true };
        const gone = new Set(ids);
        const removed = listRef.current.filter((n) => gone.has(n.id));
        ids.forEach((id) => hidden.current.add(id));
        setNotifications(prev => prev.filter(n => !gone.has(n.id)));
        setTotals(prev => ({
            all: Math.max(0, prev.all - removed.length),
            unread: Math.max(0, prev.unread - removed.filter((n) => n.unread).length),
        }));
        try {
            await notificationDAO.deleteInbox(ids);
            // Keep the screen full: bring older ones in when few are left.
            if (listRef.current.length < PAGE_SIZE / 2) void loadMore();
            return { ok: true };
        } catch (err) {
            console.warn('[inbox] delete failed:', (err as Error).message);
            ids.forEach((id) => hidden.current.delete(id));
            void refresh();
            return { ok: false, status: err instanceof ApiError ? err.statusCode : undefined };
        }
    }, [refresh, loadMore]);

    const deleteAll = useCallback(async (onlyUnread: boolean): Promise<DeleteResult> => {
        if (onlyUnread) {
            setNotifications(prev => prev.filter(n => !n.unread));
            setTotals(prev => ({ all: Math.max(0, prev.all - prev.unread), unread: 0 }));
        } else {
            setNotifications([]);
            setTotals({ all: 0, unread: 0 });
            setHasMore(false);
        }
        try {
            await notificationDAO.deleteAllInbox(onlyUnread);
            void refresh();
            return { ok: true };
        } catch (err) {
            console.warn('[inbox] delete all failed:', (err as Error).message);
            void refresh();
            return { ok: false, status: err instanceof ApiError ? err.statusCode : undefined };
        }
    }, [refresh]);

    const value = useMemo(
        () => ({
            notifications,
            refresh,
            markSeen,
            markAllRead,
            deleteNotifications,
            deleteAll,
            totals,
            hasMore,
            loadingMore,
            loadMore,
            setUnreadOnly,
        }),
        [notifications, refresh, markSeen, markAllRead, deleteNotifications, deleteAll, totals, hasMore, loadingMore, loadMore],
    );

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
    return ctx;
}
