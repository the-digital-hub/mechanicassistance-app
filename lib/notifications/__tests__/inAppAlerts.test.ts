jest.mock('@react-native-async-storage/async-storage', () => {
    const store: Record<string, string> = {};
    return {
        __esModule: true,
        default: {
            getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
            setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
        },
    };
});

import { __resetInAppAlerts, dismissInAppBanner, getInAppAlertsEnabled, setInAppAlertsEnabled, showInAppBanner } from '../inAppAlerts';

const banner = (id: string) => ({ id, title: 'New request', body: 'Nearby', route: null });

beforeEach(() => __resetInAppAlerts());

describe('in-app alerts', () => {
    it('is on by default and shows an alert once per id', async () => {
        expect(await getInAppAlertsEnabled()).toBe(true);
        expect(await showInAppBanner(banner('a'))).toBe(true);
        dismissInAppBanner();
        expect(await showInAppBanner(banner('a'))).toBe(false);
        expect(await showInAppBanner(banner('b'))).toBe(true);
    });

    it('shows nothing once the technician turns it off', async () => {
        await setInAppAlertsEnabled(false);
        expect(await showInAppBanner(banner('c'))).toBe(false);
        await setInAppAlertsEnabled(true);
        expect(await showInAppBanner(banner('c'))).toBe(true);
    });
});

describe('routeIsCurrent', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { routeIsCurrent } = require('../inAppAlerts');

    it('is true when the alert would open the screen the person is on', () => {
        expect(routeIsCurrent({ pathname: '/appointments/[id]', params: { id: 'a1' } }, '/appointments/a1')).toBe(true);
        expect(routeIsCurrent('/appointments', '/appointments/')).toBe(true);
        expect(routeIsCurrent({ pathname: '/request-assistance/mechanic-found', params: { requestId: 'r' } }, '/request-assistance/mechanic-found')).toBe(true);
    });

    it('is false for another screen, another id or no route', () => {
        expect(routeIsCurrent({ pathname: '/appointments/[id]', params: { id: 'a1' } }, '/appointments/a2')).toBe(false);
        expect(routeIsCurrent('/appointments', '/dashboard')).toBe(false);
        expect(routeIsCurrent(null, '/dashboard')).toBe(false);
    });

    it('ignores route groups such as (tabs)', () => {
        expect(routeIsCurrent('/(tabs)/notifications', '/notifications')).toBe(true);
    });
});
