import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { walletDAO } from '@/lib/dao/WalletDAO';

import { InsufficientFundsSheet } from '../InsufficientFundsSheet';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key) }),
}));
jest.mock('@/lib/dao/WalletDAO', () => ({ MIN_TOP_UP: 5, MAX_TOP_UP: 500, walletDAO: { topUp: jest.fn() } }));

const topUp = walletDAO.topUp as jest.Mock;
const CARD = { id: 'card-1', type: 'card', brand: 'visa', last4: '4242', expMonth: 1, expYear: 2099, label: null, isDefault: true, createdAt: '' };
const WALLET = { id: 'w', balance: '12.35', heldBalance: '0', availableBalance: '12.35' };

function renderSheet() {
    const props = { onToppedUp: jest.fn(), onPayWithCard: jest.fn(), onClose: jest.fn() };
    const utils = render(<InsufficientFundsSheet visible amount={40} wallet={WALLET} cards={[CARD]} {...props} />);
    return { ...utils, ...props };
}

describe('InsufficientFundsSheet', () => {
    beforeEach(() => topUp.mockReset());

    it('says how much is missing', () => {
        const { getByTestId } = renderSheet();
        expect(getByTestId('insufficient-funds-body').props.children).toContain('"missing":"$27.65"');
    });

    it('adds the missing money to the wallet, prefilled, then hands back the new wallet', async () => {
        const next = { ...WALLET, balance: '40.00', availableBalance: '40.00' };
        topUp.mockResolvedValue(next);
        const { getByTestId, onToppedUp } = renderSheet();

        fireEvent.press(getByTestId('insufficient-funds-topup'));
        expect(getByTestId('wallet-topup-amount').props.value).toBe('27.65');
        fireEvent.press(getByTestId('wallet-topup-submit'));

        await waitFor(() => expect(onToppedUp).toHaveBeenCalledWith(next));
        expect(topUp).toHaveBeenCalledWith('card-1', '27.65');
    });

    it('or pays with a card', () => {
        const { getByTestId, onPayWithCard } = renderSheet();
        fireEvent.press(getByTestId('insufficient-funds-card'));
        fireEvent.press(getByTestId('insufficient-funds-card-card-1'));
        expect(onPayWithCard).toHaveBeenCalledWith('card-1');
    });
});
