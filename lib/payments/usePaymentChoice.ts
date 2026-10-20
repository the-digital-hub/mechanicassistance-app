import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WALLET_METHOD, cardLabel } from './cardLabel';
import { formatMoney, pickDefaultSource } from './paymentSource';
import { usePaymentCards } from './usePaymentCards';
import { useWallet } from './useWallet';

/**
 * How a new request will be paid, for the wizard's summary: the wallet when
 * its balance covers `amount`, else the default card — until the owner picks
 * another in the CardPickerModal. `selectedId` is what goes in the request as
 * `paymentMethodId` (`'wallet'` or a card id), null when there is nothing.
 */
export function usePaymentChoice(amount: number | null | undefined) {
    const { t } = useTranslation();
    const { cards, defaultCard } = usePaymentCards();
    const { wallet } = useWallet();
    const [picked, setPicked] = useState<string | null>(null);

    const pickedIsValid = picked === WALLET_METHOD || (!!picked && cards.some((c) => c.id === picked));
    const selectedId = pickedIsValid ? picked : pickDefaultSource(amount, wallet, defaultCard);
    const selectedCard = selectedId && selectedId !== WALLET_METHOD ? cards.find((c) => c.id === selectedId) ?? null : null;

    const selectedLabel =
        selectedId === WALLET_METHOD
            ? wallet
                ? t('paymentCards.walletWithBalance', { available: formatMoney(wallet.availableBalance) })
                : t('paymentCards.wallet')
            : selectedCard
                ? cardLabel(selectedCard)
                : t('paymentCards.noCard');

    return { cards, wallet, selectedId, selectedLabel, pick: setPicked };
}
