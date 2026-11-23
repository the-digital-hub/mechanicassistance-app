/**
 * The membership plan shown in the profile. SIMULATED for now: the numbers below are what the screen draws until the billing endpoints
 * exist (see docs/backlog-backend.md, "AN — Membership plan"). When they do, only `loadMembership` and `applyPromoCode` change: the screen
 * reads this shape and nothing else.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MembershipStatus = 'startup_waived' | 'active' | 'past_due' | 'cancelled';

/** A coupon: a percentage off the plan. */
export interface Coupon {
    code: string;
    percentOff: number;
}

export interface Membership {
    status: MembershipStatus;
    /** Name of the plan as billing calls it. */
    planName: string;
    /** USD per period, after any coupon; 0 while the fee is waived. */
    amount: number;
    /** USD per period before the coupon (equal to `amount` with none). */
    listAmount: number;
    /** The coupon applied to this account, if any. */
    coupon: Coupon | null;
    period: 'month' | 'year';
    /** The periods the account can choose from once plans launch. */
    periodsOffered: ('month' | 'year')[];
    /** ISO date of the next charge; null while nothing is charged. */
    nextPaymentAt: string | null;
    /** Whether a promotional code can be entered. */
    promoAvailable: boolean;
    /** ISO date the account became a member. */
    memberSince: string | null;
    /** The payment of the current period, once made (null: nothing paid yet, or nothing to pay). */
    payment: MembershipPayment | null;
}

/** How the year was paid: out of the earnings, or with a card (kept in the wallet for the renewal and future payments). */
export interface PaymentMethodUsed {
    type: 'earnings' | 'card';
    /** What the person sees: "Earnings balance" or "Visa •••• 4242". */
    label: string;
    cardId?: string;
}

export interface MembershipPayment {
    paidAt: string;
    amount: number;
    couponCode: string | null;
    method: PaymentMethodUsed;
    /** Renews by itself with the saved card (only a card can: earnings are not there to charge a year later). */
    autoRenew: boolean;
}

export interface PromoResult {
    ok: boolean;
    /** What was applied (when accepted). */
    coupon?: Coupon;
    /** Why it was refused (`invalid`, `expired`, `not_eligible`) or nothing when accepted. */
    reason?: 'invalid' | 'expired' | 'not_eligible' | 'not_available_yet';
}

type Role = 'mechanic' | 'user';

/** What the All-access plan costs: USD per year (the technician's, and the vehicle owner's). */
export const TECHNICIAN_PLAN_USD_PER_YEAR = 60;
export const OWNER_PLAN_USD_PER_YEAR = 15;

const PLAN_USD_PER_YEAR: Record<Role, number> = { mechanic: TECHNICIAN_PLAN_USD_PER_YEAR, user: OWNER_PLAN_USD_PER_YEAR };

/**
 * The promo codes the simulation knows, by the role they are for: code → percent off. A technician's code does nothing on an owner's plan
 * and the other way round. (Real ones come from billing, see AN in docs/backlog-backend.md.)
 */
const PROMO_CODES: Record<Role, Record<string, number>> = {
    mechanic: { MIAMI: 10, MEKA: 25 },
    user: { INSURANCE: 100 },
};

// The technician keeps the keys it always had; the owner's carry the role (one person can be both).
const scope = (role: Role, userId: string) => (role === 'mechanic' ? userId : `user:${userId}`);
const couponKey = (role: Role, userId: string) => `membership_coupon_v1:${scope(role, userId)}`;
const paymentKey = (role: Role, userId: string) => `membership_payment_v1:${scope(role, userId)}`;

const ONE_YEAR_MS = 365 * 86_400_000;

async function savedPayment(role: Role, userId?: string | null): Promise<Membership['payment']> {
    if (!userId) return null;
    try {
        const raw = await AsyncStorage.getItem(paymentKey(role, userId));
        const parsed = raw ? (JSON.parse(raw) as Partial<MembershipPayment>) : null;
        if (!parsed || typeof parsed.paidAt !== 'string' || typeof parsed.amount !== 'number') return null;
        // A payment saved before the method existed still reads.
        return { paidAt: parsed.paidAt, amount: parsed.amount, couponCode: parsed.couponCode ?? null, method: parsed.method ?? { type: 'card', label: '' }, autoRenew: !!parsed.autoRenew };
    } catch {
        return null;
    }
}

async function savedCoupon(role: Role, userId?: string | null): Promise<Coupon | null> {
    if (!userId) return null;
    try {
        const raw = await AsyncStorage.getItem(couponKey(role, userId));
        const parsed = raw ? (JSON.parse(raw) as { code?: string }) : null;
        const code = parsed?.code?.toUpperCase();
        return code && PROMO_CODES[role][code] ? { code, percentOff: PROMO_CODES[role][code] } : null;
    } catch {
        return null;
    }
}

