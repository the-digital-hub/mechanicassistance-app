import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockMine = jest.fn();
jest.mock('@/lib/dao/ReviewDAO', () => ({ reviewDAO: { mine: (...args: unknown[]) => mockMine(...args) } }));

import { useProfileReviews } from '../useProfileReviews';

const item = (id: string, over: Record<string, unknown> = {}) => ({
    id, appointmentId: `a-${id}`, rating: 5, review: 'Great', experienceTags: ['On time'], createdAt: '2026-11-18T15:00:00Z', serviceTitle: 'Tire help', vehicle: 'HUMMER H2', ...over,
});

describe('profile reviews from the server', () => {
    beforeEach(() => mockMine.mockReset());

    it('reads nothing until the sheet opens', () => {
        renderHook(() => useProfileReviews(false));
        expect(mockMine).not.toHaveBeenCalled();
    });

    it('shows each rating with its date, comment, tags, service and vehicle', async () => {
        mockMine.mockResolvedValue({ items: [item('1'), item('2', { review: null })], total: 2, page: 1, limit: 20, average: 4.5, count: 2 });
        const { result } = renderHook(() => useProfileReviews(true));
        await waitFor(() => expect(result.current.items).toHaveLength(2));
        expect(result.current.items[0]).toMatchObject({ rating: 5, text: 'Great', tags: ['On time'], date: '2026-11-18T15:00:00Z', title: 'Tire help', car: 'HUMMER H2' });
        expect(result.current.items[1].text).toBeUndefined();
        expect(result.current.average).toBe(4.5);
        expect(result.current.count).toBe(2);
        expect(result.current.hasMore).toBe(false);
    });

    it('loads the next page and adds it below', async () => {
        mockMine.mockResolvedValueOnce({ items: [item('1')], total: 2, page: 1, limit: 1, average: 5, count: 2 });
        const { result } = renderHook(() => useProfileReviews(true));
        await waitFor(() => expect(result.current.hasMore).toBe(true));
        mockMine.mockResolvedValueOnce({ items: [item('2')], total: 2, page: 2, limit: 1, average: 5, count: 2 });
        await act(async () => { result.current.loadMore(); });
        await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(['1', '2']));
        expect(mockMine).toHaveBeenLastCalledWith(2, 20);
        expect(result.current.hasMore).toBe(false);
    });

    it('says it failed instead of showing a wrong empty list', async () => {
        mockMine.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => useProfileReviews(true));
        await waitFor(() => expect(result.current.failed).toBe(true));
        expect(result.current.items).toEqual([]);
    });
});
