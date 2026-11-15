import type { MarketplaceOffer } from '@/lib/dao/interfaces';

import { bestOfferId, canSelect, holdsNow, money, offerErrorAction, openOffersByTotal, quoteErrorAction, quoteIsOpen, requestPhase, splitQuoteDescription, totalOf, windowLeft } from '../offers';

const NOW = new Date('2026-11-15T12:00:00.000Z');

const offer = (id: string, amount: string | null, extra: Partial<MarketplaceOffer> = {}): MarketplaceOffer => ({
    id,
    status: 'submitted',
    quoteType: 'final',
    customerTotal: amount === null ? null : { basis: 'price', amount, baseAmount: '100.00', fees: '10.00', taxes: '5.00' },
    ...extra,
});

describe('money', () => {
    it('formats with thousands separators and cents', () => {
        expect(money('186.25')).toBe('$186.25');
        expect(money(1234.5)).toBe('$1,234.50');
        expect(money('0')).toBe('$0.00');
        expect(money('1234567.891')).toBe('$1,234,567.89');
    });

    it('shows a dash when there is no amount', () => {
        expect(money(null)).toBe('—');
        expect(money('abc')).toBe('—');
    });
});

describe('selecting', () => {
    it('reads the total, treating a missing or zero one as none', () => {
        expect(totalOf(offer('a', '186.25'))).toBe(186.25);
        expect(totalOf(offer('a', null))).toBeNull();
        expect(totalOf(offer('a', '0.00'))).toBeNull();
    });

    it('only an open offer with a total can be selected', () => {
        expect(canSelect(offer('a', '10.00'), NOW)).toBe(true);
        expect(canSelect(offer('a', null), NOW)).toBe(false);
        expect(canSelect(offer('a', '10.00', { status: 'withdrawn' }), NOW)).toBe(false);
        expect(canSelect(offer('a', '10.00', { status: 'expired' }), NOW)).toBe(false);
    });

    it('lapses past validUntil and when the proposed slot has started', () => {
        expect(canSelect(offer('a', '10.00', { validUntil: '2026-11-15T11:00:00.000Z' }), NOW)).toBe(false);
        expect(canSelect(offer('a', '10.00', { validUntil: '2026-11-16T11:00:00.000Z' }), NOW)).toBe(true);
        expect(canSelect(offer('a', '10.00', { proposedStart: '2026-11-15T11:59:00.000Z' }), NOW)).toBe(false);
        expect(canSelect(offer('a', '10.00', { proposedStart: '2026-11-17T15:00:00.000Z' }), NOW)).toBe(true);
    });
});

describe('ordering', () => {
    it('lists only open offers, cheapest first, without-total last', () => {
        const list = openOffersByTotal([
            offer('c', '300.00'),
            offer('gone', '50.00', { status: 'withdrawn' }),
            offer('none', null),
            offer('a', '100.00'),
            offer('b', '200.00'),
        ]);
        expect(list.map((o) => o.id)).toEqual(['a', 'b', 'c', 'none']);
    });

    it('keeps arrival order among equal totals', () => {
        expect(openOffersByTotal([offer('x', '10.00'), offer('y', '10.00')]).map((o) => o.id)).toEqual(['x', 'y']);
    });

    it('marks a best price only when there is something to compare', () => {
        expect(bestOfferId([offer('a', '100.00')], NOW)).toBeNull();
        expect(bestOfferId([offer('a', '100.00'), offer('b', '90.00')], NOW)).toBe('b');
        expect(bestOfferId([offer('a', '100.00'), offer('b', null)], NOW)).toBeNull();
    });
});

describe('offer window', () => {
    it('counts hours and minutes left', () => {
        expect(windowLeft('2026-11-17T09:30:00.000Z', NOW)).toEqual({ closed: false, hours: 45, minutes: 30 });
        expect(windowLeft('2026-11-15T12:00:30.000Z', NOW)).toEqual({ closed: false, hours: 0, minutes: 1 });
    });

    it('is closed when it passed or is unknown', () => {
        expect(windowLeft('2026-11-15T11:00:00.000Z', NOW).closed).toBe(true);
        expect(windowLeft(null, NOW).closed).toBe(true);
    });
});

describe('payment hold timing', () => {
    it('holds now within 24 hours, later beyond', () => {
        expect(holdsNow('2026-11-16T10:00:00.000Z', NOW)).toBe(true);
        expect(holdsNow('2026-11-17T10:00:00.000Z', NOW)).toBe(false);
        expect(holdsNow(undefined, NOW)).toBe(true);
    });
});

