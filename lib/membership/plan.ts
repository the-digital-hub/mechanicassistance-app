/**
 * The membership plan shown in the profile. SIMULATED for now: the numbers below are what the screen draws until the billing endpoints
 * exist (see docs/backlog-backend.md, "AN — Membership plan"). When they do, only `loadMembership` and `applyPromoCode` change: the screen
 * reads this shape and nothing else.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MEMBERSHIP_FREE_AT_LAUNCH } from './launch';

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
    /** The vehicle owner's plan is per vehicle: one line each (absent for a technician, and for an owner whose vehicles were not given). */
    fleet?: Fleet;
}

/** A vehicle of the owner's plan: it has its own price (by its place in the fleet) and its own year. */
export interface FleetLine {
    vehicleId: string;
    /** "Toyota Corolla 2019". */
    label: string;
    /** The last six characters of the VIN. */
    vinTail: string;
    /** Price of its place in the fleet, before any coupon. */
    listPrice: number;
    /** What it costs (or cost) after the coupon. */
    price: number;
    payment: MembershipPayment | null;
    /** ISO date this vehicle's year ends; null while it is not paid. */
    renewsAt: string | null;
}

export interface Fleet {
    lines: FleetLine[];
    /** What the fleet saves against the first vehicle's price on every one, in USD per year. */
    fleetDiscount: number;
    /** Vehicles with something to pay. */
    pendingCount: number;
}

