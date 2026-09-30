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

const mechanic = { id: 'mech-1', role: 'mechanic' as const };
const customer = { id: 'client-1', role: 'user' as const };

describe('routeForPush', () => {
    it('opens the request for a mechanic told about a new one', () => {
        expect(routeForPush({ kind: 'new_request', requestId: 'req-1' }, mechanic)).toEqual({
            pathname: '/assist/[id]',
            params: { id: 'req-1' },
        });
    });

    it('opens the offer for a customer whose mechanic was found', () => {
        expect(routeForPush({ kind: 'mechanic_found', requestId: 'req-1' }, customer)).toEqual({
            pathname: '/request-assistance/mechanic-found',
            params: { requestId: 'req-1' },
        });
    });

    it('opens the appointment for progress and accepted offers', () => {
        const expected = { pathname: '/appointments/[id]', params: { id: 'req-1' } };
        expect(routeForPush({ kind: 'request_status', appointmentId: 'req-1', status: 'arrived' }, customer)).toEqual(expected);
        expect(routeForPush({ kind: 'offer_accepted', requestId: 'req-1' }, mechanic)).toEqual(expected);
    });

    it('opens the appointments list for a cancellation', () => {
        expect(routeForPush({ kind: 'request_canceled', requestId: 'req-1' }, customer)).toBe('/appointments');
    });

    it('opens the video lobby for a call', () => {
        expect(routeForPush({ kind: 'video_call', appointmentId: 'req-1' }, customer)).toEqual({
            pathname: '/video-lobby/[id]',
            params: { id: 'req-1' },
        });
    });

    it('leads nowhere for unknown or empty data', () => {
        expect(routeForPush(undefined, customer)).toBeNull();
        expect(routeForPush({}, customer)).toBeNull();
        expect(routeForPush({ kind: 'something_new' }, customer)).toBeNull();
    });

    it('leads nowhere for a push sent to another account', () => {
        expect(
            routeForPush({ kind: 'mechanic_found', requestId: 'req-1', recipientId: 'someone-else' }, customer),
        ).toBeNull();
        expect(
            routeForPush({ kind: 'mechanic_found', requestId: 'req-1', recipientId: 'client-1' }, customer),
        ).not.toBeNull();
    });

    it('never opens a mechanic screen for a customer, or the reverse', () => {
        expect(routeForPush({ kind: 'new_request', requestId: 'req-1' }, customer)).toBeNull();
        expect(routeForPush({ kind: 'offer_accepted', requestId: 'req-1' }, customer)).toBeNull();
        expect(routeForPush({ kind: 'mechanic_found', requestId: 'req-1' }, mechanic)).toBeNull();
    });
});
