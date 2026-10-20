import { apiClient } from '../api/apiClient';

/** The signed-in person's prepaid wallet (billing-service, /api/wallets/me). Amounts are decimal strings. */
export interface Wallet {
    id: string;
    balance: string;
    /** Reserved for services in progress: not spendable until they close. */
    heldBalance: string;
    /** What can be spent now: balance − heldBalance. */
    availableBalance: string;
}

/** One movement of the wallet: `deposit` (top-up), `deduction` (a charge), `refund`, … */
export interface WalletMovement {
    id: string;
    type: string;
    amount: string;
    method: string | null;
    paymentId: string | null;
    createdAt: string;
}

export interface PaymentHistoryItem {
    id: string;
    assistanceRequestId: string | null;
    method: string;
    purpose: string;
    status: string;
    currency: string;
    amountHeld: string;
    amountCharged: string;
    amountRefunded: string;
    createdAt: string;
}

export interface PaymentHistory {
    payments: { items: PaymentHistoryItem[]; total: number; page: number; limit: number };
    walletMovements: WalletMovement[];
}

/** A personal top-up must be between these (billing's MIN_TOP_UP / MAX_TOP_UP). */
export const MIN_TOP_UP = 5;
export const MAX_TOP_UP = 500;

/**
 * Client for the prepaid wallet. Billing creates the wallet empty the first
 * time it is read; topping up charges a saved card right away (402 when the
 * card is declined, 503 `topups_paused` while top-ups are switched off).
 */
export class WalletDAO {
    getMine(): Promise<Wallet> {
        return apiClient.get('/api/wallets/me');
    }

    /** `amount` as a decimal string, e.g. "20.00". */
    topUp(paymentMethodId: string, amount: string): Promise<Wallet> {
        return apiClient.post('/api/wallets/me/top-up', { paymentMethodId, amount });
    }

    /** Payments of every service plus the wallet's own movements, newest first. */
    history(page = 1, limit = 20): Promise<PaymentHistory> {
        return apiClient.get('/api/payments/me/history', { page, limit });
    }
}

export const walletDAO = new WalletDAO();