describe('error codes', () => {
    it('maps every documented failure to an action', () => {
        expect(offerErrorAction('price_changed')).toBe('reload');
        expect(offerErrorAction('pricing_unavailable')).toBe('reload');
        expect(offerErrorAction('card_declined')).toBe('card');
        expect(offerErrorAction('payment_method_required')).toBe('card');
        expect(offerErrorAction('insufficient_funds')).toBe('funds');
        expect(offerErrorAction('wallet_insufficient')).toBe('funds');
        expect(offerErrorAction('offer_unavailable')).toBe('list');
        expect(offerErrorAction('offer_expired')).toBe('list');
        expect(offerErrorAction('provider_unavailable')).toBe('list');
        expect(offerErrorAction('marketplace_accept_disabled')).toBe('disabled');
        expect(offerErrorAction('tax_location_unknown')).toBe('location');
        expect(offerErrorAction('something_new')).toBe('unknown');
        expect(offerErrorAction(undefined)).toBe('unknown');
    });
});

describe('final quote', () => {
    it('maps quote-specific failures, falling back to the offer ones', () => {
        expect(quoteErrorAction('final_quote_expired')).toBe('gone');
        expect(quoteErrorAction('final_quote_not_pending')).toBe('gone');
        expect(quoteErrorAction('price_changed')).toBe('reload');
        expect(quoteErrorAction('card_declined')).toBe('card');
        expect(quoteErrorAction('nope')).toBe('unknown');
    });

    it('is open only while pending and unexpired', () => {
        expect(quoteIsOpen('pending', '2026-11-16T12:00:00.000Z', NOW)).toBe(true);
        expect(quoteIsOpen('pending', '2026-11-15T11:00:00.000Z', NOW)).toBe(false);
        expect(quoteIsOpen('approved', null, NOW)).toBe(false);
        expect(quoteIsOpen('pending', null, NOW)).toBe(true);
    });
});

describe('requestPhase', () => {
    const future = '2026-11-16T12:00:00.000Z';
    const past = '2026-11-15T11:00:00.000Z';
    it('follows the request status first', () => {
        expect(requestPhase({ status: 'cancelled' }, [], NOW)).toBe('cancelled');
        expect(requestPhase({ status: 'canceled' }, [], NOW)).toBe('cancelled');
        expect(requestPhase({ status: 'accepted', offersCloseAt: future }, [], NOW)).toBe('selected');
    });
    it('collects while the window is open, even with no offers', () => {
        expect(requestPhase({ status: 'pending', offersCloseAt: future }, [], NOW)).toBe('collecting');
    });
    it('after the window: with a selectable offer or none', () => {
        expect(requestPhase({ status: 'pending', offersCloseAt: past }, [offer('a', '10.00')], NOW)).toBe('closedWithOffers');
        expect(requestPhase({ status: 'pending', offersCloseAt: past }, [], NOW)).toBe('closedEmpty');
        expect(requestPhase({ status: 'pending', offersCloseAt: past }, [offer('a', null)], NOW)).toBe('closedEmpty');
    });
});

describe('splitQuoteDescription', () => {
    const block = '[MA_ITEMIZED_QUOTE:v1]{"items":[{"serviceName":"Oil change","status":"quoted","laborPrice":50,"partsPrice":40,"itemTotal":90,"notes":" ok "},{"serviceName":"Brakes","status":"cannot_quote"}]}[/MA_ITEMIZED_QUOTE]';
    it('separates the readable text from the itemized block', () => {
        const r = splitQuoteDescription(`Takes 45 minutes.\n\n${block}`);
        expect(r.text).toBe('Takes 45 minutes.');
        expect(r.items).toHaveLength(2);
        expect(r.items[0]).toEqual({ name: 'Oil change', quoted: true, labor: 50, parts: 40, total: 90, notes: 'ok' });
        expect(r.items[1]).toMatchObject({ name: 'Brakes', quoted: false, total: null });
    });
    it('never shows a block it cannot parse', () => {
        const r = splitQuoteDescription('Hi [MA_ITEMIZED_QUOTE:v1]{broken[/MA_ITEMIZED_QUOTE]');
        expect(r).toEqual({ text: 'Hi', items: [] });
    });
    it('handles plain and empty descriptions', () => {
        expect(splitQuoteDescription('Just text')).toEqual({ text: 'Just text', items: [] });
        expect(splitQuoteDescription(null)).toEqual({ text: '', items: [] });
    });
});
