import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Vibration } from 'react-native';

// The Vibrate switch of Settings → Notifications: with it on, an alert that arrives while the app is open buzzes the phone. (A push that
// arrives with the app closed is vibrated or not by the system's own notification settings, which an app cannot override.)

const KEY = 'settings:notifyVibrate';

let enabled = false;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();

async function load(): Promise<boolean> {
    if (loaded) return enabled;
    try {
        enabled = (await AsyncStorage.getItem(KEY)) === '1';
    } catch {
        enabled = false;
    }
    loaded = true;
    return enabled;
}

/** The buzz itself: two short pulses (iOS plays its fixed one). Never throws. */
export function buzz(): void {
    try {
        Vibration.vibrate([0, 250, 120, 250]);
    } catch {
        // A device without a vibration motor (or a simulator): nothing to do.
    }
}

/** Buzzes if the person turned Vibrate on. */
export async function vibrateIfEnabled(): Promise<void> {
    if (await load()) buzz();
}

export async function setVibrateEnabled(on: boolean): Promise<void> {
    enabled = on;
    loaded = true;
    listeners.forEach((fn) => fn(on));
    // Turning it on buzzes once: that is how the person knows what they chose.
    if (on) buzz();
    try {
        await AsyncStorage.setItem(KEY, on ? '1' : '0');
    } catch {
        // The choice still holds for this session.
    }
}

/** The switch's state and its setter, kept in step wherever it is shown. */
export function useVibrateEnabled(): [boolean, (on: boolean) => void] {
    const [on, setOn] = useState(enabled);
    useEffect(() => {
        let alive = true;
        void load().then((v) => alive && setOn(v));
        listeners.add(setOn);
        return () => {
            alive = false;
            listeners.delete(setOn);
        };
    }, []);
    return [on, (next) => void setVibrateEnabled(next)];
}

/** For tests. */
export function __resetVibration(): void {
    enabled = false;
    loaded = false;
}
