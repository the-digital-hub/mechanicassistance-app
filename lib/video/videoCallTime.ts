/**
 * When a video call is booked for, in the device's local time.
 *
 * A "Now" call carries no future `date` (the feed falls back to the request's
 * creation/update time), so anything not clearly ahead of the clock reads as
 * "now": returns null then, and the caller shows its own "Now" label.
 */
const NOW_TOLERANCE_MS = 5 * 60_000;

export function videoCallStartLabel(raw: string | null | undefined, locale?: string): string | null {
    if (!raw) return null;
    const at = new Date(raw);
    if (isNaN(at.getTime()) || at.getTime() <= Date.now() + NOW_TOLERANCE_MS) return null;
    return formatLocalDateTime(at, locale);
}

/** "Tue, Oct 14, 3:30 PM" in the device's zone; '' for an unparseable value. */
export function formatLocalDateTime(value: string | Date | null | undefined, locale?: string): string {
    if (!value) return '';
    const at = value instanceof Date ? value : new Date(value);
    if (isNaN(at.getTime())) return '';
    return at.toLocaleString(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
