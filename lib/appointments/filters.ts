import type { Appointment } from '@/context/AppointmentsContext';

// Filtering of the Appointments list: a search (code, id, vehicle, service, address), the Completed / Cancelled status of past ones, a date
// (a preset or a range) and the order. Pure, so the screen only wires it up.

export type DatePreset = 'any' | 'today' | '7d' | '30d' | 'month' | 'custom';
export type StatusFilter = 'all' | 'completed' | 'cancelled';
/** Which list is being filtered: what is coming (and in flight) or what is over. */
export type FilterScope = 'upcoming' | 'past';

export interface AppointmentFilters {
    query: string;
    /** Past only. */
    status: StatusFilter;
    preset: DatePreset;
    /** `YYYY-MM-DD` (local), for `custom`; either end may be open. */
    from: string | null;
    to: string | null;
    /** The natural order flipped: upcoming goes soonest first, past newest first. */
    reversed: boolean;
}

export const DEFAULT_FILTERS: AppointmentFilters = { query: '', status: 'all', preset: 'any', from: null, to: null, reversed: false };

const isCancelled = (status: string) => status === 'cancelled' || status === 'canceled';

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of a date in the phone's own time zone. */
export function dayKey(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a `YYYY-MM-DD`. */
export function parseDay(day: string): Date {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

/** The time window a date filter covers (`null` = any date). Either end of a custom range may be open. */
export function dateWindow(f: AppointmentFilters, now: Date = new Date()): { start: number; end: number } | null {
    const day = 86_400_000;
    switch (f.preset) {
        case 'any':
            return null;
        case 'today':
            return { start: startOfDay(now), end: endOfDay(now) };
        case '7d':
            return { start: startOfDay(now) - 6 * day, end: endOfDay(now) };
        case '30d':
            return { start: startOfDay(now) - 29 * day, end: endOfDay(now) };
        case 'month':
            return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime() };
        case 'custom': {
            if (!f.from && !f.to) return null;
            return {
                start: f.from ? startOfDay(parseDay(f.from)) : Number.NEGATIVE_INFINITY,
                end: f.to ? endOfDay(parseDay(f.to)) : Number.POSITIVE_INFINITY,
            };
        }
    }
}

/** The moment an appointment counts at for dates and order: when it happens (upcoming), or when it ended / was cancelled (past). */
export function appointmentTime(a: Appointment, scope: FilterScope): number {
    const raw = scope === 'past'
        ? (isCancelled(a.status) ? a.cancelledAt : a.completedAt) ?? a.updatedAt ?? a.date
        : a.date || a.createdAt || a.updatedAt;
    const ms = Date.parse(raw ?? '');
    return Number.isFinite(ms) ? ms : 0;
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[\s#-]+/g, '');

/** Whether the search text is in the code (AS-XXXXXX), the id, the service, the vehicle or the address. Blank matches everything. */
export function matchesQuery(a: Appointment, query: string): boolean {
    const q = norm(query);
    if (!q) return true;
    return [a.refCode, a.id, a.title, a.car, a.address].some((field) => norm(field).includes(q));
}

/** The list as the filters leave it, ordered. */
export function applyFilters(list: readonly Appointment[], f: AppointmentFilters, scope: FilterScope, now: Date = new Date()): Appointment[] {
    const window = dateWindow(f, now);
    const filtered = list.filter((a) => {
        if (!matchesQuery(a, f.query)) return false;
        if (scope === 'past' && f.status !== 'all' && (f.status === 'cancelled') !== isCancelled(a.status)) return false;
        if (window) {
            const t = appointmentTime(a, scope);
            if (t < window.start || t > window.end) return false;
        }
        return true;
    });
    // Natural order: upcoming soonest first, past newest first.
    const direction = (scope === 'past' ? -1 : 1) * (f.reversed ? -1 : 1);
    return filtered.sort((a, b) => direction * (appointmentTime(a, scope) - appointmentTime(b, scope)));
}

/** How many filters the sheet has set (the search is visible on its own and does not count). */
export function activeFilterCount(f: AppointmentFilters, scope: FilterScope): number {
    return (scope === 'past' && f.status !== 'all' ? 1 : 0) + (dateWindow(f) ? 1 : 0) + (f.reversed ? 1 : 0);
}

/** Whether anything narrows the list at all (search included). */
export function isFiltering(f: AppointmentFilters, scope: FilterScope): boolean {
    return f.query.trim() !== '' || activeFilterCount(f, scope) > 0;
}
