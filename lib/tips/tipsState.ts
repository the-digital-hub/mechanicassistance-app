import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What the app remembers about the tips of one account, on the device: which ones were put off ("not now", back after a few days),
 * and how many times each was tapped or dismissed. The counts are what a later, smarter ranking (or the backend) can learn from.
 */
export interface TipsState {
    /** Tip key → epoch ms until which it stays hidden. */
    hiddenUntil: Record<string, number>;
    taps: Record<string, number>;
    dismissals: Record<string, number>;
}

export const EMPTY_TIPS_STATE: TipsState = { hiddenUntil: {}, taps: {}, dismissals: {} };

/** How long a dismissed tip stays away. */
export const DISMISS_DAYS = 3;

const keyFor = (userId: string) => `tips_state_v1:${userId}`;

export async function loadTipsState(userId: string): Promise<TipsState> {
    try {
        const raw = await AsyncStorage.getItem(keyFor(userId));
        if (!raw) return EMPTY_TIPS_STATE;
        const parsed = JSON.parse(raw) as Partial<TipsState>;
        return { hiddenUntil: parsed.hiddenUntil ?? {}, taps: parsed.taps ?? {}, dismissals: parsed.dismissals ?? {} };
    } catch {
        return EMPTY_TIPS_STATE;
    }
}

export async function saveTipsState(userId: string, state: TipsState): Promise<void> {
    try {
        await AsyncStorage.setItem(keyFor(userId), JSON.stringify(state));
    } catch {
        // Losing the memory of a dismissed tip is harmless: it just shows again.
    }
}

/** Pure: the state after dismissing `key` at `now`. */
export function withDismissed(state: TipsState, key: string, now = Date.now()): TipsState {
    return {
        ...state,
        hiddenUntil: { ...state.hiddenUntil, [key]: now + DISMISS_DAYS * 86_400_000 },
        dismissals: { ...state.dismissals, [key]: (state.dismissals[key] ?? 0) + 1 },
    };
}

/** Pure: the state after a tap on `key`. */
export function withTap(state: TipsState, key: string): TipsState {
    return { ...state, taps: { ...state.taps, [key]: (state.taps[key] ?? 0) + 1 } };
}

/** Pure: is this tip hidden right now? */
export function isHidden(state: TipsState, key: string, now = Date.now()): boolean {
    return (state.hiddenUntil[key] ?? 0) > now;
}
