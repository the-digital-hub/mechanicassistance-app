import type { MarketplaceRequest } from '@/lib/dao/interfaces';

import { buildOffer, distanceLabel, notesWithDay, feedProblem, offerSubmitProblem, parsePrice, toFeedRequest, validateOffer, vehicleLabel, type OfferForm } from '../provider';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const form = (extra: Partial<OfferForm> = {}): OfferForm => ({
    quoteType: 'final',
    price: '150',
    diagnosticFee: '',
    description: 'Full brake inspection and pads',
    warrantyDays: '',
    warrantyCoverage: '',
    ...extra,
});

describe('feedProblem', () => {
    it('gives each backend code its own problem', () => {
        expect(feedProblem('marketplace_identity_pending')).toBe('identityPending');
        expect(feedProblem('VERIFICATION_REQUIRED')).toBe('identityPending');
        expect(feedProblem('marketplace_suspended')).toBe('suspended');
        expect(feedProblem('marketplace_not_enabled')).toBe('notEnabled');
        expect(feedProblem('marketplace_base_location_missing')).toBe('baseLocationMissing');
        expect(feedProblem('marketplace_no_categories')).toBe('noCategories');
        expect(feedProblem('not_a_provider')).toBe('notProvider');
        expect(feedProblem(undefined)).toBe('generic');
    });
});

describe('toFeedRequest', () => {
    const m: MarketplaceRequest = {
        id: 'r1',
        title: 'Brakes',
        zip: '33101',
        distanceMiles: 3.24,
        date: '2026-11-20T14:00:00.000Z',
        vehicle: { make: 'Toyota', model: 'Corolla', year: 2021 },
        services: [{ name: 'Brake inspection' }, { name: 'Oil change' }, { name: 'Tires' }],
        approximateLocation: { latitude: 25.77, longitude: -80.19 },
    };

    it('maps to a scheduled pending card without a street', () => {
        const r = toFeedRequest(m);
        expect(r).toMatchObject({ id: 'r1', type: 'scheduled', status: 'pending', car: '2021 Toyota Corolla', address: '33101', distance: '3.2 mi', locationLat: 25.77, locationLng: -80.19 });
    });

    it('falls back to the first service names as title', () => {
        expect(toFeedRequest({ ...m, title: '' }).title).toBe('Brake inspection, Oil change');
    });

    it('tolerates a bare request', () => {
        const r = toFeedRequest({ id: 'x' });
        expect(r.car).toBe('');
        expect(r.distance).toBeUndefined();
    });
});

describe('labels', () => {
    it('skips missing vehicle parts', () => {
        expect(vehicleLabel({ id: 'a', vehicle: { make: 'Ford', model: 'F-150' } })).toBe('Ford F-150');
    });
    it('formats distance', () => {
        expect(distanceLabel(0.46)).toBe('0.5 mi');
        expect(distanceLabel(14.6)).toBe('15 mi');
        expect(distanceLabel(null)).toBe('');
    });
});

describe('parsePrice', () => {
    it('normalises amounts', () => {
        expect(parsePrice('150')).toBe('150.00');
        expect(parsePrice('$1,150.5')).toBe('1150.50');
    });
    it('rejects what is not a positive amount', () => {
        expect(parsePrice('')).toBeNull();
        expect(parsePrice('0')).toBeNull();
        expect(parsePrice('12.345')).toBeNull();
        expect(parsePrice('abc')).toBeNull();
    });
});

describe('validateOffer', () => {
    it('accepts a complete final quote', () => {
        expect(validateOffer(form(), NOW)).toBeNull();
    });
    it('needs a price on final and a fee on diagnostic', () => {
        expect(validateOffer(form({ price: '' }), NOW)).toBe('price');
        expect(validateOffer(form({ quoteType: 'diagnostic_then_quote', diagnosticFee: '' }), NOW)).toBe('diagnosticFee');
        expect(validateOffer(form({ quoteType: 'diagnostic_then_quote', price: '', diagnosticFee: '60' }), NOW)).toBeNull();
    });
    it('needs a 10 character description', () => {
        expect(validateOffer(form({ description: 'short' }), NOW)).toBe('description');
        expect(validateOffer(form({ description: '   short   ' }), NOW)).toBe('description');
    });
    it('checks the proposed slot', () => {
        expect(validateOffer(form({ proposedStart: '2026-11-20T14:00:00.000Z' }), NOW)).toBe('slot');
        expect(validateOffer(form({ proposedStart: '2026-11-20T14:00:00.000Z', proposedEnd: '2026-11-20T13:00:00.000Z' }), NOW)).toBe('slot');
        expect(validateOffer(form({ proposedStart: '2026-11-10T14:00:00.000Z', proposedEnd: '2026-11-10T16:00:00.000Z' }), NOW)).toBe('slot');
        expect(validateOffer(form({ proposedStart: '2026-11-20T14:00:00.000Z', proposedEnd: '2026-11-20T16:00:00.000Z' }), NOW)).toBeNull();
    });
});

describe('buildOffer', () => {
    it('sends only the price on a final quote', () => {
        expect(buildOffer(form())).toEqual({ quoteType: 'final', price: '150.00', description: 'Full brake inspection and pads' });
    });
    it('sends only the diagnostic fee on a diagnostic quote', () => {
        const o = buildOffer(form({ quoteType: 'diagnostic_then_quote', price: '999', diagnosticFee: '60' }));
        expect(o.diagnosticFee).toBe('60.00');
        expect(o).not.toHaveProperty('price');
    });
    it('adds warranty and slot when given', () => {
        const o = buildOffer(form({ warrantyDays: '30', warrantyCoverage: ' Parts ', proposedStart: 'a', proposedEnd: 'b' }));
        expect(o).toMatchObject({ warrantyDays: 30, warrantyCoverage: 'Parts', proposedStart: 'a', proposedEnd: 'b' });
    });
});

describe('offerSubmitProblem', () => {
    it('maps quote errors', () => {
        expect(offerSubmitProblem('offers_closed')).toBe('closed');
        expect(offerSubmitProblem('quote_slot_invalid')).toBe('slot');
        expect(offerSubmitProblem('quote_price_required')).toBe('price');
        expect(offerSubmitProblem('quote_description_required')).toBe('description');
        expect(offerSubmitProblem('marketplace_suspended')).toBe('suspended');
        expect(offerSubmitProblem(undefined)).toBe('generic');
    });
});

describe('notesWithDay', () => {
    it('drops the label and puts the day in front of an older window line', () => {
        expect(notesWithDay('Preferred window: 9:00 AM – 12:00 PM\nSymptoms: noise', '2026-11-20T14:00:00.000Z')).toBe('Fri, Nov 20 · 9:00 AM – 12:00 PM\nSymptoms: noise');
    });
    it('also cleans the first version that had label and day', () => {
        expect(notesWithDay('Preferred window: Fri, Nov 20, 9:00 AM – 12:00 PM', '2026-11-20T14:00:00.000Z')).toBe('Fri, Nov 20 · 9:00 AM – 12:00 PM');
    });
    it('leaves other lines alone', () => {
        expect(notesWithDay('Other request: x', '2026-11-20T14:00:00.000Z')).toBe('Other request: x');
        expect(notesWithDay(null, null)).toBeUndefined();
    });
});
