/** A confirmed scheduled service is "upcoming" (not "getting ready") while it is further away than this. */
export const READY_WINDOW_HOURS = 2;

/**
 * True for a scheduled service whose date is still far away and whose technician has not headed
 * out: its state is "scheduled for <date>", not "getting ready" or "en route". A service whose date
 * is unknown or already near keeps the usual live states.
 */
export function isFarScheduled(
    appointment: { type?: string; assistanceType?: string; date?: string | null; departedAt?: string | null },
    now: Date = new Date(),
): boolean {
    if ((appointment.assistanceType ?? appointment.type) !== 'scheduled') return false;
    if (appointment.departedAt) return false;
    const at = appointment.date ? Date.parse(appointment.date) : NaN;
    if (!Number.isFinite(at)) return false;
    return at - now.getTime() > READY_WINDOW_HOURS * 60 * 60 * 1000;
}
