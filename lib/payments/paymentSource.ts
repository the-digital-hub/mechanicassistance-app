import type { PaymentCard } from '@/lib/dao/interfaces';
import { MAX_TOP_UP, MIN_TOP_UP, type Wallet } from '@/lib/dao/WalletDAO';

import { WALLET_METHOD } from './cardLabel';

/** Money as a number; anything unparseable reads as 0. */
function money(value: string | number | null | undefined): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** Whether the wallet's spendable balance covers `amount`. Unknown amount: any positive balance. */
export function walletCovers(wallet: Wallet | null | undefined, amount: number | null | undefined): boolean {
    if (!wallet) return false;
    const available = money(wallet.availableBalance);
    return amount == null ? available > 0 : available + 0.005 >= amount;
}

/**
 * How a new charge is paid unless the owner picks otherwise: the wallet when
 * its balance covers it, else the default card, else nothing.
 */
export function pickDefaultSource(
    amount: number | null | undefined,
    wallet: Wallet | null | undefined,
    defaultCard: PaymentCard | null | undefined,
): string | null {
    if (walletCovers(wallet, amount)) return WALLET_METHOD;
    return defaultCard?.id ?? null;
}

/** What is missing in the wallet to pay `amount`, rounded up to cents; 0 when it covers it. */
export function shortfall(amount: number, wallet: Wallet | null | undefined): number {
    const missing = Math.round((amount - money(wallet?.availableBalance)) * 100) / 100;
    return missing > 0 ? missing : 0;
}

/** The top-up to propose: the shortfall, within what billing accepts for one top-up. */
export function suggestedTopUp(amount: number, wallet: Wallet | null | undefined): string {
    const value = Math.min(MAX_TOP_UP, Math.max(MIN_TOP_UP, shortfall(amount, wallet)));
    return value.toFixed(2);
}

/** Parses what the person typed as a top-up; null when it is not a valid amount. */
export function parseTopUp(raw: string): string | null {
    const cleaned = raw.replace(/[$,\s]/g, '');
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(cleaned)) return null;
    const value = Number(cleaned);
    if (value < MIN_TOP_UP || value > MAX_TOP_UP) return null;
    return value.toFixed(2);
}

/** "$1,234.50" for a decimal string or number. */
export function formatMoney(value: string | number | null | undefined, currency = 'USD'): string {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(money(value));
    } catch {
        return `$${money(value).toFixed(2)}`;
    }
}
