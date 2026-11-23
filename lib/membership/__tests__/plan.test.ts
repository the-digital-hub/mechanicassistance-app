jest.mock('@react-native-async-storage/async-storage', () => {
    const store: Record<string, string> = {};
    return {
        getItem: jest.fn(async (k: string) => store[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
        removeItem: jest.fn(async (k: string) => { delete store[k]; }),
    };
});

import { applyPromoCode, loadMembership, payMembership, removePromoCode, resetMembershipPayment, TECHNICIAN_PLAN_USD_PER_YEAR } from '../plan';

describe('loadMembership', () => {
    it('charges the technician $60 a year', async () => {
        const plan = await loadMembership('mechanic', 'u1');
        expect(plan.amount).toBe(60);
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
    it('MIAMI takes 10% off the technician plan, in any case, and it stays', async () => {
        const result = await applyPromoCode(' miami ', 'mechanic', 'u3');
        expect(result).toEqual({ ok: true, coupon: { code: 'MIAMI', percentOff: 10 } });
        const plan = await loadMembership('mechanic', 'u3');
        expect(plan.amount).toBe(54);
        expect(plan.listAmount).toBe(60);
        expect(plan.coupon).toEqual({ code: 'MIAMI', percentOff: 10 });
        expect(plan.promoAvailable).toBe(false);
    });

    it('MEKA takes 25% off the technician plan', async () => {
        expect(await applyPromoCode('meka', 'mechanic', 'u4')).toEqual({ ok: true, coupon: { code: 'MEKA', percentOff: 25 } });
        const plan = await loadMembership('mechanic', 'u4');
        expect(plan.amount).toBe(45);
        expect(plan.listAmount).toBe(60);
    });

    it('does not touch other accounts, and can be removed', async () => {
        await applyPromoCode('MIAMI', 'mechanic', 'u5');
        expect((await loadMembership('mechanic', 'u6')).amount).toBe(60);
        await removePromoCode('u5');
        expect((await loadMembership('mechanic', 'u5')).amount).toBe(60);
    });

    it('refuses an unknown code, and a discount on the owner free plan', async () => {
        expect(await applyPromoCode('NOPE', 'mechanic', 'u7')).toEqual({ ok: false, reason: 'invalid' });
        expect(await applyPromoCode('MIAMI', 'user', 'u8')).toEqual({ ok: false, reason: 'not_eligible' });
        expect(await applyPromoCode('MEKA', 'user', 'u9')).toEqual({ ok: false, reason: 'not_eligible' });
    });
});

describe('paying the plan', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); });

    const pay = async (role: 'mechanic' | 'user', id: string) => {
        const promise = payMembership(role, id);
        await jest.advanceTimersByTimeAsync(1000);
        return promise;
    };

    it('pays the year with the coupon applied, renews a year later and cannot be paid twice', async () => {
        await applyPromoCode('MEKA', 'mechanic', 'p1');
        const result = await pay('mechanic', 'p1');
        expect(result.ok).toBe(true);
        expect(result.payment).toMatchObject({ amount: 45, couponCode: 'MEKA' });
        const plan = await loadMembership('mechanic', 'p1');
        expect(plan.payment?.amount).toBe(45);
        expect(plan.promoAvailable).toBe(false);
        const renews = Date.parse(plan.nextPaymentAt as string) - Date.parse(plan.payment!.paidAt);
        expect(renews).toBe(365 * 86_400_000);
        expect(await pay('mechanic', 'p1')).toEqual({ ok: false, reason: 'already_paid' });
    });

    it('has nothing to pay for the owner, and the payment can be reset', async () => {
        expect(await pay('user', 'p2')).toEqual({ ok: false, reason: 'nothing_to_pay' });
        await pay('mechanic', 'p3');
        await resetMembershipPayment('p3');
        expect((await loadMembership('mechanic', 'p3')).payment).toBeNull();
    });
});

