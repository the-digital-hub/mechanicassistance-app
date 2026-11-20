import AsyncStorage from '@react-native-async-storage/async-storage';

import type { OnSiteVisit } from '@/lib/dao/OnSiteDAO';

/** 17 letters and digits, never I, O or Q. */
export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Upper-case, without spaces or dashes — what a person types or a label prints. */
export function normalizeVin(text: string): string {
    return text.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidVin(text: string): boolean {
    return VIN_REGEX.test(normalizeVin(text));
}

const TRANSLITERATION: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * North-American check digit (position 9). Vehicles made for other markets do not
 * follow it, so a failure is a hint to double-check the VIN, never a reason to block.
 */
export function vinCheckDigitOk(text: string): boolean {
    const vin = normalizeVin(text);
    if (!VIN_REGEX.test(vin)) return false;
    let sum = 0;
    for (let i = 0; i < 17; i++) {
        const c = vin[i];
        const value = /\d/.test(c) ? Number(c) : TRANSLITERATION[c];
        sum += value * WEIGHTS[i];
    }
    const expected = sum % 11 === 10 ? 'X' : String(sum % 11);
    return vin[8] === expected;
}

/**
 * Pulls a VIN out of what a barcode carried. The door-jamb and windshield labels hold
 * the bare VIN (Code 39 / Code 128, sometimes with a leading "I"); registration and
 * some labels carry it inside a longer text (PDF417, DataMatrix, QR). Null when there
 * is no single VIN in it.
 */
export function extractVin(scanned: string): string | null {
    const text = scanned.toUpperCase().trim();
    // Code 39 on some US labels is the VIN with an "I" in front (18 characters).
    if (text.length === 18 && text.startsWith('I') && VIN_REGEX.test(text.slice(1))) return text.slice(1);
    const compact = normalizeVin(text);
    if (VIN_REGEX.test(compact)) return compact;
    const found = new Set(text.match(/(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{17}(?![A-Z0-9])/g) ?? []);
    return found.size === 1 ? [...found][0] : null;
}

/**
 * Looks for a VIN in the lines of text read from a photo of the door label or the windshield. Text reading mixes up look-alike
 * characters (a VIN has no I, O or Q, so those are really 1, 0 and 0), so each line is read as it is and with that correction.
 * A reading whose check digit holds wins over one that does not; null when no line holds a single plausible VIN.
 */
export function extractVinFromText(lines: string[]): string | null {
    const found = new Map<string, boolean>(); // VIN -> its check digit holds
    for (const line of lines) {
        const compact = line.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (compact.length < 17) continue;
        const fixed = compact.replace(/I/g, '1').replace(/[OQ]/g, '0');
        for (const text of new Set([compact, fixed])) {
            // The VIN usually is the whole line; with a prefix (a label word) it is any 17 characters that read as a VIN.
            for (let i = 0; i + 17 <= text.length; i++) {
                const candidate = text.slice(i, i + 17);
                if (VIN_REGEX.test(candidate) && /\d/.test(candidate) && /[A-Z]/.test(candidate)) {
                    found.set(candidate, found.get(candidate) === true || vinCheckDigitOk(candidate));
                }
            }
        }
    }
    const valid = [...found.entries()].filter(([, ok]) => ok).map(([vin]) => vin);
    if (valid.length >= 1) return valid[0];
    // No check digit holds (a market that does not use it, or a character misread): only trust a single candidate.
    return found.size === 1 ? [...found.keys()][0] : null;
}

export type VinComparison = 'match' | 'differ' | 'unknown';

export function compareVins(a?: string | null, b?: string | null): VinComparison {
    if (!a || !b) return 'unknown';
    return normalizeVin(a) === normalizeVin(b) ? 'match' : 'differ';
}

/**
 * The VIN the owner declared on the request. The backend only sends it when the OBD
 * reading differs from it; when they agree the OBD VIN is the declared one. Null when
 * nothing was read to compare it with.
 */
export function declaredVin(visit: Pick<OnSiteVisit, 'obdVin' | 'obdVinMismatch' | 'vehicleVin'> | null | undefined): string | null {
    if (!visit) return null;
    if (visit.obdVinMismatch === true) return visit.vehicleVin ?? null;
    if (visit.obdVinMismatch === false) return visit.obdVin ?? null;
    return null;
}

/** What the mechanic captured on the vehicle; kept on the device until the visit supports it. */
export interface VinCapture {
    vin: string;
    /** Odometer in miles, digits only; empty when not given. */
    odometer: string;
}

const key = (appointmentId: string) => `mechanic_onsite_vin_${appointmentId}`;

export async function getVinCapture(appointmentId: string): Promise<VinCapture | null> {
    try {
        const raw = await AsyncStorage.getItem(key(appointmentId));
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<VinCapture>;
        return { vin: typeof v.vin === 'string' ? v.vin : '', odometer: typeof v.odometer === 'string' ? v.odometer : '' };
    } catch {
        return null;
    }
}

export async function saveVinCapture(appointmentId: string, capture: VinCapture): Promise<void> {
    try {
        await AsyncStorage.setItem(key(appointmentId), JSON.stringify(capture));
    } catch {
        // Convenience only: a storage failure must not stop the flow.
    }
}
