import { countCompletedToday, localDayBounds, sumNetEarnings } from '../dashboard/mechanicKpis';

describe('mechanic dashboard KPIs', () => {
    const now = new Date(2026, 10, 6, 15, 0); // 6 Nov 2026, 15:00 local

    it('bounds the local day, end exclusive', () => {
        const { from, to } = localDayBounds(now);
        expect(new Date(from).getTime()).toBe(new Date(2026, 10, 6).getTime());
        expect(new Date(to).getTime()).toBe(new Date(2026, 10, 7).getTime());
    });

    it('counts only jobs completed today', () => {
        const today = new Date(2026, 10, 6, 9, 30).toISOString();
        const yesterday = new Date(2026, 10, 5, 23, 59).toISOString();
        const tomorrow = new Date(2026, 10, 7, 0, 0).toISOString();
        expect(
            countCompletedToday(
                [
                    { status: 'completed', completedAt: today },
                    { status: 'completed', completedAt: yesterday },
                    { status: 'completed', completedAt: tomorrow },
                    { status: 'completed' },
                    { status: 'in_progress', completedAt: today },
                ],
                now,
            ),
        ).toBe(1);
    });

    it('sums net amounts, leaving voided ones out', () => {
        expect(
            sumNetEarnings([
                { netAmount: '80.10', status: 'pending' },
                { netAmount: '19.20', status: 'settled' },
                { netAmount: '50.00', status: 'void' },
            ]),
        ).toBe(99.3);
        expect(sumNetEarnings([])).toBe(0);
    });
});
