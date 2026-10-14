import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

/**
 * Stops a list's cards from opening when the touch was really a scroll.
 *
 * On iOS (New Architecture) a tap that stops a fling, or a slow drag that
 * starts on a card, can still reach the card's onPress. The list reports its
 * scroll activity through `scrollProps`; `guard(fn)` drops presses that land
 * while dragging or within SCROLL_SETTLE_MS of the last scroll event.
 *
 * A timestamp is used instead of a momentum flag because iOS does not emit
 * onMomentumScrollEnd when a tap stops the deceleration, which would leave the
 * flag stuck and block every later tap. Refs only — no re-renders.
 */
export const SCROLL_SETTLE_MS = 250;

export type PressGuard = <A extends unknown[]>(fn?: (...args: A) => void) => (...args: A) => void;

const passThrough: PressGuard = (fn) => (...args) => fn?.(...args);

export const ScrollPressGuardContext = createContext<PressGuard>(passThrough);

export function useScrollPressGuard() {
    const isDragging = useRef(false);
    const lastScrollAt = useRef(0);

    const markScroll = useCallback(() => {
        lastScrollAt.current = Date.now();
    }, []);

    const guard = useCallback<PressGuard>(
        (fn) =>
            (...args) => {
                if (isDragging.current) return;
                if (Date.now() - lastScrollAt.current < SCROLL_SETTLE_MS) return;
                fn?.(...args);
            },
        [],
    );

    const scrollProps = useMemo(
        () => ({
            scrollEventThrottle: 16,
            onScroll: markScroll,
            onScrollBeginDrag: () => {
                isDragging.current = true;
                markScroll();
            },
            onScrollEndDrag: () => {
                isDragging.current = false;
                markScroll();
            },
            onMomentumScrollBegin: markScroll,
            onMomentumScrollEnd: markScroll,
        }),
        [markScroll],
    );

    return { scrollProps, guard };
}

/** Wraps a press handler with the guard of the nearest list, if any. */
export function useGuardedPress<A extends unknown[]>(fn?: (...args: A) => void) {
    const guard = useContext(ScrollPressGuardContext);
    return useMemo(() => guard(fn), [guard, fn]);
}
