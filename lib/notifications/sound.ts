import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

// The Sound switch of Settings → Notifications: with it on, an alert that arrives while the app is open rings a small bell. (A push that
// arrives with the app closed is sounded by the system's own notification settings.) It follows the phone's silent switch.

const KEY = 'settings:notifySound';

let enabled = true;
let loaded = false;
const listeners = new Set<(on: boolean) => void>();
let player: AudioPlayer | null = null;

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

/** The bell itself, from the start every time. Never throws. */
export function ringBell(): void {
    try {
        if (!player) player = createAudioPlayer(require('@/assets/sounds/bell.wav'));
        void player.seekTo(0);
        player.play();
    } catch {
        // No audio (a simulator without output, a player that could not start): the alert is still on screen.
    }
}

/** Rings if the person left Sound on. */
export async function ringIfEnabled(): Promise<void> {
    if (await load()) ringBell();
}

export async function setSoundEnabled(on: boolean): Promise<void> {
    enabled = on;
    loaded = true;
    listeners.forEach((fn) => fn(on));
    // Turning it on rings once: that is how the person hears what they chose.
    if (on) ringBell();
    try {
        await AsyncStorage.setItem(KEY, on ? '1' : '0');
    } catch {
        // The choice still holds for this session.
    }
}

/** The switch's state and its setter, kept in step wherever it is shown. */
export function useSoundEnabled(): [boolean, (on: boolean) => void] {
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
    return [on, (next) => void setSoundEnabled(next)];
}

/** For tests. */
export function __resetSound(): void {
    enabled = true;
    loaded = false;
    player = null;
}
