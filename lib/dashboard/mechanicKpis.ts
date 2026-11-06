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
