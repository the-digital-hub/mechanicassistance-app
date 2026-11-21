import type { Appointment } from '@/context/AppointmentsContext';
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, dateWindow, dayKey, isFiltering, matchesQuery, parseDay } from '../filters';

const NOW = new Date(2026, 10, 20, 15, 0); // 20 Nov 2026, local
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

const appt = (over: Partial<Appointment>): Appointment => ({
    id: 'id-1', type: 'immediate', title: 'Tire Assistance', date: at(2026, 11, 22), time: '', car: 'TESLA Model 3', address: 'Weston', budget: '', status: 'accepted', ...over,
}) as Appointment;

describe('matchesQuery', () => {
    const a = appt({ id: '3f9a1c2b-0000', refCode: 'AS-4H8TX2', title: 'Lights & Dashboard', car: 'HUMMER H2 (2008)', address: 'Weston' });
    it('finds by code, id, service, vehicle or address, ignoring case, spaces, # and dashes', () => {
        expect(matchesQuery(a, 'as-4h8tx2')).toBe(true);
        expect(matchesQuery(a, '4H8 TX2')).toBe(true);
        expect(matchesQuery(a, '#3f9a1c2b')).toBe(true);
        expect(matchesQuery(a, 'dashboard')).toBe(true);
        expect(matchesQuery(a, 'hummer')).toBe(true);
        expect(matchesQuery(a, 'weston')).toBe(true);
        expect(matchesQuery(a, 'zzz')).toBe(false);
    });
    it('a blank search matches everything', () => {
        expect(matchesQuery(a, '   ')).toBe(true);
    });
});

describe('dateWindow', () => {
    it('is open without a date filter', () => {
        expect(dateWindow(DEFAULT_FILTERS, NOW)).toBeNull();
        expect(dateWindow({ ...DEFAULT_FILTERS, preset: 'custom' }, NOW)).toBeNull();
    });
    it('covers today, the last 7 and 30 days (today included) and the month', () => {
        const day = 86_400_000;
        const today = dateWindow({ ...DEFAULT_FILTERS, preset: 'today' }, NOW)!;
        expect(dayKey(new Date(today.start))).toBe('2026-11-20');
        expect(dayKey(new Date(today.end))).toBe('2026-11-20');
        expect(dayKey(new Date(dateWindow({ ...DEFAULT_FILTERS, preset: '7d' }, NOW)!.start))).toBe('2026-11-14');
        expect(dayKey(new Date(dateWindow({ ...DEFAULT_FILTERS, preset: '30d' }, NOW)!.start))).toBe('2026-10-22');
        const month = dateWindow({ ...DEFAULT_FILTERS, preset: 'month' }, NOW)!;
        expect(dayKey(new Date(month.start))).toBe('2026-11-01');
        expect(dayKey(new Date(month.end))).toBe('2026-11-30');
        expect(today.end - today.start).toBeLessThan(day);
    });
    it('a custom range includes both end days, and may be open on one side', () => {
        const w = dateWindow({ ...DEFAULT_FILTERS, preset: 'custom', from: '2026-11-03', to: '2026-11-10' }, NOW)!;
        expect(w.start).toBe(parseDay('2026-11-03').getTime());
        expect(dayKey(new Date(w.end))).toBe('2026-11-10');
        expect(dateWindow({ ...DEFAULT_FILTERS, preset: 'custom', from: '2026-11-03' }, NOW)!.end).toBe(Number.POSITIVE_INFINITY);
    });
});

describe('applyFilters', () => {
    const upcoming = [
        appt({ id: 'a', date: at(2026, 11, 25), title: 'Battery' }),
        appt({ id: 'b', date: at(2026, 11, 21), title: 'Tires' }),
        appt({ id: 'c', date: at(2026, 12, 5), title: 'Brakes' }),
    ];
    it('orders upcoming soonest first, and flips it', () => {
        expect(applyFilters(upcoming, DEFAULT_FILTERS, 'upcoming', NOW).map((a) => a.id)).toEqual(['b', 'a', 'c']);
        expect(applyFilters(upcoming, { ...DEFAULT_FILTERS, reversed: true }, 'upcoming', NOW).map((a) => a.id)).toEqual(['c', 'a', 'b']);
    });
    it('filters upcoming by a date range', () => {
        const f = { ...DEFAULT_FILTERS, preset: 'custom' as const, from: '2026-11-22', to: '2026-11-30' };
        expect(applyFilters(upcoming, f, 'upcoming', NOW).map((a) => a.id)).toEqual(['a']);
    });

    const past = [
        appt({ id: 'p1', status: 'completed', completedAt: at(2026, 11, 18), refCode: 'AS-AAAAAA' }),
        appt({ id: 'p2', status: 'cancelled', cancelledAt: at(2026, 11, 19), refCode: 'AS-BBBBBB' }),
        appt({ id: 'p3', status: 'completed', completedAt: at(2026, 10, 2), refCode: 'AS-CCCCCC' }),
    ];
    it('orders past newest first, by when it ended or was cancelled', () => {
        expect(applyFilters(past, DEFAULT_FILTERS, 'past', NOW).map((a) => a.id)).toEqual(['p2', 'p1', 'p3']);
    });
    it('filters past by status, by date and by code together', () => {
        expect(applyFilters(past, { ...DEFAULT_FILTERS, status: 'completed' }, 'past', NOW).map((a) => a.id)).toEqual(['p1', 'p3']);
        expect(applyFilters(past, { ...DEFAULT_FILTERS, status: 'cancelled' }, 'past', NOW).map((a) => a.id)).toEqual(['p2']);
        expect(applyFilters(past, { ...DEFAULT_FILTERS, preset: '7d' }, 'past', NOW).map((a) => a.id)).toEqual(['p2', 'p1']);
        expect(applyFilters(past, { ...DEFAULT_FILTERS, query: 'as-ccc' }, 'past', NOW).map((a) => a.id)).toEqual(['p3']);
    });
    it('the status filter does not apply to upcoming', () => {
        expect(applyFilters(upcoming, { ...DEFAULT_FILTERS, status: 'cancelled' }, 'upcoming', NOW)).toHaveLength(3);
    });
});

describe('activeFilterCount / isFiltering', () => {
    it('counts the sheet filters, not the search', () => {
        expect(activeFilterCount(DEFAULT_FILTERS, 'past')).toBe(0);
        expect(activeFilterCount({ ...DEFAULT_FILTERS, status: 'completed', preset: '7d', reversed: true }, 'past')).toBe(3);
        expect(activeFilterCount({ ...DEFAULT_FILTERS, status: 'completed' }, 'upcoming')).toBe(0);
    });
    it('is filtering with a search alone', () => {
        expect(isFiltering(DEFAULT_FILTERS, 'past')).toBe(false);
        expect(isFiltering({ ...DEFAULT_FILTERS, query: 'x' }, 'past')).toBe(true);
    });
});
