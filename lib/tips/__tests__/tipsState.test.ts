jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
import { DISMISS_DAYS, EMPTY_TIPS_STATE, isHidden, withDismissed, withTap } from '../tipsState';

describe('tips memory', () => {
    const now = Date.UTC(2026, 10, 23, 12);

    it('hides a dismissed tip for a few days, then brings it back', () => {
        const state = withDismissed(EMPTY_TIPS_STATE, 'hours', now);
        expect(isHidden(state, 'hours', now + 60_000)).toBe(true);
        expect(isHidden(state, 'hours', now + (DISMISS_DAYS * 86_400_000) + 1)).toBe(false);
    });

    it('does not hide the others', () => {
        expect(isHidden(withDismissed(EMPTY_TIPS_STATE, 'hours', now), 'ase', now)).toBe(false);
    });

    it('counts taps and dismissals per tip without touching the original', () => {
        const once = withTap(EMPTY_TIPS_STATE, 'ase');
        const twice = withDismissed(withTap(once, 'ase'), 'ase', now);
        expect(twice.taps.ase).toBe(2);
        expect(twice.dismissals.ase).toBe(1);
        expect(EMPTY_TIPS_STATE.taps).toEqual({});
    });
});
