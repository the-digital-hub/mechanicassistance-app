import type { PaymentCard } from '@/lib/dao/interfaces';

/** `paymentMethodId` value that means "pay from my prepaid wallet" instead of a saved card. */
export const WALLET_METHOD = 'wallet';

const BRAND_NAMES: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
};

export function brandName(brand: string | null) {
  if (!brand) return '';
  return BRAND_NAMES[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function isExpired(card: PaymentCard) {
  if (!card.expMonth || !card.expYear) return false;
  const now = new Date();
  return card.expYear < now.getFullYear()
    || (card.expYear === now.getFullYear() && card.expMonth < now.getMonth() + 1);
}

/** "Visa •••• 4242", as the card list shows it. */
export function cardLabel(card: PaymentCard) {
  return `${brandName(card.brand)} •••• ${card.last4 ?? ''}`.trim();
}
