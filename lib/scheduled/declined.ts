import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'scheduled.declined.v1';

/** Requests the technician skipped on this phone. The marketplace has no decline call: they just stop being listed. */
export async function loadDeclined(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

export async function declineRequest(id: string): Promise<void> {
    try {
        const ids = await loadDeclined();
        if (!ids.includes(id)) await AsyncStorage.setItem(KEY, JSON.stringify([...ids, id].slice(-200)));
    } catch {
        // Not being able to remember it just means it is listed again.
    }
}
