import type { Appointment } from '@/context/AppointmentsContext';
import { reviewDAO } from '@/lib/dao/ReviewDAO';
import { useEffect, useMemo, useState } from 'react';

export interface ProfileReview {
    id: string;
    rating: number;
    text?: string;
    tags: string[];
    /** ISO date of the job the rating belongs to. */
    date?: string;
    title?: string;
    car?: string;
}

const MAX_REVIEWS = 30;

/** Comments already read, by appointment id; the list re-renders on every focus. */
const textCache = new Map<string, { text?: string; tags: string[] }>();

const stars = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * The ratings behind the stars of a profile, newest first, each with the date and (when it was written) the comment.
 * - technician: what customers wrote about them. The list only carries the stars (`reviewRating`), so each comment is
 *   read from the job's review (`GET /appointments/:id/review`);
 * - vehicle owner: what technicians wrote about them, from the job's `clientReview`.
 * There is no endpoint listing a person's reviews, so this is built from their finished jobs (see backlog Y).
 */
export function useProfileReviews(isTechnician: boolean, appointments: Appointment[], enabled: boolean) {
    const base = useMemo<ProfileReview[]>(() => {
        if (!enabled) return [];
        return appointments
            .map((a): ProfileReview | null => {
                const rating = isTechnician ? stars(a.reviewRating) : stars(a.clientReview?.rating ?? a.clientRating);
                if (!rating) return null;
                return {
                    id: a.id,
                    rating,
                    text: isTechnician ? undefined : a.clientReview?.review?.trim() || undefined,
                    tags: isTechnician ? [] : a.clientReview?.experienceTags ?? [],
                    date: a.completedAt ?? a.updatedAt ?? a.date,
                    title: a.title,
                    car: a.car,
                };
            })
            .filter((r): r is ProfileReview => r !== null)
            .sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''))
            .slice(0, MAX_REVIEWS);
    }, [appointments, isTechnician, enabled]);

    const [read, setRead] = useState<Record<string, { text?: string; tags: string[] }>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !isTechnician || base.length === 0) return;
        let alive = true;
        const missing = base.filter((r) => !textCache.has(r.id));
        const seed: Record<string, { text?: string; tags: string[] }> = {};
        base.forEach((r) => { const c = textCache.get(r.id); if (c) seed[r.id] = c; });
        setRead(seed);
        if (missing.length === 0) return;
        setLoading(true);
        Promise.all(
            missing.map((r) =>
                reviewDAO
                    .get(r.id)
                    .then((rev) => {
                        const entry = {
                            text: rev?.review?.trim() || undefined,
                            tags: rev?.experienceTags ? rev.experienceTags.split(',').map((x) => x.trim()).filter(Boolean) : [],
                        };
                        textCache.set(r.id, entry);
                        return [r.id, entry] as const;
                    })
                    .catch(() => null),
            ),
        ).then((rows) => {
            if (!alive) return;
            setRead((prev) => {
                const next = { ...prev };
                rows.forEach((row) => { if (row) next[row[0]] = row[1]; });
                return next;
            });
            setLoading(false);
        });
        return () => { alive = false; };
    }, [base, enabled, isTechnician]);

    const items = useMemo(
        () => base.map((r) => (read[r.id] ? { ...r, text: read[r.id].text ?? r.text, tags: read[r.id].tags.length ? read[r.id].tags : r.tags } : r)),
        [base, read],
    );
    return { items, loading };
}
