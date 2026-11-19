import AsyncStorage from '@react-native-async-storage/async-storage';

/** One line of what was said in a video call. */
export interface TranscriptLine {
    id: string;
    /** `me` is this phone's owner; the other side is `other`. */
    speaker: 'me' | 'other';
    name: string;
    text: string;
    /** When it was said, epoch ms on this phone. */
    at: number;
    /** Daily's `user_id` of whoever spoke: the server decides owner or technician by it. */
    speakerId?: string;
}

const key = (appointmentId: string) => `video-transcript:${appointmentId}`;
const MAX_LINES = 2000;

const cache = new Map<string, TranscriptLine[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function load(appointmentId: string): Promise<TranscriptLine[]> {
    const hit = cache.get(appointmentId);
    if (hit) return hit;
    let lines: TranscriptLine[] = [];
    try {
        const raw = await AsyncStorage.getItem(key(appointmentId));
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) lines = parsed;
    } catch {
        lines = [];
    }
    cache.set(appointmentId, lines);
    return lines;
}

/** What this phone heard in the call, oldest first. */
export async function getLocalTranscript(appointmentId: string): Promise<TranscriptLine[]> {
    return [...(await load(appointmentId))];
}

/** Keeps a line (once: the same id is ignored) and saves them a moment later, so a burst is one write. */
export async function addTranscriptLine(appointmentId: string, line: TranscriptLine): Promise<void> {
    const lines = await load(appointmentId);
    if (lines.some((l) => l.id === line.id)) return;
    lines.push(line);
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    const pending = timers.get(appointmentId);
    if (pending) clearTimeout(pending);
    timers.set(
        appointmentId,
        setTimeout(() => {
            timers.delete(appointmentId);
            AsyncStorage.setItem(key(appointmentId), JSON.stringify(lines)).catch(() => undefined);
        }, 800),
    );
}
