jest.mock('@react-native-async-storage/async-storage', () => {
    const store: Record<string, string> = {};
    return {
        getItem: jest.fn(async (k: string) => store[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
        removeItem: jest.fn(async (k: string) => { delete store[k]; }),
    };
});

import { applyPromoCode, loadMembership, removePromoCode, TECHNICIAN_PLAN_USD_PER_YEAR } from '../plan';

describe('loadMembership', () => {
    it('charges the technician $50 a year', async () => {
        const plan = await loadMembership('mechanic', 'u1');
        expect(plan.amount).toBe(50);
        expect(plan.amount).toBe(TECHNICIAN_PLAN_USD_PER_YEAR);
        expect(plan.period).toBe('year');
        expect(plan.periodsOffered).toEqual(['year']);
        expect(plan.status).toBe('active');
        expect(plan.coupon).toBeNull();
    });

    it('leaves the owner on the free startup plan', async () => {
        const plan = await loadMembership('user', 'u2');
        expect(plan.amount).toBe(0);
        expect(plan.status).toBe('startup_waived');
    });
});

describe('promo codes', () => {
    it('MIAMI takes 50% off the technician plan, in any case, and it stays', async () => {
        const result = await applyPromoCode(' miami ', 'mechanic', 'u3');
        expect(result).toEqual({ ok: true, coupon: { code: 'MIAMI', percentOff: 50 } });
        const plan = await loadMembership('mechanic', 'u3');
        expect(plan.amount).toBe(25);
        expect(plan.listAmount).toBe(50);
        expect(plan.coupon).toEqual({ code: 'MIAMI', percentOff: 50 });
        expect(plan.promoAvailable).toBe(false);
    });

    it('does not touch other accounts, and can be removed', async () => {
        await applyPromoCode('MIAMI', 'mechanic', 'u4');
        expect((await loadMembership('mechanic', 'u5')).amount).toBe(50);
        await removePromoCode('u4');
        expect((await loadMembership('mechanic', 'u4')).amount).toBe(50);
    });

    it('refuses an unknown code, and a discount on the owner free plan', async () => {
        expect(await applyPromoCode('NOPE', 'mechanic', 'u6')).toEqual({ ok: false, reason: 'invalid' });
        expect(await applyPromoCode('MIAMI', 'user', 'u7')).toEqual({ ok: false, reason: 'not_eligible' });
    });
});
