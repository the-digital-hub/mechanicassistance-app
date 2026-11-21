import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

// The Sound switch of Settings → Notifications: with it on, an alert that arrives while the app is open rings a small bell. (A push that
// arrives with the app closed is sounded by the system's own notification settings.) The person turned Sound on in the app, so the bell also
// rings with the phone's silent switch on (the switch here is the way to silence it).

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

let modeSet = false;

/** The bell itself, from the start every time. Never throws. */
export function ringBell(): void {
    try {
        if (!modeSet) {
            modeSet = true;
            // Mixed with whatever is playing (music, a call): the bell must not stop it. It rings even with the phone on silent: with the
            // ringer switch on silent (very common) an app that obeys it just seems broken, and Sound is a switch the person chose to turn on.
            // `allowsRecording` stays on: a playback-only session stays set for the whole app and then the camera cannot record
            // video (black screen, crash) when the picker starts its microphone. Setting the mode is a courtesy: if it fails the bell still plays.
            try {
                void Promise.resolve(setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, interruptionMode: 'mixWithOthers' })).catch((e) => console.warn('[sound] audio mode failed', e));
            } catch (e) {
                console.warn('[sound] audio mode failed', e);
            }
        }
        if (!player) {
            player = createAudioPlayer(require('@/assets/sounds/bell.wav'));
            player.volume = 1;
        }
        // Back to the start (a bell still ringing restarts), then play; neither may break the alert.
        void Promise.resolve(player.seekTo(0)).catch(() => undefined);
        player.play();
    } catch (e) {
        // No audio (a simulator without output, a player that could not start): the alert is still on screen.
        console.warn('[sound] bell failed', e);
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
    modeSet = false;
}