/** What the plan costs with the coupon: the percentage taken off the list price. */
const withCoupon = (list: number, coupon: Coupon | null) =>
    coupon ? Math.round(list * (100 - coupon.percentOff)) / 100 : list;

export async function loadMembership(role: Role = 'user', userId?: string | null, memberSince?: string | null): Promise<Membership> {
    // Both plans are billed once a year: $60 for the technician, $15 for the owner (a coupon can take it down, even to nothing).
    const [coupon, payment] = await Promise.all([savedCoupon(role, userId), savedPayment(role, userId)]);
    const list = PLAN_USD_PER_YEAR[role];
    return {
        status: 'active',
        planName: 'All-access',
        amount: withCoupon(list, coupon),
        listAmount: list,
        coupon,
        period: 'year',
        periodsOffered: ['year'],
        // Paid: the plan renews a year after the payment.
        nextPaymentAt: payment ? new Date(Date.parse(payment.paidAt) + ONE_YEAR_MS).toISOString() : null,
        promoAvailable: !coupon && !payment,
        memberSince: memberSince ?? null,
        payment,
    };
}

/**
 * Applies a promo code to the plan (simulated, kept on this device). An unknown code is `invalid`; a code that exists but is for the other
 * kind of account (a technician's on an owner's plan, or the other way round) is `not_eligible`.
 */
export async function applyPromoCode(code: string, role: Role = 'mechanic', userId?: string | null): Promise<PromoResult> {
    const normalized = code.trim().toUpperCase();
    const percentOff = PROMO_CODES[role][normalized];
    if (!percentOff) {
        const other: Role = role === 'mechanic' ? 'user' : 'mechanic';
        return { ok: false, reason: PROMO_CODES[other][normalized] ? 'not_eligible' : 'invalid' };
    }
    if (userId) await AsyncStorage.setItem(couponKey(role, userId), JSON.stringify({ code: normalized })).catch(() => undefined);
    return { ok: true, coupon: { code: normalized, percentOff } };
}

export interface PayResult {
    ok: boolean;
    payment?: NonNullable<Membership['payment']>;
    reason?: 'nothing_to_pay' | 'already_paid' | 'failed';
}

/**
 * Pays the plan for the year (SIMULATED: nothing is charged; the payment is kept on this device until billing has the endpoint,
 * see "AN" in docs/backlog-backend.md). The amount is the plan's price after the coupon.
 */
export async function payMembership(role: Role, userId: string | null | undefined, options: { method: PaymentMethodUsed; autoRenew?: boolean }): Promise<PayResult> {
    if (!userId) return { ok: false, reason: 'nothing_to_pay' };
    const plan = await loadMembership(role, userId);
    if (plan.payment) return { ok: false, reason: 'already_paid' };
    if (plan.amount <= 0) return { ok: false, reason: 'nothing_to_pay' };
    // The wait a real charge takes, so the screen shows its "paying" state.
    await new Promise((resolve) => setTimeout(resolve, 900));
    const payment: MembershipPayment = {
        paidAt: new Date().toISOString(),
        amount: plan.amount,
        couponCode: plan.coupon?.code ?? null,
        method: options.method,
        autoRenew: options.method.type === 'card' && options.autoRenew !== false,
    };
    try {
        await AsyncStorage.setItem(paymentKey(role, userId), JSON.stringify(payment));
    } catch {
        return { ok: false, reason: 'failed' };
    }
    return { ok: true, payment };
}

/** Turns the automatic renewal on or off (simulated, kept on this device). Only a card can renew by itself. */
export async function setMembershipAutoRenew(userId: string | null | undefined, autoRenew: boolean, role: Role = 'mechanic'): Promise<void> {
    if (!userId) return;
    const payment = await savedPayment(role, userId);
    if (!payment || payment.method.type !== 'card') return;
    await AsyncStorage.setItem(paymentKey(role, userId), JSON.stringify({ ...payment, autoRenew })).catch(() => undefined);
}

/** Clears the simulated payment (to test the flow again). */
export async function resetMembershipPayment(userId?: string | null, role: Role = 'mechanic'): Promise<void> {
    if (userId) await AsyncStorage.removeItem(paymentKey(role, userId)).catch(() => undefined);
}

/** Takes the coupon off the account (simulated). */
export async function removePromoCode(userId?: string | null, role: Role = 'mechanic'): Promise<void> {
    if (userId) await AsyncStorage.removeItem(couponKey(role, userId)).catch(() => undefined);
}

export interface PlanChangeResult {
    ok: boolean;
    reason?: 'not_available_yet' | 'failed';
}

/** Plans have not launched: there is nothing to cancel yet (the fee is waived). */
export async function cancelPlan(): Promise<PlanChangeResult> {
    return { ok: false, reason: 'not_available_yet' };
}
