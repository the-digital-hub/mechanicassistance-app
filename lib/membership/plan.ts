/**
 * The membership plan shown in the profile. SIMULATED for now: the numbers below are what the screen draws until the billing endpoints
 * exist (see docs/backlog-backend.md, "AN — Membership plan"). When they do, only `loadMembership` and `applyPromoCode` change: the screen
 * reads this shape and nothing else.
 */
export type MembershipStatus = 'startup_waived' | 'active' | 'past_due' | 'cancelled';

export interface Membership {
    status: MembershipStatus;
    /** Name of the plan as billing calls it. */
    planName: string;
    /** USD per period; 0 while the fee is waived. */
    amount: number;
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
    /** Why it was refused (`invalid`, `expired`, `not_eligible`) or nothing when accepted. */
    reason?: 'invalid' | 'expired' | 'not_eligible' | 'not_available_yet';
}

export async function loadMembership(memberSince?: string | null): Promise<Membership> {
    return {
        status: 'startup_waived',
        planName: 'All-access',
        amount: 0,
        period: 'month',
        periodsOffered: ['month', 'year'],
        nextPaymentAt: null,
        promoAvailable: true,
        memberSince: memberSince ?? null,
    };
}

/** Plans have not launched: any code is kept for when they do. */
export async function applyPromoCode(_code: string): Promise<PromoResult> {
    return { ok: false, reason: 'not_available_yet' };
}

export interface PlanChangeResult {
    ok: boolean;
    reason?: 'not_available_yet' | 'failed';
}

/** Plans have not launched: there is nothing to cancel yet (the fee is waived). */
export async function cancelPlan(): Promise<PlanChangeResult> {
    return { ok: false, reason: 'not_available_yet' };
}
