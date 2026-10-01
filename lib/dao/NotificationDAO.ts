import { apiClient } from '../api/apiClient';

export type PushPlatform = 'ios' | 'android';

export interface RegisterDeviceInput {
    /** FCM registration token from `messaging().getToken()` (iOS included). */
    token: string;
    platform: PushPlatform;
    /** App language, e.g. 'es' — picks the language of the notification text. */
    locale?: string;
    appVersion?: string;
}

/** The phone as the backend saved it. The token is deliberately not echoed. */
export interface RegisteredDevice {
    id: string;
    platform: PushPlatform;
    locale: string;
    appVersion: string | null;
    /** UTC, ISO 8601. */
    lastSeenAt: string;
}

/** One notification from the backend inbox (notifications-service). */
export interface InboxItem {
    id: string;
    /** new_request, mechanic_found, offer_accepted, request_status, request_canceled, video_call. */
    kind: string;
    title: string;
    body: string;
    requestId?: string;
    appointmentId?: string;
    status?: string;
    /** UTC, ISO 8601. */
    createdAt: string;
    read: boolean;
}

export interface InboxPage {
    /** Newest first. */
    items: InboxItem[];
    /** Arrived since the app was last opened — the number on the app icon. */
    unseen: number;
}

/**
 * Push notification registration (notifications-service, through the gateway
 * at /api/notifications/devices). The backend decides what to push and when;
 * the app only says which phone should receive it.
 */
class NotificationDAO {
    /** Registers or refreshes this phone for the signed-in person. Idempotent. */
    async registerDevice(input: RegisterDeviceInput): Promise<RegisteredDevice> {
        return apiClient.post<RegisteredDevice>('/api/notifications/devices', input);
    }

    /**
     * Stops pushes to this phone for the signed-in person. Needs the access
     * token, so it has to run before the session is cleared. The token goes in
     * the body, not the URL, to keep it out of access logs.
     */
    async unregisterDevice(token: string): Promise<boolean> {
        const result = await apiClient.delete<{ removed: boolean }>(
            '/api/notifications/devices',
            { token },
        );
        return result.removed;
    }

    /** The signed-in person's notifications, newest first, text in `locale`. */
    async listInbox(opts: { locale?: string; before?: string; limit?: number } = {}): Promise<InboxPage> {
        return apiClient.get<InboxPage>('/api/notifications/inbox', opts);
    }

    /** The app was opened: clears the number on the icon for the next push. */
    async markSeen(): Promise<void> {
        await apiClient.post('/api/notifications/inbox/seen', {});
    }

    /** Marks every notification read (and seen). Answers how many changed. */
    async markRead(): Promise<number> {
        const result = await apiClient.post<{ marked: number }>('/api/notifications/inbox/read', {});
        return result.marked;
    }
}

export const notificationDAO = new NotificationDAO();
