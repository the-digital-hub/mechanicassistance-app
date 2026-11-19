import type { ProviderBreakdown } from '@/lib/dao/interfaces';

const num = (v?: string | number | null) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export interface MechanicReceiptTotals {
    /** What the technician takes home: the list card's amount, extra time included. */
    total: number;
    /** The call alone, net of fees (the breakdown's `total`). */
    callNet: number | null;
    /** Extra time bought during the call, net of fees. */
    extension: number;
}

/**
 * The numbers of a technician's receipt, all of them theirs: `budget` (the card's amount) is the whole take-home, the
 * breakdown's `total` is the call alone and the extra time is whatever the take-home has beyond it. What the platform
 * withholds is never shown to the technician. Everything is derived, nothing is computed from a rate.
 */
export function mechanicReceiptTotals(breakdown: ProviderBreakdown | null, budget: string | null | undefined, earningNet?: string | null): MechanicReceiptTotals {
    const budgetNumber = Number(String(budget ?? '').replace(/[^0-9.]/g, ''));
    const hasBudget = Number.isFinite(budgetNumber) && budgetNumber > 0;
    const callNet = breakdown ? num(breakdown.total) : null;
    const extension = hasBudget && callNet !== null && budgetNumber - callNet > 0.005 ? budgetNumber - callNet : 0;
    const total = hasBudget ? budgetNumber : num(earningNet ?? breakdown?.total);
    return { total, callNet, extension };
}
