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
    return formatZonedDateTime(at, locale);
}

/** The device's own time zone, e.g. "America/New_York". */
function deviceZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/** "Tue, Oct 14, 3:30 PM EDT": the date and time with the zone's short name, in `timeZone` (the device's by default). */
export function formatZonedDateTime(value: string | Date | null | undefined, locale?: string, timeZone?: string): string {
    if (!value) return '';
    const at = value instanceof Date ? value : new Date(value);
    if (isNaN(at.getTime())) return '';
    try {
        return at.toLocaleString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
            ...(timeZone ? { timeZone } : {}),
        });
    } catch {
        return formatLocalDateTime(at, locale);
    }
}

/** The device's zone, short name only ("EST"). */
export function deviceZoneName(locale?: string, at: Date = new Date()): string {
    try {
        return new Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? deviceZone();
    } catch {
        return deviceZone();
    }
}

/**
 * A booked video call, for someone who may be in another time zone than the owner who booked it:
 * `mine` is the date and time on this phone (with its zone), `theirs` the same instant in the owner's
 * zone, only when that zone is known and the clocks really differ at that moment. Null when the call
 * is for "now" or has no usable date.
 */
export function videoCallZones(
    call: { date?: string | null; startNow?: boolean | null; timezone?: string | null } | null | undefined,
    locale?: string,
): { mine: string; theirs: string | null; zone: string } | null {
    if (!call || call.startNow || !call.date) return null;
    const at = new Date(call.date);
    if (isNaN(at.getTime())) return null;
    const mine = formatZonedDateTime(at, locale);
    if (!mine) return null;
    let theirs: string | null = null;
    if (call.timezone && call.timezone !== deviceZone()) {
        const hm = (zone?: string) => at.toLocaleString(locale, { hour: 'numeric', minute: '2-digit', day: 'numeric', ...(zone ? { timeZone: zone } : {}) });
        try {
            if (hm() !== hm(call.timezone)) theirs = formatZonedDateTime(at, locale, call.timezone);
        } catch {
            theirs = null; // not a zone this runtime knows
        }
    }
    return { mine, theirs, zone: deviceZoneName(locale, at) };
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

/**
 * The booked local date/time of a video call, or null when it was asked for
 * "now" (`startNow`, whose `date` is only its creation time) and has not taken
 * place yet — the caller shows its own "Now" label then. A "now" call that has
 * started or finished gives the day and time it happened. Unlike
 * `videoCallStartLabel`, a booked slot that has already started keeps its date.
 */
export function videoCallBookedLabel(
    call: { date?: string | null; startNow?: boolean | null; startedAt?: string | null; completedAt?: string | null } | null | undefined,
    locale?: string,
): string | null {
    if (!call) return null;
    if (call.startNow) {
        // Asked for "now": once it happened, "Now" says nothing, so give the day and time it took place.
        const happened = call.startedAt || call.completedAt;
        return happened ? formatZonedDateTime(happened, locale) || null : null;
    }
    // With the zone's name: whoever reads it may be in another zone than the owner who booked it.
    return formatZonedDateTime(call.date, locale) || null;
}
