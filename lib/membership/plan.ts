/**
 * The membership plan shown in the profile. SIMULATED for now: the numbers below are what the screen draws until the billing endpoints
 * exist (see docs/backlog-backend.md, "AN — Membership plan"). When they do, only `loadMembership` and `applyPromoCode` change: the screen
 * reads this shape and nothing else.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MembershipStatus = 'startup_waived' | 'active' | 'past_due' | 'cancelled';

export interface Membership {
    status: MembershipStatus;
    /** Name of the plan as billing calls it. */
    planName: string;
    /** USD per period, after any coupon; 0 while the fee is waived. */
    amount: number;
    /** USD per period before the coupon (equal to `amount` with none). */
    listAmount: number;
    /** The coupon applied to this account, if any. */
    coupon: { code: string; percentOff: number } | null;
    period: 'month' | 'year';
    /** The periods the account can choose from once plans launch. */
    periodsOffered: ('month' | 'year')[];
    /** ISO date of the next charge; null while nothing is charged. */
    nextPaymentAt: string | null;
    /** Whether a promotional code can be entered. */
    promoAvailable: boolean;
    /** ISO date the account became a member. */
    memberSince: string | null;
}

export interface PromoResult {
    ok: boolean;
    /** What was applied (when accepted). */
    coupon?: { code: string; percentOff: number };
    /** Why it was refused (`invalid`, `expired`, `not_eligible`) or nothing when accepted. */
    reason?: 'invalid' | 'expired' | 'not_eligible' | 'not_available_yet';
}

/** What the technician's All-access plan costs: USD per year. */
export const TECHNICIAN_PLAN_USD_PER_YEAR = 50;

/** The promo codes the simulation knows: code → percent off. (Real ones come from billing, see AN in docs/backlog-backend.md.) */
const PROMO_CODES: Record<string, number> = { MIAMI: 50 };

const couponKey = (userId: string) => `membership_coupon_v1:${userId}`;

async function savedCoupon(userId?: string | null): Promise<{ code: string; percentOff: number } | null> {
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

const withCoupon = (list: number, coupon: { code: string; percentOff: number } | null) =>
    coupon ? Math.round(list * (100 - coupon.percentOff)) / 100 : list;

export async function loadMembership(role: 'mechanic' | 'user' = 'user', userId?: string | null, memberSince?: string | null): Promise<Membership> {
    // The technician's plan has a price: $50 a year, billed once a year. The owner's stays free while the startup stage lasts.
    if (role === 'mechanic') {
        const coupon = await savedCoupon(userId);
        return {
            status: 'active',
            planName: 'All-access',
            amount: withCoupon(TECHNICIAN_PLAN_USD_PER_YEAR, coupon),
            listAmount: TECHNICIAN_PLAN_USD_PER_YEAR,
            coupon,
            period: 'year',
            periodsOffered: ['year'],
            nextPaymentAt: null,
            promoAvailable: !coupon,
            memberSince: memberSince ?? null,
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
