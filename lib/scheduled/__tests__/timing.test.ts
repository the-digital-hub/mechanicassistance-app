import { isFarScheduled } from '../timing';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const base = { type: 'scheduled', departedAt: null };

describe('isFarScheduled', () => {
    it('is true for a scheduled service days away', () => {
        expect(isFarScheduled({ ...base, date: '2026-11-22T09:00:00.000Z' }, NOW)).toBe(true);
    });
    it('is false once it is within the ready window', () => {
        expect(isFarScheduled({ ...base, date: '2026-11-15T13:30:00.000Z' }, NOW)).toBe(false);
        expect(isFarScheduled({ ...base, date: '2026-11-15T11:00:00.000Z' }, NOW)).toBe(false);
    });
    it('is false when the technician already headed out', () => {
        expect(isFarScheduled({ ...base, departedAt: '2026-11-22T08:00:00.000Z', date: '2026-11-22T09:00:00.000Z' }, NOW)).toBe(false);
    });
    it('ignores other service types and unknown dates', () => {
        expect(isFarScheduled({ type: 'immediate', date: '2026-11-22T09:00:00.000Z' }, NOW)).toBe(false);
        expect(isFarScheduled({ ...base, date: null }, NOW)).toBe(false);
        expect(isFarScheduled({ ...base, date: 'Pending' }, NOW)).toBe(false);
    });
});
