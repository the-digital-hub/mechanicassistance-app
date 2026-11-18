import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import type { PaymentCard } from '@/lib/dao/interfaces';
import { cardLabel, WALLET_METHOD } from '@/lib/payments/cardLabel';
import { ChangeBadge } from '@/components/ui/ChangeBadge';

type Props = {
  /** The request's `paymentMethodId`; `'wallet'` is the prepaid wallet. */
  paymentMethodId?: string | null;
  /** The card it resolves to (see `usePaymentCards().resolve`). */
  card: PaymentCard | null;
  /** Shows "Change" when given; without it the value is read-only. */
  onChange?: () => void;
};

/** The payment row's value: the card the request is charged to ("Visa •••• 4242"). */
export function PaymentCardValue({ paymentMethodId, card, onChange }: Props) {
  const { t } = useTranslation();
  const label =
    paymentMethodId === WALLET_METHOD
      ? t('paymentCards.wallet')
      : card
        ? cardLabel(card)
        : t('paymentCards.noCard');

  return (
    <View className="flex-row items-center" style={{ gap: 8, flexShrink: 1 }}>
      <Text
        className="font-outfit-bold"
        style={{ color: AO.text, fontSize: 13, textAlign: 'right', flexShrink: 1 }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {onChange && <ChangeBadge onPress={onChange} />}
    </View>
  );
}
