import type { MechanicEarning } from '@/lib/dao/interfaces';

/** Start and end (exclusive) of the phone's local calendar day, as ISO timestamps. */
export function localDayBounds(now: Date = new Date()): { from: string; to: string } {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
}

/** Jobs finished during the phone's local day. Rows without `completedAt` never count. */
export function countCompletedToday(
    appointments: readonly { status: string; completedAt?: string | null }[],
    now: Date = new Date(),
): number {
    const { from, to } = localDayBounds(now);
    const start = Date.parse(from);
    const end = Date.parse(to);
    return appointments.filter((a) => {
        if (a.status !== 'completed' || !a.completedAt) return false;
        const at = Date.parse(a.completedAt);
        return at >= start && at < end;
    }).length;
}

/** Net earned across the given rows, voided ones left out. Summed in cents to avoid float drift. */
export function sumNetEarnings(items: readonly Pick<MechanicEarning, 'netAmount' | 'status'>[]): number {
    const cents = items
        .filter((e) => e.status !== 'void')
        .reduce((sum, e) => sum + Math.round((Number(e.netAmount) || 0) * 100), 0);
    return cents / 100;
}

/** Monday 00:00 of the phone's local week through the next Monday (exclusive), as ISO timestamps. */
export function localWeekBounds(now: Date = new Date()): { from: string; to: string } {
    const sinceMonday = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday + 7);
    return { from: start.toISOString(), to: end.toISOString() };
}

/**
 * Net earned per day of the local week (Monday first), voided rows left out.
 * `todayIdx` is today's slot, `total` the week's sum.
 */
export function weekDailyTotals(
    items: readonly Pick<MechanicEarning, 'netAmount' | 'status' | 'createdAt'>[],
    now: Date = new Date(),
): { days: number[]; todayIdx: number; total: number } {
    const { from } = localWeekBounds(now);
    const start = new Date(from);
    const cents = [0, 0, 0, 0, 0, 0, 0];
    for (const e of items) {
        if (e.status === 'void') continue;
        const at = new Date(e.createdAt);
        const idx = Math.floor(
            (new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - start.getTime()) / 86400000,
        );
        if (idx >= 0 && idx < 7) cents[idx] += Math.round((Number(e.netAmount) || 0) * 100);
    }
    return {
        days: cents.map((c) => c / 100),
        todayIdx: (now.getDay() + 6) % 7,
        total: cents.reduce((a, c) => a + c, 0) / 100,
    };
}
