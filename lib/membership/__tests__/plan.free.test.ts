jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
}));

import { MEMBERSHIP_FREE_AT_LAUNCH } from '../launch';
import { applyPromoCode, loadMembership, payMembership } from '../plan';

// The first App Store release has no paid plan: nothing to pay, no price, no code (guideline 3.1.1).
describe('membership while it is free at launch', () => {
    it('is switched on', () => {
        expect(MEMBERSHIP_FREE_AT_LAUNCH).toBe(true);
    });

    it('shows the technician and the owner a waived plan with nothing to pay', async () => {
        for (const role of ['mechanic', 'user'] as const) {
            const plan = await loadMembership(role, 'u1', null, role === 'user' ? [{ id: 'v1', vin: '1HGCM82633A004352' }] : undefined);
            expect(plan.status).toBe('startup_waived');
            expect(plan.amount).toBe(0);
            expect(plan.listAmount).toBe(0);
            expect(plan.promoAvailable).toBe(false);
            expect(plan.payment).toBeNull();
            expect(plan.fleet).toBeUndefined();
        }
    });

    it('does not take a payment or a promo code', async () => {
        expect(await payMembership('mechanic', 'u1', { method: { type: 'card', label: 'Visa' } })).toEqual({ ok: false, reason: 'nothing_to_pay' });
        expect((await applyPromoCode('MIAMI', 'mechanic', 'u1')).ok).toBe(false);
    });
});
