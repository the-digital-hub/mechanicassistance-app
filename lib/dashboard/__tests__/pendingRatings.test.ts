import { pendingRatings } from '../pendingRatings';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const job = (over: Record<string, unknown>) => ({ id: 'x', status: 'completed', source: 'appointment', mechanicId: 'm1', completedAt: day(1), ...over }) as never;

describe('pendingRatings', () => {
    it('the owner owes the technician rating of a recent finished job', () => {
        const list = [job({ id: 'a' }), job({ id: 'b', reviewRating: 4 }), job({ id: 'c', isReviewSubmitted: true })];
        expect(pendingRatings(list, 'user', NOW).map((a) => a.id)).toEqual(['a']);
    });

    it('the technician owes the customer rating', () => {
        const list = [job({ id: 'a', reviewRating: 5 }), job({ id: 'b', clientRating: 3 })];
        expect(pendingRatings(list, 'mechanic', NOW).map((a) => a.id)).toEqual(['a']);
    });

    it('newest first, and nothing older than the window', () => {
        const list = [job({ id: 'old', completedAt: day(45) }), job({ id: 'a', completedAt: day(5) }), job({ id: 'b', completedAt: day(2) })];
        expect(pendingRatings(list, 'user', NOW).map((a) => a.id)).toEqual(['b', 'a']);
    });

    it('ignores unfinished, cancelled, untaken and request-only rows', () => {
        const list = [job({ id: 'a', status: 'accepted' }), job({ id: 'b', status: 'cancelled' }), job({ id: 'c', mechanicId: undefined }), job({ id: 'd', source: 'assistance' })];
        expect(pendingRatings(list, 'user', NOW)).toEqual([]);
    });
});
