jest.mock('../../api/apiClient', () => ({ apiClient: {} }));

import { formatExpiry, isExpired, parseExpiry } from '../CertificationsDAO';

describe('certification expiry', () => {
    it('turns MM/YYYY into the last day of that month', () => {
        expect(parseExpiry('03/2027')).toBe('2027-03-31');
        expect(parseExpiry('2/2028')).toBe('2028-02-29');
        expect(parseExpiry(' 12 / 2026 ')).toBe('2026-12-31');
    });

    it('rejects anything that is not a month and a year', () => {
        for (const bad of ['', '13/2027', '00/2027', '3/27', '2027', 'ab/cdef']) expect(parseExpiry(bad)).toBeNull();
    });

    it('shows a stored date as MM/YYYY and reads it back the same', () => {
        expect(formatExpiry('2027-03-31')).toBe('03/2027');
        expect(parseExpiry(formatExpiry('2027-03-31'))).toBe('2027-03-31');
        expect(formatExpiry(null)).toBe('');
    });

    it('is expired only once the date has passed', () => {
        const now = new Date('2026-11-19T12:00:00Z');
        expect(isExpired('2026-01-31', now)).toBe(true);
        expect(isExpired('2027-03-31', now)).toBe(false);
        expect(isExpired(null, now)).toBe(false);
    });
});
