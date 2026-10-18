import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { PaymentCard } from '@/lib/dao/interfaces';
import { paymentMethodDAO } from '@/lib/dao/PaymentMethodDAO';

/**
 * The signed-in customer's saved cards, reloaded every time the screen gets
 * focus — so a card added in "Mis tarjetas" shows up on the way back. Pass
 * `enabled = false` on screens a mechanic also opens: they have no cards.
 */
export function usePaymentCards(enabled = true) {
  const [cards, setCards] = useState<PaymentCard[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let active = true;
      paymentMethodDAO
        .list()
        .then((list) => {
          if (active) setCards(list);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [enabled]),
  );

  // `list()` answers with the default card first.
  const defaultCard = cards.find((c) => c.isDefault) ?? cards[0] ?? null;

  /** The card behind a request's `paymentMethodId`; the default one when it names none. */
  const resolve = useCallback(
    (paymentMethodId: string | null | undefined): PaymentCard | null =>
      paymentMethodId ? cards.find((c) => c.id === paymentMethodId) ?? null : defaultCard,
    [cards, defaultCard],
  );

  return { cards, defaultCard, resolve };
}
