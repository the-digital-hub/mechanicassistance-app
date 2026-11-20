import { useEffect, useState } from 'react';

/**
 * Whether the bottom tab bar is tucked away. Scrolling down through a list hides it (a small tip stays so the person knows it is there);
 * scrolling back up, tapping the tip or changing screen brings it back. Kept outside React so the touch detector in the tabs layout and the
 * bar itself can talk without a provider.
 */
let hidden = false;
const listeners = new Set<(h: boolean) => void>();

export function setTabBarHidden(next: boolean): void {
    if (next === hidden) return;
    hidden = next;
    listeners.forEach((fn) => fn(next));
}

export function useTabBarHidden(): boolean {
    const [value, setValue] = useState(hidden);
    useEffect(() => {
        listeners.add(setValue);
        setValue(hidden);
        return () => {
            listeners.delete(setValue);
        };
    }, []);
    return value;
}

/** Tracks a finger dragging over the screen and decides when the bar goes away or returns. */
export function createScrollIntent(options?: { hideAfter?: number; showAfter?: number }) {
    const hideAfter = options?.hideAfter ?? 56;
    const showAfter = options?.showAfter ?? 28;
    let lastY = 0;
    let lastX = 0;
    let travelled = 0;
    return {
        start(x: number, y: number) {
            lastX = x;
            lastY = y;
            travelled = 0;
        },
        move(x: number, y: number) {
            const dy = y - lastY;
            const dx = x - lastX;
            lastX = x;
            lastY = y;
            // A sideways swipe (a slider, a carousel) says nothing about the list.
            if (Math.abs(dx) > Math.abs(dy)) return;
            // The finger going up scrolls the content down: the direction accumulates, and flipping it starts over.
            if (dy < 0) travelled = Math.min(0, travelled) + dy;
            else travelled = Math.max(0, travelled) + dy;
            if (travelled <= -hideAfter) setTabBarHidden(true);
            else if (travelled >= showAfter) setTabBarHidden(false);
        },
    };
}
