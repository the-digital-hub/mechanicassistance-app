import { ApiError } from '@/lib/api/types';
import { reviewDAO, type MyReview } from '@/lib/dao/ReviewDAO';
import { useCallback, useEffect, useState } from 'react';

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

const PAGE_SIZE = 20;

const toReview = (r: MyReview): ProfileReview => ({
    id: r.id,
    rating: Number(r.rating),
    text: r.review?.trim() || undefined,
    tags: r.experienceTags ?? [],
    date: r.createdAt,
    title: r.serviceTitle ?? undefined,
    car: r.vehicle ?? undefined,
});

/**
 * The ratings behind the stars of a profile, newest first, each with its date and comment: read from the server
 * (`GET /reviews/me`, a page at a time) the first time `enabled` turns true. A technician sees what their customers
 * wrote, anyone else what technicians wrote about them.
 *
 * If the list cannot be loaded (the gateway not routing `/api/reviews` answers 403), the `fallback` ratings (the stars read off the
 * appointments, no comments) are shown instead of an error, and `partial` says so.
 */
export function useProfileReviews(enabled: boolean, fallback: ProfileReview[] = []) {
    const [items, setItems] = useState<ProfileReview[]>([]);
    const [total, setTotal] = useState(0);
    const [average, setAverage] = useState<number | null>(null);
    const [count, setCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    /** The HTTP status when the server answered with an error (for support), else null. */
    const [failedStatus, setFailedStatus] = useState<number | null>(null);
    const [page, setPage] = useState(0);

    const load = useCallback((next: number) => {
        setLoading(true);
        setFailed(false);
        setFailedStatus(null);
        reviewDAO
            .mine(next, PAGE_SIZE)
            .then((r) => {
                setItems((prev) => (next === 1 ? r.items.map(toReview) : [...prev, ...r.items.map(toReview)]));
                setTotal(r.total);
                setAverage(r.average ?? null);
                setCount(r.count ?? r.total);
                setPage(next);
            })
            .catch((err) => {
                setFailed(true);
                setFailedStatus(err instanceof ApiError ? err.statusCode : null);
            })
            .finally(() => setLoading(false));
    }, []);

    // Every time the sheet opens the first page is read again: a rating may have arrived since.
    useEffect(() => {
        if (enabled) load(1);
    }, [enabled, load]);

    const loadMore = useCallback(() => {
        if (!loading) load(page + 1);
    }, [loading, load, page]);

    const showFallback = failed && items.length === 0 && fallback.length > 0;
    return {
        items: showFallback ? fallback : items,
        total: showFallback ? fallback.length : total,
        average,
        count,
        loading,
        failed: failed && !showFallback,
        failedStatus,
        partial: showFallback,
        hasMore: showFallback ? false : items.length < total,
        loadMore,
    };
}
