import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { ringIfEnabled } from './sound';
import { vibrateIfEnabled } from './vibration';

// The small alert shown on screen when a push arrives while the app is open (the system shows nothing then), and the
// switch that turns it on or off from Settings → Notifications.

/** Whether the on-screen alert is on. On until the person turns it off. */
const KEY = 'settings:inAppRequestAlerts';

let enabled = true;
let loaded = false;
const enabledListeners = new Set<(on: boolean) => void>();

async function load(): Promise<boolean> {
    if (loaded) return enabled;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        enabled = raw === null ? true : raw === '1';
    } catch {
        enabled = true;
    }
    loaded = true;
    return enabled;
}

export async function getInAppAlertsEnabled(): Promise<boolean> {
    return load();
}

export async function setInAppAlertsEnabled(on: boolean): Promise<void> {
    enabled = on;
    loaded = true;
    enabledListeners.forEach((fn) => fn(on));
    if (!on) dismissInAppBanner();
    try {
        await AsyncStorage.setItem(KEY, on ? '1' : '0');
    } catch {
        // The choice still holds for this session.
    }
}

/** The switch's state and its setter, kept in step wherever it is shown. */
export function useInAppAlertsEnabled(): [boolean, (on: boolean) => void] {
    const [on, setOn] = useState(enabled);
    useEffect(() => {
        let alive = true;
        void load().then((v) => alive && setOn(v));
        enabledListeners.add(setOn);
        return () => {
            alive = false;
            enabledListeners.delete(setOn);
        };
    }, []);
    return [on, (next) => void setInAppAlertsEnabled(next)];
}

/**
 * Whether `route` is the screen the person is on (`pathname` as expo-router reports it, groups left out). An alert for what is
 * already on screen would only repeat it.
 */
export function routeIsCurrent(route: Href | null, pathname: string): boolean {
    if (!route) return false;
    const clean = (p: string) => p.replace(/\/\([^/]+\)/g, '').replace(/\/+$/, '') || '/';
    let target: string;
    if (typeof route === 'string') target = route.split('?')[0];
    else {
        const params = (route as { params?: Record<string, unknown> }).params ?? {};
        target = String((route as { pathname: string }).pathname).replace(/\[(\w+)\]/g, (_, key: string) => String(params[key] ?? ''));
    }
    return clean(target) === clean(pathname);
}

export interface InAppBanner {
    /** Same id = the same alert: it is not shown twice. */
    id: string;
    title: string;
    body: string;
    /** Where tapping it leads. */
    route: Href | null;
}

let current: InAppBanner | null = null;
const bannerListeners = new Set<(b: InAppBanner | null) => void>();
const shownIds = new Set<string>();

const publish = () => bannerListeners.forEach((fn) => fn(current));

/** Shows the alert unless the person turned it off (or it was already shown). Returns whether it was shown. */
export async function showInAppBanner(banner: InAppBanner): Promise<boolean> {
    if (!(await load())) return false;
    if (shownIds.has(banner.id)) return false;
    shownIds.add(banner.id);
    current = banner;
    publish();
    // With Sound and Vibrate on, the alert is heard and felt as well as seen.
    void ringIfEnabled();
    void vibrateIfEnabled();
    return true;
}

export function dismissInAppBanner(): void {
    if (!current) return;
    current = null;
    publish();
}

export function useInAppBanner(): InAppBanner | null {
    const [banner, setBanner] = useState<InAppBanner | null>(current);
    useEffect(() => {
        bannerListeners.add(setBanner);
        setBanner(current);
        return () => {
            bannerListeners.delete(setBanner);
        };
    }, []);
    return banner;
}

/** For tests. */
export function __resetInAppAlerts(): void {
    enabled = true;
    loaded = false;
    current = null;
    shownIds.clear();
}
