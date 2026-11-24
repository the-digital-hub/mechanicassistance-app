import type { AssistanceRequest, MarketplaceRequest, OfferInput } from '@/lib/dao/interfaces';

/** Providers need at least this many characters in the quote's description. */
export const MIN_DESCRIPTION = 10;

/** What the feed answers when the provider cannot see requests yet; each one gets its own message. */
export type FeedProblem =
    | 'notProvider'
    | 'identityPending'
    | 'suspended'
    | 'notEnabled'
    | 'baseLocationMissing'
    | 'noCategories'
    | 'generic';

export function feedProblem(code: string | undefined): FeedProblem {
    switch (code) {
        case 'not_a_provider': return 'notProvider';
        case 'marketplace_identity_pending':
        case 'VERIFICATION_REQUIRED': return 'identityPending';
        case 'marketplace_suspended': return 'suspended';
        case 'marketplace_not_enabled': return 'notEnabled';
        case 'marketplace_base_location_missing': return 'baseLocationMissing';
        case 'marketplace_no_categories': return 'noCategories';
        default: return 'generic';
    }
}

/** "Toyota Corolla (2021)": make, model and the year in parentheses, skipping whatever is missing. */
export function vehicleLabel(m: MarketplaceRequest): string {
    const v = m.vehicle;
    const has = (x: unknown) => x !== undefined && x !== null && x !== '';
    const name = [v?.make, v?.model].filter(has).join(' ');
    return has(v?.year) ? (name ? `${name} (${v?.year})` : String(v?.year)) : name;
}

/** "3.2 mi away", or empty when the distance is unknown. */
export function distanceLabel(miles: number | null | undefined): string {
    if (miles === null || miles === undefined || !Number.isFinite(miles)) return '';
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

/** Requests made before the label was dropped: "Preferred window: 9 AM – 12 PM" becomes "Fri, Nov 20 · 9 AM – 12 PM". */
export function notesWithDay(notes: string | null | undefined, date: string | null | undefined): string | undefined {
    if (!notes) return undefined;
    notes = normalizeAvailabilityLines(notes);
    const d = calendarDate(date);
    const day = d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;
    return notes.replace(/^Preferred window: (?:\w{3}, \w{3} \d+, )?/m, day ? `${day} · ` : '');
}

/**
 * The day a request is dated, as a local calendar date. A date with no time (or midnight UTC, which is how a bare day is read) names a
 * day, not an instant: read as an instant it lands on the evening before in the Americas ("Nov 25" showed as "Nov 24").
 */
export function calendarDate(date: string | null | undefined): Date | null {
    if (!date) return null;
    const bare = date.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?Z?)?$/);
    if (bare) return new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]));
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
}

const dayKeyLabel = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/**
 * Availability written in another shape than the app's own ("Rango 2026-11-25 al 2026-11-26 (10:00 AM - 7:00 PM EST)", or a window with a
 * plain hyphen) is put into the shape the screens read: "Wed, Nov 25 – Thu, Nov 26 · 10:00 AM – 7:00 PM".
 */
export function normalizeAvailabilityLines(notes: string): string {
    return notes
        .split('\n')
        .map((line) => {
            const range = line.match(/^\s*(?:Rango|Range)\s+(\d{4}-\d{2}-\d{2})\s+(?:al|to)\s+(\d{4}-\d{2}-\d{2})\s*\(?\s*(\d{1,2}:\d{2} [AP]M)\s*[-–—]\s*(\d{1,2}:\d{2} [AP]M)[^)]*\)?\s*$/i);
            if (range) {
                const days = range[1] === range[2] ? dayKeyLabel(range[1]) : `${dayKeyLabel(range[1])} – ${dayKeyLabel(range[2])}`;
                return `${days} · ${range[3]} – ${range[4]}`;
            }
            return line.replace(/(\d{1,2}:\d{2} [AP]M)\s*[-—]\s*(\d{1,2}:\d{2} [AP]M)(\s*[A-Z]{2,4})?\s*$/, '$1 – $2');
        })
        .join('\n');
}

/**
 * Shapes a marketplace request like the rest of the feed so the existing cards can show it.
 * `address` carries only what the provider may see: the zip and the distance, never a street.
 */
