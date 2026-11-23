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
    payment: { paidAt: string; amount: number; couponCode: string | null } | null;
}

export interface PromoResult {
    ok: boolean;
    /** What was applied (when accepted). */
    coupon?: Coupon;
    /** Why it was refused (`invalid`, `expired`, `not_eligible`) or nothing when accepted. */
    reason?: 'invalid' | 'expired' | 'not_eligible' | 'not_available_yet';
}

/** What the technician's All-access plan costs: USD per year. */
export const TECHNICIAN_PLAN_USD_PER_YEAR = 60;

/** The promo codes the simulation knows: code → percent off. (Real ones come from billing, see AN in docs/backlog-backend.md.) */
const PROMO_CODES: Record<string, number> = { MIAMI: 10, MEKA: 25 };

const couponKey = (userId: string) => `membership_coupon_v1:${userId}`;
const paymentKey = (userId: string) => `membership_payment_v1:${userId}`;

const ONE_YEAR_MS = 365 * 86_400_000;

async function savedPayment(userId?: string | null): Promise<Membership['payment']> {
    if (!userId) return null;
    try {
        const raw = await AsyncStorage.getItem(paymentKey(userId));
        const parsed = raw ? (JSON.parse(raw) as Membership['payment']) : null;
        return parsed && typeof parsed.paidAt === 'string' && typeof parsed.amount === 'number' ? parsed : null;
    } catch {
        return null;
    }
}

async function savedCoupon(userId?: string | null): Promise<Coupon | null> {
    if (!userId) return null;
    try {
        const raw = await AsyncStorage.getItem(couponKey(userId));
        const parsed = raw ? (JSON.parse(raw) as { code?: string }) : null;
        const code = parsed?.code?.toUpperCase();
        return code && PROMO_CODES[code] ? { code, percentOff: PROMO_CODES[code] } : null;
    } catch {
        return null;
    }
}

/** What the plan costs with the coupon: the percentage taken off the list price. */
const withCoupon = (list: number, coupon: Coupon | null) =>
    coupon ? Math.round(list * (100 - coupon.percentOff)) / 100 : list;

export async function loadMembership(role: 'mechanic' | 'user' = 'user', userId?: string | null, memberSince?: string | null): Promise<Membership> {
    // The technician's plan has a price: $60 a year, billed once a year. The owner's stays free while the startup stage lasts.
    if (role === 'mechanic') {
        const [coupon, payment] = await Promise.all([savedCoupon(userId), savedPayment(userId)]);
        return {
            status: 'active',
            planName: 'All-access',
            amount: withCoupon(TECHNICIAN_PLAN_USD_PER_YEAR, coupon),
            listAmount: TECHNICIAN_PLAN_USD_PER_YEAR,
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
    return {
        status: 'startup_waived',
        planName: 'All-access',
        amount: 0,
        listAmount: 0,
        coupon: null,
        period: 'month',
        periodsOffered: ['month', 'year'],
        nextPaymentAt: null,
        promoAvailable: true,
        memberSince: memberSince ?? null,
        payment: null,
    };
}

/**
 * Applies a promo code to the technician's plan (simulated, kept on this device). An unknown code is `invalid`; the owner's plan is free,
 * so a discount has nothing to take off there (`not_eligible`).
 */
export async function applyPromoCode(code: string, role: 'mechanic' | 'user' = 'mechanic', userId?: string | null): Promise<PromoResult> {
    const normalized = code.trim().toUpperCase();
    const percentOff = PROMO_CODES[normalized];
    if (!percentOff) return { ok: false, reason: 'invalid' };
    if (role !== 'mechanic') return { ok: false, reason: 'not_eligible' };
    if (userId) await AsyncStorage.setItem(couponKey(userId), JSON.stringify({ code: normalized })).catch(() => undefined);
    return { ok: true, coupon: { code: normalized, percentOff } };
}

export interface PayResult {
    ok: boolean;
    payment?: NonNullable<Membership['payment']>;
    reason?: 'nothing_to_pay' | 'already_paid' | 'failed';
}

/**
 * Pays the technician's plan for the year (SIMULATED: nothing is charged; the payment is kept on this device until billing has the endpoint,
 * see "AN" in docs/backlog-backend.md). The amount is the plan's price after the coupon.
 */
export async function payMembership(role: 'mechanic' | 'user', userId?: string | null): Promise<PayResult> {
    if (role !== 'mechanic' || !userId) return { ok: false, reason: 'nothing_to_pay' };
    const plan = await loadMembership(role, userId);
    if (plan.payment) return { ok: false, reason: 'already_paid' };
    // The wait a real charge takes, so the screen shows its "paying" state.
    await new Promise((resolve) => setTimeout(resolve, 900));
    const payment = { paidAt: new Date().toISOString(), amount: plan.amount, couponCode: plan.coupon?.code ?? null };
    try {
        await AsyncStorage.setItem(paymentKey(userId), JSON.stringify(payment));
    } catch {
        return { ok: false, reason: 'failed' };
    }
    return { ok: true, payment };
}

/** Clears the simulated payment (to test the flow again). */
export async function resetMembershipPayment(userId?: string | null): Promise<void> {
    if (userId) await AsyncStorage.removeItem(paymentKey(userId)).catch(() => undefined);
}

/** Takes the coupon off the account (simulated). */
export async function removePromoCode(userId?: string | null): Promise<void> {
    if (userId) await AsyncStorage.removeItem(couponKey(userId)).catch(() => undefined);
}

export interface PlanChangeResult {
    ok: boolean;
    reason?: 'not_available_yet' | 'failed';
}

/** Plans have not launched: there is nothing to cancel yet (the fee is waived). */
export async function cancelPlan(): Promise<PlanChangeResult> {
    return { ok: false, reason: 'not_available_yet' };
}
