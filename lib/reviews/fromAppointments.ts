import type { Appointment } from '@/context/AppointmentsContext';
import type { ProfileReview } from '@/hooks/useProfileReviews';
import { splitJobTitle } from '@/lib/ui/jobTitle';

/**
 * The ratings of a profile read off the appointments the app already has: the stars each customer gave the technician (`reviewRating`), or
 * the ones each technician gave the owner (`clientRating`). It is what the ratings sheet shows when the full list (`GET /api/reviews/me`,
 * with comments and tags) cannot be loaded. Newest first; no comments or tags, because the appointment rows do not carry them.
 */
export function ratingsFromAppointments(appointments: readonly Appointment[], isTechnician: boolean): ProfileReview[] {
    return appointments
        .map((a) => ({ a, stars: Number(isTechnician ? a.reviewRating : a.clientRating) }))
        .filter(({ stars }) => Number.isFinite(stars) && stars > 0)
        .map(({ a, stars }): ProfileReview => ({
            id: a.id,
            rating: stars,
            tags: [],
            date: a.completedAt ?? a.updatedAt ?? a.date,
            title: splitJobTitle(a.title ?? '').main || a.title || undefined,
            car: a.car || undefined,
        }))
        .sort((x, y) => Date.parse(y.date ?? '') - Date.parse(x.date ?? '') || 0);
}
