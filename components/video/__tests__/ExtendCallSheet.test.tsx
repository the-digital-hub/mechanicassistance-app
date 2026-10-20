import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/lib/api/types';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';

import { ExtendCallSheet } from '../ExtendCallSheet';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key) }),
}));
jest.mock('@/lib/dao/VideoCallDAO', () => ({ videoCallDAO: { getExtensions: jest.fn(), extend: jest.fn() } }));
jest.mock('@/lib/dao/WalletDAO', () => ({ MIN_TOP_UP: 5, MAX_TOP_UP: 500 }));
jest.mock('@/components/payments/CardPickerModal', () => ({ CardPickerModal: () => null }));
// Exposes the "not enough balance" sheet's card choice as a button.
jest.mock('@/components/payments/InsufficientFundsSheet', () => {
    const { Text } = jest.requireActual('react-native');
    return {
        InsufficientFundsSheet: ({ visible, onPayWithCard }: { visible: boolean; onPayWithCard: (id: string) => void }) =>
            visible ? <Text testID="short-pay-card" onPress={() => onPayWithCard('card-1')}>short</Text> : null,
    };
});
jest.mock('@/lib/payments/usePaymentCards', () => {
    const card = { id: 'card-1', brand: 'visa', last4: '4242', isDefault: true, expMonth: 1, expYear: 2099 };
    return { usePaymentCards: () => ({ cards: [card], defaultCard: card }) };
});
let mockAvailable = '100.00';
jest.mock('@/lib/payments/useWallet', () => ({
    useWallet: () => ({
        wallet: { id: 'w', balance: mockAvailable, heldBalance: '0', availableBalance: mockAvailable },
        setWallet: jest.fn(),
    }),
}));

const getExtensions = videoCallDAO.getExtensions as jest.Mock;
const extend = videoCallDAO.extend as jest.Mock;

const CATALOG = {
    appointmentId: 'appt-1',
    baseMinutes: 45,
    maxExtensions: 3,
    extensionsUsed: 0,
    contractedMinutes: 45,
    options: [15, 30, 45].map((m) => ({ id: `ext_${m}`, minutes: m, price: ((60 * m) / 45).toFixed(2), currency: 'USD' })),
    extensions: [],
};

function renderSheet() {
    const onExtended = jest.fn();
    const onClose = jest.fn();
    const utils = render(<ExtendCallSheet visible appointmentId="appt-1" onClose={onClose} onExtended={onExtended} />);
    return { ...utils, onExtended, onClose };
}

describe('ExtendCallSheet', () => {
    beforeEach(() => {
        mockAvailable = '100.00';
        getExtensions.mockReset().mockResolvedValue(CATALOG);
        extend.mockReset();
    });

    it('offers 15, 30 and 45 minutes at their prices', async () => {
        const { findByTestId, getByTestId } = renderSheet();
        await findByTestId('extend-option-15');
        expect(getByTestId('extend-option-30')).toBeTruthy();
        expect(getByTestId('extend-option-45')).toBeTruthy();
    });

    it('pays from the wallet when it covers the block', async () => {
        extend.mockResolvedValue({ id: 'e1', minutesAdded: 30, status: 'held' });
        const { findByTestId, getByTestId, onExtended, onClose } = renderSheet();

        fireEvent.press(await findByTestId('extend-option-30'));
        fireEvent.press(getByTestId('extend-call-confirm'));

        await waitFor(() => expect(onExtended).toHaveBeenCalled());
        expect(extend).toHaveBeenCalledWith('appt-1', 30, expect.any(String), 'wallet');
        expect(onClose).toHaveBeenCalled();
    });

    it('defaults to the card when the wallet is short', async () => {
        mockAvailable = '10.00';
        extend.mockResolvedValue({ id: 'e1', minutesAdded: 15, status: 'held' });
        const { findByTestId, getByTestId } = renderSheet();

        await findByTestId('extend-option-15');
        fireEvent.press(getByTestId('extend-call-confirm'));

        await waitFor(() => expect(extend).toHaveBeenCalledWith('appt-1', 15, expect.any(String), 'card-1'));
    });

    it('on "not enough balance" lets the owner pay with a card, with a new key', async () => {
        extend
            .mockRejectedValueOnce(new ApiError(402, 'short', { code: 'insufficient_funds' }))
            .mockResolvedValueOnce({ id: 'e1', minutesAdded: 15, status: 'held' });
        const { findByTestId, getByTestId, onExtended } = renderSheet();

        await findByTestId('extend-option-15');
        fireEvent.press(getByTestId('extend-call-confirm'));
        fireEvent.press(await findByTestId('short-pay-card'));

        await waitFor(() => expect(onExtended).toHaveBeenCalled());
        expect(extend).toHaveBeenCalledTimes(2);
        expect(extend.mock.calls[1][3]).toBe('card-1');
        expect(extend.mock.calls[1][2]).not.toBe(extend.mock.calls[0][2]);
    });

    it('says so when the call already has every extension', async () => {
        getExtensions.mockResolvedValue({ ...CATALOG, extensionsUsed: 3 });
        const { findByTestId } = renderSheet();
        expect(await findByTestId('extend-call-limit')).toBeTruthy();
        expect(extend).not.toHaveBeenCalled();
    });
});
