import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { NotificationsProvider, useNotifications } from '../NotificationsContext';

const mockListInbox = jest.fn();

jest.mock('@/context/UserContext', () => ({
    useUser: () => ({ user: { id: 'mech-1', role: 'mechanic' } }),
}));
jest.mock('@/lib/dao/NotificationDAO', () => ({
    notificationDAO: {
        listInbox: (...args: unknown[]) => mockListInbox(...args),
        markSeen: jest.fn().mockResolvedValue(undefined),
        markRead: jest.fn().mockResolvedValue(0),
        deleteInbox: jest.fn().mockResolvedValue(undefined),
        deleteAllInbox: jest.fn().mockResolvedValue(undefined),
    },
}));
jest.mock('@/modules/app-badge', () => ({ clearAppBadge: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/i18n', () => ({ __esModule: true, default: { language: 'en', on: jest.fn(), off: jest.fn() } }));
jest.mock('@/lib/notifications/push', () => ({ syncPushRegistration: jest.fn().mockResolvedValue(true) }));

const item = (id: string, kind: string, read: boolean, minutesAgo: number) => ({
    id, kind, title: kind, body: '', read, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});

const wrapper = ({ children }: { children: React.ReactNode }) => <NotificationsProvider>{children}</NotificationsProvider>;

describe('NotificationsProvider', () => {
    beforeEach(() => jest.clearAllMocks());

    it('does not list new requests, and takes them out of the totals the backend sends', async () => {
        mockListInbox.mockResolvedValue({
            items: [
                item('a', 'new_request', false, 1),
                item('b', 'offer_accepted', false, 2),
                item('c', 'new_request', true, 3),
                item('d', 'request_status', true, 4),
            ],
            total: 4,
            unread: 2,
        });
        const { result } = renderHook(() => useNotifications(), { wrapper });
        await waitFor(() => expect(result.current.notifications.length).toBe(2));
        expect(result.current.notifications.map((n) => n.id)).toEqual(['b', 'd']);
        // 4 on the backend, 2 of them left out; 2 unread there, 1 of them left out
        expect(result.current.totals).toEqual({ all: 2, unread: 1 });
    });

    it('pages from the last item the backend sent, listed or not', async () => {
        const first = Array.from({ length: 30 }, (_, i) => item(`n${i}`, i === 29 ? 'new_request' : 'request_status', true, i + 1));
        mockListInbox.mockResolvedValueOnce({ items: first, total: 40, unread: 0 });
        mockListInbox.mockResolvedValueOnce({ items: [item('older', 'request_status', true, 90)], total: 40, unread: 0 });
        const { result } = renderHook(() => useNotifications(), { wrapper });
        await waitFor(() => expect(result.current.notifications.length).toBe(29));
        await act(async () => { await result.current.loadMore(); });
        expect(mockListInbox.mock.calls[1][0].before).toBe(new Date(first[29].createdAt).toISOString());
        expect(result.current.notifications.length).toBe(30);
    });
});