export function toFeedRequest(m: MarketplaceRequest): AssistanceRequest {
    const loc = m.approximateLocation;
    const lat = loc?.lat ?? loc?.latitude;
    const lng = loc?.lng ?? loc?.longitude;
    const services = (m.services ?? []).map((s) => s.name).filter(Boolean);
    return {
        id: m.id,
        refCode: m.refCode ?? undefined,
        type: 'scheduled',
        assistanceType: m.assistanceType ?? 'scheduled',
        title: m.title || services.slice(0, 2).join(', '),
        car: vehicleLabel(m),
        address: m.zip ?? '',
        zip: m.zip ?? undefined,
        notes: notesWithDay(m.notes, m.date),
        budget: '',
        // Never a price from the customer: only the provider's own quote, once sent.
        price: m.myOffer?.price ?? undefined,
        distance: distanceLabel(m.distanceMiles) || undefined,
        date: m.date ?? undefined,
        createdAt: m.createdAt ?? undefined,
        status: 'pending',
        locationLat: typeof lat === 'number' ? lat : undefined,
        locationLng: typeof lng === 'number' ? lng : undefined,
        offersCloseAt: m.offersCloseAt ?? null,
        myQuote: m.myOffer ? { price: m.myOffer.price ?? null, status: m.myOffer.status ?? null, validUntil: m.myOffer.validUntil ?? null, createdAt: m.myOffer.createdAt ?? null } : null,
    };
}

/** `"150"`, `"150.5"`, `"$1,150.50"` → `"150.00"` style string; null when it is not a positive amount. */
export function parsePrice(raw: string): string | null {
    const cleaned = raw.replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n.toFixed(2);
}

export interface OfferForm {
    quoteType: 'final' | 'diagnostic_then_quote';
    price: string;
    diagnosticFee: string;
    description: string;
    warrantyDays: string;
    warrantyCoverage: string;
    /** Proposed slot, ISO. Both or none. */
    proposedStart?: string;
    proposedEnd?: string;
}

export type OfferFormError = 'price' | 'diagnosticFee' | 'description' | 'slot' | null;

export function validateOffer(f: OfferForm, now: Date = new Date()): OfferFormError {
    if (f.quoteType === 'final' && !parsePrice(f.price)) return 'price';
    if (f.quoteType === 'diagnostic_then_quote' && !parsePrice(f.diagnosticFee)) return 'diagnosticFee';
    if (f.description.trim().length < MIN_DESCRIPTION) return 'description';
    if (f.proposedStart || f.proposedEnd) {
        if (!f.proposedStart || !f.proposedEnd) return 'slot';
        const start = Date.parse(f.proposedStart);
        const end = Date.parse(f.proposedEnd);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start <= now.getTime() || end <= start) return 'slot';
    }
    return null;
}

/** The request body. `price` is forbidden on a diagnostic quote and `diagnosticFee` on a final one. */
export function buildOffer(f: OfferForm): OfferInput {
    const days = parseInt(f.warrantyDays.replace(/\D/g, ''), 10);
    return {
        quoteType: f.quoteType,
        ...(f.quoteType === 'final' ? { price: parsePrice(f.price) ?? undefined } : { diagnosticFee: parsePrice(f.diagnosticFee) ?? undefined }),
        description: f.description.trim(),
        ...(f.proposedStart && f.proposedEnd ? { proposedStart: f.proposedStart, proposedEnd: f.proposedEnd } : {}),
        ...(Number.isFinite(days) && days > 0 ? { warrantyDays: days } : {}),
        ...(f.warrantyCoverage.trim() ? { warrantyCoverage: f.warrantyCoverage.trim() } : {}),
    };
}

/** Which message a failed quote deserves. */
export type OfferSubmitProblem = 'closed' | 'slot' | 'price' | 'description' | FeedProblem;

export function offerSubmitProblem(code: string | undefined): OfferSubmitProblem {
    if (code === 'offers_closed' || code === 'request_unavailable') return 'closed';
    if (code === 'quote_slot_invalid' || code === 'quote_validity_invalid') return 'slot';
    if (code === 'quote_price_required' || code === 'quote_price_invalid' || code === 'quote_diagnostic_fee_required' || code === 'quote_amount_too_high') return 'price';
    if (code === 'quote_description_required') return 'description';
    return feedProblem(code);
}

// ── What the owner asked, read back from the request's notes ─────────────────

export interface RequestNotes {
    /** `workshop` when the owner will take the vehicle to a repair shop. */
    mode: 'onsite' | 'workshop';
    /** "Fri, Nov 20" or "Fri, Nov 20 – Sun, Nov 22"; empty when the notes carry none. */
    days: string;
    /** "8:00 AM – 12:00 PM"; empty when the notes carry none. */
    window: string;
    /** The owner's words for one service, by the service's name. */
    serviceNotes: Record<string, string>;
    other: string;
    symptoms: string;
}

