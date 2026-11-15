import { localWeekBounds, weekDailyTotals } from '../mechanicKpis';

// Wednesday 2026-11-11, local time.
const NOW = new Date(2026, 10, 11, 15, 0, 0);
const at = (d: number, h = 10) => new Date(2026, 10, d, h).toISOString();

describe('weekDailyTotals', () => {
    it('buckets net earnings by local day, Monday first, skipping void rows', () => {
        const res = weekDailyTotals(
            [
                { netAmount: '100.10', status: 'ready', createdAt: at(9) },
                { netAmount: '50', status: 'pending', createdAt: at(9, 20) },
                { netAmount: '200', status: 'void', createdAt: at(10) },
                { netAmount: '75.5', status: 'settled', createdAt: at(11) },
                { netAmount: '999', status: 'ready', createdAt: at(16) },
            ],
            NOW,
        );
        expect(res.days).toEqual([150.1, 0, 75.5, 0, 0, 0, 0]);
        expect(res.todayIdx).toBe(2);
        expect(res.total).toBe(225.6);
    });

    it('starts the week on Monday', () => {
        const { from, to } = localWeekBounds(NOW);
        expect(new Date(from).getDate()).toBe(9);
        expect(new Date(to).getDate()).toBe(16);
    });

    it('treats Sunday as the last slot of the week', () => {
        const sunday = new Date(2026, 10, 15, 9);
        expect(weekDailyTotals([], sunday).todayIdx).toBe(6);
    });
});
