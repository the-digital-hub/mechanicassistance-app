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

/** "2021 Toyota Corolla", skipping whatever is missing. */
export function vehicleLabel(m: MarketplaceRequest): string {
    const v = m.vehicle;
    return [v?.year, v?.make, v?.model].filter((x) => x !== undefined && x !== null && x !== '').join(' ');
}

/** "3.2 mi away", or empty when the distance is unknown. */
export function distanceLabel(miles: number | null | undefined): string {
    if (miles === null || miles === undefined || !Number.isFinite(miles)) return '';
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

/** Requests made before the label was dropped: "Preferred window: 9 AM – 12 PM" becomes "Fri, Nov 20 · 9 AM – 12 PM". */
export function notesWithDay(notes: string | null | undefined, date: string | null | undefined): string | undefined {
    if (!notes) return undefined;
    const d = date ? new Date(date) : null;
    const day = d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;
    return notes.replace(/^Preferred window: (?:\w{3}, \w{3} \d+, )?/m, day ? `${day} · ` : '');
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
        status: 'pending',
        locationLat: typeof lat === 'number' ? lat : undefined,
        locationLng: typeof lng === 'number' ? lng : undefined,
        offersCloseAt: m.offersCloseAt ?? null,
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
    if (code === 'offers_closed') return 'closed';
    if (code === 'quote_slot_invalid' || code === 'quote_validity_invalid') return 'slot';
    if (code === 'quote_price_required' || code === 'quote_price_invalid' || code === 'quote_diagnostic_fee_required' || code === 'quote_amount_too_high') return 'price';
    if (code === 'quote_description_required') return 'description';
    return feedProblem(code);
}
