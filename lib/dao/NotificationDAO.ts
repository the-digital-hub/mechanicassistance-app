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
}

export const notificationDAO = new NotificationDAO();
