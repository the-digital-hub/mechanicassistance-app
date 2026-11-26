// The tests below cover the paid plans (kept for when they come back): they run with the launch switch off. plan.free.test.ts covers it on.
jest.mock('../launch', () => ({ MEMBERSHIP_FREE_AT_LAUNCH: false }));

jest.mock('@react-native-async-storage/async-storage', () => {
    const store: Record<string, string> = {};
    return {
        getItem: jest.fn(async (k: string) => store[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
        removeItem: jest.fn(async (k: string) => { delete store[k]; }),
    };
});

import { applyPromoCode, loadMembership, ownerVehiclePrice, payMembership, resetMembershipPayment, setMembershipAutoRenew, TECHNICIAN_PLAN_USD_PER_YEAR, OWNER_PLAN_USD_PER_YEAR } from '../plan';

describe('loadMembership', () => {
    it('charges the technician $120 a year', async () => {
        const plan = await loadMembership('mechanic', 'u1');
        expect(plan.amount).toBe(120);
        expect(plan.amount).toBe(TECHNICIAN_PLAN_USD_PER_YEAR);
        expect(plan.period).toBe('year');
        expect(plan.periodsOffered).toEqual(['year']);
        expect(plan.status).toBe('active');
        expect(plan.coupon).toBeNull();
    });

    it('charges the vehicle owner $15 a year', async () => {
        const plan = await loadMembership('user', 'u2');
        expect(plan.amount).toBe(15);
        expect(plan.amount).toBe(OWNER_PLAN_USD_PER_YEAR);
        expect(plan.period).toBe('year');
        expect(plan.status).toBe('active');
        expect(plan.coupon).toBeNull();
    });
});

// Promo codes are not in the client any more: billing owns them (see plan.ts).
describe('promo codes', () => {
    it('refuses every code on the client, whatever the role', async () => {
        expect(await applyPromoCode('MIAMI', 'mechanic', 'c1')).toEqual({ ok: false, reason: 'invalid' });
        expect(await applyPromoCode('INSURANCE', 'user', 'c2')).toEqual({ ok: false, reason: 'invalid' });
        expect((await loadMembership('mechanic', 'c1')).coupon).toBeNull();
    });
});

describe('paying the plan', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); });

    const pay = async (role: 'mechanic' | 'user', id: string) => {
        const promise = payMembership(role, id, { method: { type: 'card', label: 'Visa •••• 4242', cardId: 'c1' } });
        await jest.advanceTimersByTimeAsync(1000);
        return promise;
    };

    it('pays the year, renews a year later and cannot be paid twice', async () => {
        const result = await pay('mechanic', 'p1');
        expect(result.ok).toBe(true);
        expect(result.payment).toMatchObject({ amount: 120, couponCode: null });
        const plan = await loadMembership('mechanic', 'p1');
        expect(plan.payment?.amount).toBe(120);
        expect(plan.promoAvailable).toBe(false);
        const renews = Date.parse(plan.nextPaymentAt as string) - Date.parse(plan.payment!.paidAt);
        expect(renews).toBe(365 * 86_400_000);
        expect(await pay('mechanic', 'p1')).toEqual({ ok: false, reason: 'already_paid' });
    });

    it('lets the owner pay $15, and the payment can be reset', async () => {
        const owner = await pay('user', 'p2');
        expect(owner.ok).toBe(true);
        expect(owner.payment).toMatchObject({ amount: 15, couponCode: null });
        // The technician plan of the same person is a different one.
        expect((await loadMembership('mechanic', 'p2')).payment).toBeNull();
        await pay('mechanic', 'p3');
        await resetMembershipPayment('p3');
        expect((await loadMembership('mechanic', 'p3')).payment).toBeNull();
    });

    it('keeps how it was paid; a card renews by itself unless turned off, earnings never do', async () => {
        const withCard = promiseOf('mechanic', 'q1', { type: 'card', label: 'Visa •••• 4242', cardId: 'c1' });
        await jest.advanceTimersByTimeAsync(1000);
        const result = await withCard;
        expect(result.payment).toMatchObject({ method: { type: 'card', label: 'Visa •••• 4242' }, autoRenew: true });
        await setMembershipAutoRenew('q1', false);
        expect((await loadMembership('mechanic', 'q1')).payment?.autoRenew).toBe(false);

        const withEarnings = promiseOf('mechanic', 'q2', { type: 'earnings', label: 'Earnings balance' });
        await jest.advanceTimersByTimeAsync(1000);
        const paid = await withEarnings;
        expect(paid.payment).toMatchObject({ method: { type: 'earnings' }, autoRenew: false });
        await setMembershipAutoRenew('q2', true);
        expect((await loadMembership('mechanic', 'q2')).payment?.autoRenew).toBe(false);
    });
});

const promiseOf = (role: 'mechanic' | 'user', id: string, method: { type: 'earnings' | 'card'; label: string; cardId?: string }) => payMembership(role, id, { method });


describe('the owner plan, per vehicle', () => {
    const car = (n: number) => ({ id: `v${n}`, vin: `1HGCM82633A00${1000 + n}`, make: 'Honda', model: 'Accord', year: 2020 });
    const card = { type: 'card' as const, label: 'Visa •••• 4242' };

    it('prices each place in the fleet: $15, then $12 twice, then $9', () => {
        expect([0, 1, 2, 3, 4].map(ownerVehiclePrice)).toEqual([15, 12, 12, 9, 9]);
    });

    it('charges one vehicle $15 and five $57, saving $18 on the fleet', async () => {
        const one = await loadMembership('user', 'o1', null, [car(1)]);
        expect(one.amount).toBe(15);
        expect(one.fleet?.fleetDiscount).toBe(0);
        const five = await loadMembership('user', 'o2', null, [1, 2, 3, 4, 5].map(car));
        expect(five.amount).toBe(57);
        expect(five.fleet?.lines.map((l) => l.listPrice)).toEqual([15, 12, 12, 9, 9]);
        expect(five.fleet?.fleetDiscount).toBe(0 + 3 + 3 + 6 + 6);
    });

    it('leaves out the vehicles without a VIN, and costs nothing with none', async () => {
        const plan = await loadMembership('user', 'o3', null, [{ id: 'x', vin: '', make: 'Ford' }, car(1)]);
        expect(plan.fleet?.lines).toHaveLength(1);
        expect(plan.amount).toBe(15);
        expect((await loadMembership('user', 'o4', null, [])).amount).toBe(0);
    });

    it('pays only the pending vehicles, each with its own year, and a new one is pending again', async () => {
        expect((await payMembership('user', 'o6', { method: card, vehicles: [car(1), car(2)] })).ok).toBe(true);
        const paid = await loadMembership('user', 'o6', null, [car(1), car(2)]);
        expect(paid.payment).not.toBeNull();
        expect(paid.fleet?.pendingCount).toBe(0);
        expect(paid.fleet?.lines.every((l) => !!l.renewsAt)).toBe(true);

        const grown = await loadMembership('user', 'o6', null, [car(1), car(2), car(3)]);
        expect(grown.payment).toBeNull();
        expect(grown.fleet?.pendingCount).toBe(1);
        expect(grown.amount).toBe(12);
        expect((await payMembership('user', 'o6', { method: card, vehicles: [car(1), car(2), car(3)] })).payment?.amount).toBe(12);
        expect((await payMembership('user', 'o6', { method: card, vehicles: [car(1), car(2), car(3)] })).reason).toBe('already_paid');
    });
});
