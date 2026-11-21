import type { Appointment } from '@/context/AppointmentsContext';

/** A rating still due stays on the dashboard for this long after the job; older ones are history, not a task. */
export const RATING_WINDOW_DAYS = 30;

/**
 * Finished jobs this person has not rated yet, newest first: the vehicle owner owes the technician's rating (`reviewRating`),
 * the technician the customer's (`clientRating`). `isReviewSubmitted` is not used: the technician's own rating turns it on too. A job nobody took (no technician) or not completed owes nothing.
 */
export function pendingRatings(appointments: readonly Appointment[], role: 'user' | 'mechanic', now: number = Date.now()): Appointment[] {
    const since = now - RATING_WINDOW_DAYS * 86_400_000;
    return appointments
        .filter((a) => {
            if (a.status !== 'completed' || a.source !== 'appointment' || !a.mechanicId) return false;
            const done = Date.parse(a.completedAt ?? a.updatedAt ?? '');
            if (!Number.isFinite(done) || done < since) return false;
            return role === 'user' ? a.reviewRating == null : a.clientRating == null;
        })
        .sort((a, b) => Date.parse(b.completedAt ?? b.updatedAt ?? '') - Date.parse(a.completedAt ?? a.updatedAt ?? ''));
}
