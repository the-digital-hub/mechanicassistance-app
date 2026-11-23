jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/dao/OnSiteDAO', () => ({ onSiteDAO: { get: jest.fn() } }));

import { lacksObdReport } from '../useObdPending';

describe('lacksObdReport', () => {
    it('is true when the visit has no report or a failed one, closed or not', () => {
        expect(lacksObdReport({ obdStatus: 'none' })).toBe(true);
        expect(lacksObdReport({ obdStatus: 'failed' })).toBe(true);
    });

    it('is false once a report is in (or being read), and without a visit', () => {
        expect(lacksObdReport({ obdStatus: 'processing' })).toBe(false);
        expect(lacksObdReport({ obdStatus: 'ready' })).toBe(false);
        expect(lacksObdReport(null)).toBe(false);
    });
});