const WINDOW_LINE = /(\d{1,2}:\d{2} [AP]M) – (\d{1,2}:\d{2} [AP]M)\s*$/;

/** Reads the free text the app writes (`buildNotes`): the window line, service details, other request, symptoms. */
export function parseRequestNotes(notes: string | null | undefined, date?: string | null): RequestNotes {
    const out: RequestNotes = { mode: 'onsite', days: '', window: '', serviceNotes: {}, other: '', symptoms: '' };
    let last: { kind: 'service' | 'other' | 'symptoms'; key?: string } | null = null;
    for (const raw of (notesWithDay(notes, date) ?? '').split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const win = line.match(WINDOW_LINE);
        if (/^At a repair shop/.test(line)) {
            out.mode = 'workshop';
            last = null;
        } else if (win && !out.window && !/^[A-Za-z][^:·]*: /.test(line)) {
            out.window = `${win[1]} – ${win[2]}`;
            out.days = line.replace(WINDOW_LINE, '').replace(/\s*·\s*$/, '').trim();
            last = null;
        } else if (/^Other request: /.test(line)) {
            out.other = line.replace(/^Other request: /, '');
            last = { kind: 'other' };
        } else if (/^Symptoms \/ special requests: /.test(line)) {
            out.symptoms = line.replace(/^Symptoms \/ special requests: /, '');
            last = { kind: 'symptoms' };
        } else {
            const m = line.match(/^(.+?): (.+)$/);
            if (m) {
                out.serviceNotes[m[1]] = m[2];
                last = { kind: 'service', key: m[1] };
            } else if (last?.kind === 'symptoms') out.symptoms += `\n${line}`;
            else if (last?.kind === 'other') out.other += `\n${line}`;
            else if (last?.kind === 'service' && last.key) out.serviceNotes[last.key] += `\n${line}`;
        }
    }
    return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * The days the owner is available, as `YYYY-MM-DD` keys: from the request's date through the last day
 * named in `days` ("Fri, Nov 20 – Sun, Nov 22"). A single day when there is no range or it cannot be read.
 */
export function requestDays(days: string, date: string | null | undefined): string[] {
    const start = calendarDate(date);
    if (!start) return [];
    const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const end = days.split('–')[1]?.match(/([A-Z][a-z]{2}) (\d{1,2})/);
    if (!end) return [keyOf(first)];
    const month = MONTHS.indexOf(end[1]);
    if (month < 0) return [keyOf(first)];
    let last = new Date(first.getFullYear(), month, parseInt(end[2], 10));
    if (last < first) last = new Date(first.getFullYear() + 1, month, parseInt(end[2], 10));
    const keys: string[] = [];
    for (let d = new Date(first); d <= last && keys.length < 8; d.setDate(d.getDate() + 1)) keys.push(keyOf(d));
    return keys;
}

/** "8:00 AM" → 480. NaN when it does not read as a time. */
export function minutesOf(label: string): number {
    const m = label.match(/^(\d{1,2}):(\d{2}) ([AP]M)$/);
    if (!m) return NaN;
    return (parseInt(m[1], 10) % 12) * 60 + parseInt(m[2], 10) + (m[3] === 'PM' ? 12 * 60 : 0);
}

/** Arrival times the technician can offer inside the owner's window: its start, then every full hour before its end. */
export function arrivalTimes(window: string): number[] {
    const [a, b] = window.split(' – ');
    const from = minutesOf(a ?? '');
    const to = minutesOf(b ?? '');
    // No readable window (the request did not carry one in a shape we know): the technician still has to be able to name an arrival,
    // so the day is offered from 8:00 AM to 6:00 PM, on the hour. The customer sees the exact time in the quote anyway.
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return Array.from({ length: 11 }, (_, i) => (8 + i) * 60);
    const out: number[] = [from];
    for (let m = (Math.floor(from / 60) + 1) * 60; m < to && out.length < 8; m += 60) out.push(m);
    return out;
}

// ── The quote, the way the design builds it ──────────────────────────────────

export const DURATIONS = [
    { id: '1h', label: '1 h', minutes: 60 },
    { id: '1.5h', label: '1.5 h', minutes: 90 },
    { id: '2h', label: '2 h', minutes: 120 },
    { id: '3h', label: '3 h+', minutes: 180 },
] as const;

export const WARRANTIES = [
    { id: '30d', label: '30 days', days: 30 },
    { id: '90d', label: '90 days', days: 90 },
    { id: '6m', label: '6 months', days: 180 },
    { id: '12m', label: '12 months', days: 365 },
] as const;

export interface QuoteLine {
    name: string;
    on: boolean;
    /** What the technician typed; empty until filled. */
    price: string;
}

export interface QuoteDraft {
    lines: QuoteLine[];
    partsIncluded: boolean;
    travelFee: string;
    /** `YYYY-MM-DD` of the arrival day. */
    day: string;
    /** Arrival time, minutes from midnight. */
    time: number | null;
    durationId: (typeof DURATIONS)[number]['id'];
    warrantyId: (typeof WARRANTIES)[number]['id'];
    message: string;
}

/** `"1,250.5"` → 1250.5; 0 when it is not a number. */
export const amountOf = (raw: string): number => {
    const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
};

export interface QuoteTotals {
    subtotal: number;
    travel: number;
    total: number;
    priced: QuoteLine[];
    notIncluded: string[];
    /** A service is switched on but has no price. */
    missingPrice: boolean;
    valid: boolean;
}

export function quoteTotals(q: QuoteDraft): QuoteTotals {
    const priced = q.lines.filter((l) => l.on && amountOf(l.price) > 0);
    const subtotal = priced.reduce((s, l) => s + amountOf(l.price), 0);
    const travel = amountOf(q.travelFee);
    const missingPrice = q.lines.some((l) => l.on && amountOf(l.price) <= 0);
    return {
        subtotal,
        travel,
        total: subtotal + travel,
        priced,
        notIncluded: q.lines.filter((l) => !l.on).map((l) => l.name),
        missingPrice,
        valid: priced.length > 0 && !missingPrice,
    };
}

/** Start and end of the arrival slot (ISO), from the day, the time and how long the job takes. */
export function arrivalSlot(q: QuoteDraft): { start: string; end: string } | null {
    if (!q.day || q.time === null) return null;
    const [y, m, d] = q.day.split('-').map(Number);
    const start = new Date(y, m - 1, d, Math.floor(q.time / 60), q.time % 60, 0, 0);
    const minutes = DURATIONS.find((x) => x.id === q.durationId)?.minutes ?? 120;
    return { start: start.toISOString(), end: new Date(start.getTime() + minutes * 60000).toISOString() };
}

/** What the owner reads, and the machine block their app lists as service lines. */
export function buildQuoteDescription(q: QuoteDraft): string {
    const t = quoteTotals(q);
    const lines = [`Quote for: ${t.priced.map((l) => l.name).join(', ')}.`];
    if (t.notIncluded.length) lines.push(`Not included: ${t.notIncluded.join(', ')}.`);
    lines.push(q.partsIncluded ? 'Parts included in the prices.' : 'Parts supplied by the customer.');
    if (t.travel > 0) lines.push(`Travel fee: $${t.travel.toFixed(2)}.`);
    if (q.message.trim()) lines.push(q.message.trim());
    const block = {
        items: [
            ...q.lines.map((l) => ({
                serviceName: l.name,
                status: l.on ? 'quoted' : 'not_quoted',
                ...(l.on ? { laborPrice: amountOf(l.price), itemTotal: amountOf(l.price) } : {}),
            })),
            ...(t.travel > 0 ? [{ serviceName: 'Travel fee', status: 'quoted', laborPrice: t.travel, itemTotal: t.travel }] : []),
        ],
    };
    return `${lines.join('\n')}\n[MA_ITEMIZED_QUOTE:v1]${JSON.stringify(block)}[/MA_ITEMIZED_QUOTE]`;
}

/** The body of `POST /assistance/:id/offers` for the design's quote: one final price for everything priced. */
export function buildQuoteOffer(q: QuoteDraft): OfferInput {
    const slot = arrivalSlot(q);
    const days = WARRANTIES.find((w) => w.id === q.warrantyId)?.days;
    return {
        quoteType: 'final',
        price: quoteTotals(q).total.toFixed(2),
        description: buildQuoteDescription(q),
        ...(slot ? { proposedStart: slot.start, proposedEnd: slot.end } : {}),
        ...(days ? { warrantyDays: days } : {}),
    };
}

/** Why a quote cannot be sent yet. */
export function quoteProblem(q: QuoteDraft, now: Date = new Date()): 'services' | 'prices' | 'arrival' | null {
    const t = quoteTotals(q);
    if (!t.valid) return t.priced.length === 0 && !t.missingPrice ? 'services' : 'prices';
    const slot = arrivalSlot(q);
    if (!slot || Date.parse(slot.start) <= now.getTime()) return 'arrival';
    return null;
}
