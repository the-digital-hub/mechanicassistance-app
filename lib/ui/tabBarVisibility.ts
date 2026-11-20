import { useEffect, useState } from 'react';
import { UIManager } from 'react-native';

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
    // Where the touched view was when the finger went down: if it does not follow the finger, nothing is scrolling and the bar stays.
    let target = 0;
    let startTop: number | null = null;
    let checking = false;
    const topOf = (tag: number, done: (top: number | null) => void) => {
        try {
            UIManager.measure(tag, (_x, _y, _w, _h, _pageX, pageY) => done(Number.isFinite(pageY) ? pageY : null));
        } catch {
            done(null);
        }
    };
    const hideIfContentMoved = () => {
        if (checking || !target || startTop === null) return;
        checking = true;
        topOf(target, (top) => {
            checking = false;
            // Could not measure: keep the earlier behaviour. Otherwise the view must have moved with the finger.
            if (top === null || Math.abs(top - startTop!) >= 12) setTabBarHidden(true);
        });
    };
    return {
        start(x: number, y: number, touched?: number) {
            lastX = x;
            lastY = y;
            travelled = 0;
            target = touched ?? 0;
            startTop = null;
            if (target) topOf(target, (top) => { startTop = top; });
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
            if (travelled <= -hideAfter) hideIfContentMoved();
            else if (travelled >= showAfter) setTabBarHidden(false);
        },
    };
}