/** A vehicle as the plan needs it: the ones without a VIN are not in the plan. */
export interface PlanVehicle {
    id?: string;
    vin?: string | null;
    make?: string;
    model?: string;
    year?: number | null;
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
export const TECHNICIAN_PLAN_USD_PER_YEAR = 120;
export const OWNER_PLAN_USD_PER_YEAR = 15;

const PLAN_USD_PER_YEAR: Record<Role, number> = { mechanic: TECHNICIAN_PLAN_USD_PER_YEAR, user: OWNER_PLAN_USD_PER_YEAR };

/**
 * The owner pays per vehicle with a VIN, and each one after the first costs less: the first $15, the second and third $12, from the fourth $9
 * (a year each). The place is the order the vehicles come in.
 */
export const OWNER_VEHICLE_PRICES = [15, 12, 12] as const;
export const OWNER_VEHICLE_PRICE_FROM_FOURTH = 9;
/** The owner's plan has a name of its own (the technician's is "All-access"). */
export const OWNER_PLAN_NAME = 'Assistance Pass';
export const ownerVehiclePrice = (position: number) => OWNER_VEHICLE_PRICES[position] ?? OWNER_VEHICLE_PRICE_FROM_FOURTH;

/**
 * Promo codes the client knows. None: they live in billing now (`POST /api/membership/promo-code`, coupons made and switched on from the Hub,
 * see `servicios/billing/08-membresia-api.md` in the analysis repo), and the app does not carry its own. Phase 2 of the membership replaces
 * this table, `applyPromoCode` and the saved coupon with those calls.
 */
const PROMO_CODES: Record<Role, Record<string, number>> = {
    mechanic: {},
    user: {},
};

// The technician keeps the keys it always had; the owner's carry the role (one person can be both).
const scope = (role: Role, userId: string) => (role === 'mechanic' ? userId : `user:${userId}`);
const couponKey = (role: Role, userId: string) => `membership_coupon_v1:${scope(role, userId)}`;
const paymentKey = (role: Role, userId: string) => `membership_payment_v1:${scope(role, userId)}`;
/** The owner's payments, one per vehicle: { [vehicleId]: payment }. */
const fleetPaymentsKey = (userId: string) => `membership_fleet_v1:${userId}`;

async function savedFleetPayments(userId?: string | null): Promise<Record<string, MembershipPayment>> {
    if (!userId) return {};
    try {
        const raw = await AsyncStorage.getItem(fleetPaymentsKey(userId));
        const parsed = raw ? (JSON.parse(raw) as Record<string, Partial<MembershipPayment>>) : {};
        const out: Record<string, MembershipPayment> = {};
        for (const [id, p] of Object.entries(parsed)) {
            if (p && typeof p.paidAt === 'string' && typeof p.amount === 'number') {
                out[id] = { paidAt: p.paidAt, amount: p.amount, couponCode: p.couponCode ?? null, method: p.method ?? { type: 'card', label: '' }, autoRenew: !!p.autoRenew };
            }
        }
        return out;
    } catch {
        return {};
    }
}

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

const renewalOf = (paidAt: string) => new Date(Date.parse(paidAt) + ONE_YEAR_MS).toISOString();

/** The owner's plan, vehicle by vehicle (see OWNER_VEHICLE_PRICES). Without a VIN a vehicle is not in it. */
async function loadOwnerMembership(userId: string | null | undefined, vehicles: PlanVehicle[], memberSince?: string | null): Promise<Membership> {
    const [coupon, payments] = await Promise.all([savedCoupon('user', userId), savedFleetPayments(userId)]);
    const covered = vehicles.filter((v) => v.id && v.vin && v.vin.trim());
    const lines: FleetLine[] = covered.map((v, position) => {
        const listPrice = ownerVehiclePrice(position);
        const payment = payments[v.id as string] ?? null;
        const vin = (v.vin as string).trim();
        return {
            vehicleId: v.id as string,
            label: [v.make, v.model, v.year].filter(Boolean).join(' ') || vin,
            vinTail: vin.slice(-6).toUpperCase(),
            listPrice,
            price: payment ? payment.amount : withCoupon(listPrice, coupon),
            payment,
            renewsAt: payment ? renewalOf(payment.paidAt) : null,
        };
    });
    const pending = lines.filter((l) => !l.payment && l.price > 0);
    const paid = lines.filter((l) => l.payment);
    const sum = (list: FleetLine[], pick: (l: FleetLine) => number) => Math.round(list.reduce((n, l) => n + pick(l), 0) * 100) / 100;
    // What the plan shows: what is to pay; once that is settled, what was paid; with a coupon that covers everything, the vehicles at their list price.
    const showing = pending.length > 0 ? pending : paid.length > 0 ? paid : lines;
    const latest = paid.length > 0 ? paid.reduce((a, b) => (Date.parse((a.payment as MembershipPayment).paidAt) >= Date.parse((b.payment as MembershipPayment).paidAt) ? a : b)).payment : null;
    const renewals = paid.map((l) => l.renewsAt as string).sort();
    return {
        status: 'active',
        planName: OWNER_PLAN_NAME,
        amount: sum(showing, (l) => l.price),
        listAmount: sum(showing, (l) => l.listPrice),
        coupon,
        period: 'year',
        periodsOffered: ['year'],
        nextPaymentAt: renewals[0] ?? null,
        promoAvailable: !coupon && pending.length > 0,
        memberSince: memberSince ?? null,
        // Paid only when every vehicle with something to pay is.
        payment: pending.length === 0 ? latest : null,
        fleet: {
            lines,
            fleetDiscount: sum(lines, (l) => OWNER_VEHICLE_PRICES[0] - l.listPrice),
            pendingCount: pending.length,
        },
    };
}

/** The plan while it is free (see `MEMBERSHIP_FREE_AT_LAUNCH`): nothing to pay, no price, no code, no fleet breakdown. */
function freeMembership(role: Role, memberSince?: string | null): Membership {
    return {
        status: 'startup_waived',
        planName: role === 'user' ? OWNER_PLAN_NAME : 'All-access',
        amount: 0,
        listAmount: 0,
        coupon: null,
        period: 'year',
        periodsOffered: ['year'],
        nextPaymentAt: null,
        promoAvailable: false,
        memberSince: memberSince ?? null,
        payment: null,
    };
}

export async function loadMembership(role: Role = 'user', userId?: string | null, memberSince?: string | null, vehicles?: PlanVehicle[]): Promise<Membership> {
    if (MEMBERSHIP_FREE_AT_LAUNCH) return freeMembership(role, memberSince);
    // The owner's plan is per vehicle when their vehicles are given; the technician's is one price.
    if (role === 'user' && vehicles) return loadOwnerMembership(userId, vehicles, memberSince);
    // Both plans are billed once a year: $120 for the technician, $15 for the owner (a coupon can take it down, even to nothing).
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
    if (MEMBERSHIP_FREE_AT_LAUNCH) return { ok: false, reason: 'not_available_yet' };
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
export async function payMembership(role: Role, userId: string | null | undefined, options: { method: PaymentMethodUsed; autoRenew?: boolean; vehicles?: PlanVehicle[] }): Promise<PayResult> {
    if (MEMBERSHIP_FREE_AT_LAUNCH || !userId) return { ok: false, reason: 'nothing_to_pay' };
    // An owner pays the vehicles that are pending, each one for its own year.
    if (role === 'user' && options.vehicles) {
        const owner = await loadOwnerMembership(userId, options.vehicles);
        const pending = (owner.fleet?.lines ?? []).filter((l) => !l.payment && l.price > 0);
        if (pending.length === 0) return { ok: false, reason: (owner.fleet?.lines ?? []).some((l) => l.payment) ? 'already_paid' : 'nothing_to_pay' };
        await new Promise((resolve) => setTimeout(resolve, 900));
        const paidAt = new Date().toISOString();
        const saved = await savedFleetPayments(userId);
        for (const line of pending) {
            saved[line.vehicleId] = { paidAt, amount: line.price, couponCode: owner.coupon?.code ?? null, method: options.method, autoRenew: options.method.type === 'card' && options.autoRenew !== false };
        }
        try {
            await AsyncStorage.setItem(fleetPaymentsKey(userId), JSON.stringify(saved));
        } catch {
            return { ok: false, reason: 'failed' };
        }
        return { ok: true, payment: saved[pending[0].vehicleId] };
    }
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
    if (role === 'user') {
        const saved = await savedFleetPayments(userId);
        for (const id of Object.keys(saved)) if (saved[id].method.type === 'card') saved[id] = { ...saved[id], autoRenew };
        await AsyncStorage.setItem(fleetPaymentsKey(userId), JSON.stringify(saved)).catch(() => undefined);
    }
    const payment = await savedPayment(role, userId);
    if (!payment || payment.method.type !== 'card') return;
    await AsyncStorage.setItem(paymentKey(role, userId), JSON.stringify({ ...payment, autoRenew })).catch(() => undefined);
}

/** Clears the simulated payment (to test the flow again). */
export async function resetMembershipPayment(userId?: string | null, role: Role = 'mechanic'): Promise<void> {
    if (userId) await AsyncStorage.removeItem(paymentKey(role, userId)).catch(() => undefined);
    if (userId && role === 'user') await AsyncStorage.removeItem(fleetPaymentsKey(userId)).catch(() => undefined);
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
