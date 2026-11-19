import { renderHook, waitFor } from '@testing-library/react-native';

const mockGetExtensions = jest.fn();
jest.mock('@/lib/dao/VideoCallDAO', () => ({ videoCallDAO: { getExtensions: (...args: unknown[]) => mockGetExtensions(...args) } }));

import { useCallExtraMinutes } from '../useCallExtraMinutes';

describe('minutes added to a finished call', () => {
    beforeEach(() => mockGetExtensions.mockReset());

    it('takes them from the list row and asks the server nothing', () => {
        const { result } = renderHook(() => useCallExtraMinutes('c1', true, 15));
        expect(result.current).toBe(15);
        expect(mockGetExtensions).not.toHaveBeenCalled();
    });

    it('a row that says zero is zero, with no request either', () => {
        const { result } = renderHook(() => useCallExtraMinutes('c2', true, 0));
        expect(result.current).toBe(0);
        expect(mockGetExtensions).not.toHaveBeenCalled();
    });

    it('asks the call itself only when the backend does not send the number', async () => {
        mockGetExtensions.mockResolvedValue({ baseMinutes: 30, contractedMinutes: 45 });
        const { result } = renderHook(() => useCallExtraMinutes('c3', true));
        await waitFor(() => expect(result.current).toBe(15));
        expect(mockGetExtensions).toHaveBeenCalledTimes(1);
    });
});
