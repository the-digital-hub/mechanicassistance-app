import type { MarketplaceOffer } from '@/lib/dao/interfaces';

/** "$1,234.50" from a decimal string or number; "—" when there is nothing to show. */
export function money(value: string | number | null | undefined): string {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    if (!Number.isFinite(n)) return '—';
    const [whole, cents] = Math.abs(n).toFixed(2).split('.');
    return `${n < 0 ? '-' : ''}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

/** What the owner would pay, as a number, or null when the backend could not calculate it. */
export function totalOf(offer: MarketplaceOffer): number | null {
    const n = parseFloat(offer.customerTotal?.amount ?? '');
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Offers still open for a decision. Withdrawn, expired and not-selected ones are only history. */
export function isOpen(offer: MarketplaceOffer): boolean {
    return offer.status === 'submitted';
}

/**
 * Whether the owner can select it now: open, with a calculated total, not past `validUntil`, and
 * its proposed slot has not started (an offer with a slot lapses when the slot begins).
 */
export function canSelect(offer: MarketplaceOffer, now: Date = new Date()): boolean {
    if (!isOpen(offer) || totalOf(offer) === null) return false;
    if (offer.validUntil && Date.parse(offer.validUntil) <= now.getTime()) return false;
    if (offer.proposedStart && Date.parse(offer.proposedStart) <= now.getTime()) return false;
    return true;
}

/** Open offers, cheapest total first; those without a total go last, oldest first among equals. */
export function openOffersByTotal(offers: readonly MarketplaceOffer[]): MarketplaceOffer[] {
    return offers
        .filter(isOpen)
        .map((offer, index) => ({ offer, index }))
        .sort((a, b) => {
            const ta = totalOf(a.offer);
            const tb = totalOf(b.offer);
            if (ta === null && tb === null) return a.index - b.index;
            if (ta === null) return 1;
            if (tb === null) return -1;
            return ta - tb || a.index - b.index;
        })
        .map(({ offer }) => offer);
}

/** The id of the cheapest selectable offer, or null when there are fewer than two to compare. */
export function bestOfferId(offers: readonly MarketplaceOffer[], now: Date = new Date()): string | null {
    const selectable = openOffersByTotal(offers).filter((o) => canSelect(o, now));
    return selectable.length >= 2 ? selectable[0].id : null;
}

/** Time left in the offer window. `closed` once `closeAt` has passed or is unknown. */
export function windowLeft(closeAt: string | null | undefined, now: Date = new Date()): { closed: boolean; hours: number; minutes: number } {
    const end = closeAt ? Date.parse(closeAt) : NaN;
    if (!Number.isFinite(end) || end <= now.getTime()) return { closed: true, hours: 0, minutes: 0 };
    const totalMinutes = Math.ceil((end - now.getTime()) / 60000);
    return { closed: false, hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/**
 * When the amount is held: right away for a service within 24 hours, otherwise 24 hours before it.
 */
export function holdsNow(serviceDate: string | null | undefined, now: Date = new Date()): boolean {
    const at = serviceDate ? Date.parse(serviceDate) : NaN;
    if (!Number.isFinite(at)) return true;
    return at - now.getTime() <= 24 * 60 * 60 * 1000;
}

/** What the screen does about each way selecting an offer can fail. */
export type OfferErrorAction =
    | 'reload' // the total changed or a check could not run: read the offers again and ask once more
    | 'card' // pick another card
    | 'funds' // add money to the wallet or use a card
    | 'list' // that offer is gone: back to the list
    | 'disabled' // accepting is not open for this account yet
    | 'location' // no tax rate / no service location for this place
    | 'unknown';

export function offerErrorAction(code: string | undefined): OfferErrorAction {
    switch (code) {
        case 'price_changed':
        case 'pricing_unavailable':
        case 'verification_check_unavailable':
            return 'reload';
        case 'card_declined':
        case 'payment_method_required':
        case 'payment_method_not_yours':
            return 'card';
        case 'insufficient_funds':
        case 'wallet_insufficient':
            return 'funds';
        case 'offer_unavailable':
        case 'offer_expired':
        case 'offer_slot_passed':
        case 'provider_unavailable':
            return 'list';
        case 'marketplace_accept_disabled':
            return 'disabled';
        case 'tax_location_unknown':
        case 'service_location_missing':
            return 'location';
        default:
            return 'unknown';
    }
}

/** What the screen does about each way approving or rejecting a final quote can fail. */
export type QuoteErrorAction = OfferErrorAction | 'gone';

export function quoteErrorAction(code: string | undefined): QuoteErrorAction {
    switch (code) {
        case 'final_quote_not_pending':
        case 'final_quote_expired':
        case 'final_quote_not_available':
        case 'final_quote_not_applicable':
            return 'gone';
        default:
            return offerErrorAction(code);
    }
}

/** Whether a proposal can still be decided: pending and not past its 48 h. */
export function quoteIsOpen(status: string, expiresAt: string | null | undefined, now: Date = new Date()): boolean {
    if (status !== 'pending') return false;
    return !expiresAt || Date.parse(expiresAt) > now.getTime();
}

/** Where a scheduled request stands from the owner's point of view. */
export type RequestPhase = 'collecting' | 'closedEmpty' | 'closedWithOffers' | 'selected' | 'cancelled';

export function requestPhase(
    request: { status?: string | null; offersCloseAt?: string | null } | null,
    offers: readonly MarketplaceOffer[],
    now: Date = new Date(),
): RequestPhase {
    const status = request?.status;
    if (status === 'cancelled' || status === 'canceled') return 'cancelled';
    if (status === 'accepted') return 'selected';
    const closed = windowLeft(request?.offersCloseAt, now).closed;
    const open = offers.some((o) => canSelect(o, now));
    if (!closed) return 'collecting';
    return open ? 'closedWithOffers' : 'closedEmpty';
}
