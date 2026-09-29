jest.mock('@react-native-firebase/messaging', () => ({
    AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
    getMessaging: jest.fn(() => ({})),
    setBackgroundMessageHandler: jest.fn(),
    getToken: jest.fn(),
    deleteToken: jest.fn(),
    hasPermission: jest.fn(),
    requestPermission: jest.fn(),
    onTokenRefresh: jest.fn(),
}));
jest.mock('../i18n', () => ({ __esModule: true, default: { language: 'es' } }));
jest.mock('../dao/NotificationDAO', () => ({ notificationDAO: {} }));

import { routeForPush } from '../notifications/push';

describe('routeForPush', () => {
    it('opens the request for a mechanic told about a new one', () => {
        expect(routeForPush({ kind: 'new_request', requestId: 'req-1' })).toEqual({
            pathname: '/assist/[id]',
            params: { id: 'req-1' },
        });
    });

    it('opens the offer for a customer whose mechanic was found', () => {
        expect(routeForPush({ kind: 'mechanic_found', requestId: 'req-1' })).toEqual({
            pathname: '/request-assistance/mechanic-found',
            params: { requestId: 'req-1' },
        });
    });

    it('opens the appointment for progress and accepted offers', () => {
        const expected = { pathname: '/appointments/[id]', params: { id: 'req-1' } };
        expect(routeForPush({ kind: 'request_status', appointmentId: 'req-1', status: 'arrived' })).toEqual(expected);
        expect(routeForPush({ kind: 'offer_accepted', requestId: 'req-1' })).toEqual(expected);
    });

    it('opens the appointments list for a cancellation', () => {
        expect(routeForPush({ kind: 'request_canceled', requestId: 'req-1' })).toBe('/appointments');
    });

    it('opens the video lobby for a call', () => {
        expect(routeForPush({ kind: 'video_call', appointmentId: 'req-1' })).toEqual({
            pathname: '/video-lobby/[id]',
            params: { id: 'req-1' },
        });
    });

    it('leads nowhere for unknown or empty data', () => {
        expect(routeForPush(undefined)).toBeNull();
        expect(routeForPush({})).toBeNull();
        expect(routeForPush({ kind: 'something_new' })).toBeNull();
    });
});
