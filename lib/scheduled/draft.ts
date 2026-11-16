import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AssistanceRequest } from '@/lib/dao/interfaces';
import type { Attachment } from '@/lib/media/attachments';

/** The five steps of the scheduled-assistance request, in order. */
export const SCHEDULED_STEPS = 5;

/** Where the technician goes: a saved address, or wherever the phone is right now. */
export interface ScheduledLocation {
    source: 'saved' | 'current';
    addressId?: string;
    /** "Home", "Work"… or empty. */
    label: string;
    /** Street line shown to the owner and sent as the request's address. */
    line: string;
    lat: number;
    lng: number;
    zip: string;
}

/** Everything the owner has entered so far. Local files (evidence) are kept out: they cannot be restored. */
export interface ScheduledDraft {
    step: number;
    vehicleId: string | null;
    vehicleName: string;
    mileage: string;
    location: ScheduledLocation | null;
    /** True when the account holder is the one in the vehicle; the contact fields are then ignored. */
    contactIsOwner: boolean;
    contactFirst: string;
    contactLast: string;
    contactPhone: string;
    /** Catalog `code` of every selected service. */
    services: string[];
    /** Free text for something the catalog does not list. */
    customRequest: string;
    /** Service day, `YYYY-MM-DD` in the phone's local calendar. */
    date: string;
    /** Preferred window, minutes from midnight. */
    fromMin: number | null;
    toMin: number | null;
    symptoms: string;
}

export function emptyDraft(): ScheduledDraft {
    return {
        step: 1,
        vehicleId: null,
        vehicleName: '',
        mileage: '',
        location: null,
        contactIsOwner: true,
        contactFirst: '',
        contactLast: '',
        contactPhone: '',
        services: [],
        customRequest: '',
        date: '',
        fromMin: null,
        toMin: null,
        symptoms: '',
    };
}

/** The backend takes at most this many services in one request. */
export const MAX_SERVICES = 20;
/** The requested start must be at least this far from now (same-day requests). */
export const LEAD_MINUTES = 60;
/** How many days ahead the owner can book, counting today. */
export const DAYS_AHEAD = 8;
export const MAX_EVIDENCE = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const SLOT_FIRST = 6 * 60;
const SLOT_LAST = 21 * 60;
const SLOT_STEP = 30;

/** Selectable times of day, in minutes from midnight (6:00 AM to 9:00 PM, every 30 min). */
export function timeSlots(): number[] {
    const slots: number[] = [];
    for (let m = SLOT_FIRST; m <= SLOT_LAST; m += SLOT_STEP) slots.push(m);
    return slots;
}

/** "1:30 PM". Written by hand so it does not depend on the JS engine's Intl support. */
export function formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${m === 0 ? '00' : String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of a local date. */
export function toDateKey(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The days the owner can pick: today and the next `DAYS_AHEAD - 1`, as `YYYY-MM-DD`. */
export function bookableDates(now: Date = new Date()): string[] {
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        return toDateKey(d);
    });
}

/** Local `Date` of a `YYYY-MM-DD` key (midnight). */
export function dateFromKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** Earliest selectable minute on `dateKey`: 0 on a future day, now + lead time today. */
export function earliestMinutes(dateKey: string, now: Date = new Date()): number {
    if (dateKey !== toDateKey(now)) return 0;
    return now.getHours() * 60 + now.getMinutes() + LEAD_MINUTES;
}

/** True when the picked day is today: shorter quote window, offers close an hour before the start. */
export function isSameDay(dateKey: string, now: Date = new Date()): boolean {
    return dateKey === toDateKey(now);
}

/** Digits of the odometer field as a number, or undefined when empty. */
export function parseMileage(raw: string): number | undefined {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return undefined;
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : undefined;
}

/** Whether the step's required inputs are filled in. */
export function stepIsValid(step: number, d: ScheduledDraft, now: Date = new Date()): boolean {
    switch (step) {
        case 1:
            return !!d.vehicleId;
        case 2: {
            const contactOk = d.contactIsOwner || (!!d.contactFirst.trim() && !!d.contactLast.trim() && !!d.contactPhone.trim());
            return !!d.location && Number.isFinite(d.location.lat) && Number.isFinite(d.location.lng) && contactOk;
        }
        case 3:
            return d.services.length > 0 && d.services.length <= MAX_SERVICES;
        case 4: {
            if (!d.date || d.fromMin == null || d.toMin == null) return false;
            if (d.toMin <= d.fromMin) return false;
            return d.fromMin >= earliestMinutes(d.date, now);
        }
        default:
            return true;
    }
}

/** The first step whose required inputs are missing, or null when the request is complete. */
export function firstIncompleteStep(d: ScheduledDraft, now: Date = new Date()): number | null {
    for (let step = 1; step < SCHEDULED_STEPS; step++) {
        if (!stepIsValid(step, d, now)) return step;
    }
    return null;
}

/** The ISO instant the request is dated: the service day at the start of the window. */
export function serviceDateISO(d: ScheduledDraft): string | undefined {
    if (!d.date || d.fromMin == null) return undefined;
    const day = dateFromKey(d.date);
    day.setHours(Math.floor(d.fromMin / 60), d.fromMin % 60, 0, 0);
    return day.toISOString();
}

