jest.mock('@/lib/dao/AssistanceDAO', () => ({ assistanceDAO: { getOffers: jest.fn() } }));

import type { MarketplaceOffer } from '@/lib/dao/interfaces';

import { acceptedSlot, formatSlot } from '../slot';

const offer = (status: string, extra: Partial<MarketplaceOffer> = {}): MarketplaceOffer => ({ id: status, status, quoteType: 'final', customerTotal: null, ...extra });

describe('acceptedSlot', () => {
    it('reads the window of the accepted offer', () => {
        const r = acceptedSlot([offer('submitted', { proposedStart: '2026-11-20T09:00:00.000Z' }), offer('accepted', { proposedStart: '2026-11-22T09:00:00.000Z', proposedEnd: '2026-11-22T17:00:00.000Z' })]);
        expect(r).toEqual({ start: '2026-11-22T09:00:00.000Z', end: '2026-11-22T17:00:00.000Z' });
    });
    it('is null with no accepted offer or no usable start', () => {
        expect(acceptedSlot([offer('submitted', { proposedStart: '2026-11-22T09:00:00.000Z' })])).toBeNull();
        expect(acceptedSlot([offer('accepted')])).toBeNull();
        expect(acceptedSlot([offer('accepted', { proposedStart: 'soon' })])).toBeNull();
        expect(acceptedSlot([])).toBeNull();
    });
});

describe('formatSlot', () => {
    it('shows a window or just the start', () => {
        expect(formatSlot('2026-11-22T14:00:00.000Z', '2026-11-22T22:00:00.000Z', 'en-US')).toContain('–');
        expect(formatSlot('2026-11-22T14:00:00.000Z', null, 'en-US')).not.toContain('–');
    });
    it('is null for an unreadable start', () => {
        expect(formatSlot(null)).toBeNull();
        expect(formatSlot('nope')).toBeNull();
    });
});
