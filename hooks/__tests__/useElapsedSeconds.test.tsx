import { act, renderHook } from '@testing-library/react-native';
import { formatElapsed, useElapsedSeconds } from '../useElapsedSeconds';

describe('formatElapsed', () => {
    it('formats minutes and seconds with two digits', () => {
        expect(formatElapsed(0)).toBe('00:00');
        expect(formatElapsed(65)).toBe('01:05');
        expect(formatElapsed(30 * 60)).toBe('30:00');
    });

    it('adds hours from one hour on', () => {
        expect(formatElapsed(3600 + 2 * 60 + 3)).toBe('1:02:03');
    });

    it('never goes negative', () => {
        expect(formatElapsed(-5)).toBe('00:00');
    });
});

describe('useElapsedSeconds', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    });
    afterEach(() => jest.useRealTimers());

    it('returns 0 while there is no start', () => {
        const { result } = renderHook(() => useElapsedSeconds(null));
        expect(result.current).toBe(0);
    });

    it('counts from the start time and keeps ticking', () => {
        const start = Date.now() - 90_000;
        const { result } = renderHook(() => useElapsedSeconds(start));
        expect(result.current).toBe(90);

        act(() => {
            jest.advanceTimersByTime(3_000);
        });
        expect(result.current).toBe(93);
    });

    it('catches up after time passed without ticks (app in background)', () => {
        const start = Date.now();
        const { result } = renderHook(() => useElapsedSeconds(start));
        act(() => {
            jest.setSystemTime(Date.now() + 10 * 60_000);
            jest.advanceTimersByTime(1_000);
        });
        expect(result.current).toBe(10 * 60 + 1);
    });
});
