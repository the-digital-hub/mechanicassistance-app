import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiClient } from '@/lib/api/apiClient';

/**
 * Consent for transcribing a video call. Both people accept the conditions before entering the call,
 * and again, one to the other, at the moment live captions (and so the transcript) are turned on.
 * Every answer is kept on this phone with its time and the version of the text that was shown, and is
 * also sent to the server on a best-effort basis (the endpoint may not exist yet: see the backend brief).
 *
 * Bump `CONSENT_VERSION` whenever the wording shown to people changes.
 */
export const CONSENT_VERSION = '2026-11-18';

export type ConsentKind = 'precall' | 'captions-request' | 'captions-answer' | 'translation';

export interface ConsentRecord {
    id: string;
    version: string;
    kind: ConsentKind;
    /** Who gave it. */
    role: 'owner' | 'mechanic';
    accepted: boolean;
    /** ISO time on this phone. */
    at: string;
}

const key = (appointmentId: string) => `video-consent:${appointmentId}`;

export async function getConsents(appointmentId: string): Promise<ConsentRecord[]> {
    try {
        const raw = await AsyncStorage.getItem(key(appointmentId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/** Has this role already accepted the conditions of the call (with the current text)? */
export async function hasPreCallConsent(appointmentId: string, role: 'owner' | 'mechanic'): Promise<ConsentRecord | null> {
    const all = await getConsents(appointmentId);
    return all.find((c) => c.kind === 'precall' && c.role === role && c.accepted && c.version === CONSENT_VERSION) ?? null;
}

/** Keeps the answer here and tells the server; never throws (the call must not depend on it). */
export async function recordConsent(
    appointmentId: string,
    entry: { kind: ConsentKind; role: 'owner' | 'mechanic'; accepted: boolean; at?: string },
): Promise<ConsentRecord> {
    const record: ConsentRecord = {
        id: `${entry.kind}:${entry.role}:${Date.now().toString(36)}`,
        version: CONSENT_VERSION,
        kind: entry.kind,
        role: entry.role,
        accepted: entry.accepted,
        at: entry.at ?? new Date().toISOString(),
    };
    try {
        const all = await getConsents(appointmentId);
        await AsyncStorage.setItem(key(appointmentId), JSON.stringify([...all, record].slice(-50)));
    } catch {
        /* storage unavailable */
    }
    // Only the answers of this phone's own person are reported: the other phone reports theirs.
    try {
        await apiClient.post(`/api/appointments/${appointmentId}/video/consent`, {
            version: record.version,
            kind: record.kind,
            role: record.role,
            accepted: record.accepted,
            at: record.at,
        });
    } catch {
        /* no endpoint yet, or offline: the local record stands */
    }
    return record;
}
