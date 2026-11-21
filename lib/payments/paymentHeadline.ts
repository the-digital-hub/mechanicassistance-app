import type { PaymentHistoryItem } from '@/lib/dao/WalletDAO';

/** The amount that best describes a payment in its current state (what was refunded, else charged, else held). */
export function paymentHeadline(p: PaymentHistoryItem): string {
    if (Number(p.amountRefunded) > 0) return p.amountRefunded;
    if (Number(p.amountCharged) > 0) return p.amountCharged;
    return p.amountHeld;
}