/** Short request title: the first services by name, then "+N". English base names, as mechanics read them. */
export function requestTitle(serviceNames: string[]): string {
    if (serviceNames.length === 0) return 'Scheduled assistance';
    const shown = serviceNames.slice(0, 2).join(', ');
    return serviceNames.length > 2 ? `${shown} +${serviceNames.length - 2}` : shown;
}

/**
 * The free text mechanics read. The backend has one `notes` field and only one `date`, so the
 * preferred window's end and the owner's own words travel here.
 */
export function buildNotes(d: ScheduledDraft): string {
    const lines: string[] = [];
    if (d.fromMin != null && d.toMin != null) {
        // No label: technicians read this line on its own, as "Fri, Nov 20 · 9:00 AM – 12:00 PM".
        const day = d.date ? `${dateFromKey(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ` : '';
        lines.push(`${day}${formatMinutes(d.fromMin)} – ${formatMinutes(d.toMin)}`);
    }
    if (d.customRequest.trim()) lines.push(`Other request: ${d.customRequest.trim()}`);
    if (d.symptoms.trim()) lines.push(`Symptoms / special requests: ${d.symptoms.trim()}`);
    return lines.join('\n');
}

/** The body of `POST /assistance` for a scheduled request. */
export function buildScheduledPayload(args: {
    draft: ScheduledDraft;
    userId: string;
    serviceNames: string[];
    photos: Attachment[];
    paymentMethodId?: string | null;
}): Partial<AssistanceRequest> {
    const { draft: d, userId, serviceNames, photos, paymentMethodId } = args;
    const mileage = parseMileage(d.mileage);
    const date = serviceDateISO(d);
    return {
        userId,
        title: requestTitle(serviceNames),
        notes: buildNotes(d),
        type: 'scheduled',
        assistanceType: 'scheduled',
        vehicleId: d.vehicleId ?? undefined,
        car: d.vehicleName,
        address: d.location?.line ?? '',
        locationLat: d.location?.lat,
        locationLng: d.location?.lng,
        zip: d.location?.zip ?? '',
        status: 'pending',
        photos,
        services: d.services.map((code) => ({ code })),
        ...(date ? { date } : {}),
        ...(mileage !== undefined ? { mileage } : {}),
        driverIsOwner: d.contactIsOwner,
        ...(!d.contactIsOwner && d.contactFirst.trim() ? { driverFirstName: d.contactFirst.trim() } : {}),
        ...(!d.contactIsOwner && d.contactLast.trim() ? { driverLastName: d.contactLast.trim() } : {}),
        ...(!d.contactIsOwner && d.contactPhone.trim() ? { driverPhone: d.contactPhone.trim() } : {}),
        ...(paymentMethodId ? { paymentMethodId } : {}),
    };
}

// ── Draft storage ─────────────────────────────────────────────────────────────

const KEY = 'scheduled.draft.v1';

export async function loadDraft(scope: string): Promise<ScheduledDraft | null> {
    try {
        const raw = await AsyncStorage.getItem(`${KEY}.${scope}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<ScheduledDraft>;
        // Merge over the empty draft so a draft saved by an older build still has every field.
        return { ...emptyDraft(), ...parsed };
    } catch {
        return null;
    }
}

export async function saveDraft(scope: string, draft: ScheduledDraft): Promise<void> {
    try {
        await AsyncStorage.setItem(`${KEY}.${scope}`, JSON.stringify(draft));
    } catch {
        // A draft that cannot be saved just is not restored.
    }
}

export async function clearDraft(scope: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(`${KEY}.${scope}`);
    } catch {
        // Nothing to do.
    }
}

/** True when the owner has entered something worth restoring. */
export function hasProgress(d: ScheduledDraft): boolean {
    return (
        d.step > 1 ||
        !!d.vehicleId ||
        !!d.location ||
        d.services.length > 0 ||
        !!d.customRequest.trim() ||
        !!d.symptoms.trim()
    );
}

// ── Request again ─────────────────────────────────────────────────────────────

/**
 * Seeds a new draft from an earlier scheduled request: same vehicle, place, contact and services.
 * Date, window, mileage and symptoms are left empty (they must be fresh), so it opens on the
 * availability step. Services keep their catalog codes; the wizard drops any the catalog no
 * longer offers.
 */
export function draftFromRequest(req: {
    vehicleId?: string;
    car?: string;
    address?: string;
    locationLat?: number;
    locationLng?: number;
    zip?: string;
    driverIsOwner?: boolean;
    driverFirstName?: string;
    driverLastName?: string;
    driverPhone?: string;
    services?: { code: string }[];
}): ScheduledDraft {
    const hasPlace = !!req.address && typeof req.locationLat === 'number' && typeof req.locationLng === 'number';
    return {
        ...emptyDraft(),
        step: 4,
        vehicleId: req.vehicleId ?? null,
        vehicleName: req.car ?? '',
        location: hasPlace
            ? { source: 'current', label: '', line: req.address as string, lat: req.locationLat as number, lng: req.locationLng as number, zip: req.zip ?? '' }
            : null,
        contactIsOwner: req.driverIsOwner !== false,
        contactFirst: req.driverFirstName ?? '',
        contactLast: req.driverLastName ?? '',
        contactPhone: req.driverPhone ?? '',
        services: Array.from(new Set((req.services ?? []).map((s) => s.code))).slice(0, MAX_SERVICES),
    };
}
