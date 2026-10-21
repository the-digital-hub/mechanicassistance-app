import React from 'react';
import { render } from '@testing-library/react-native';

import type { EarningRow } from '@/lib/payments/useEarnings';

import { EarningItemCard } from '../EarningItemCard';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key),
        i18n: { language: 'en' },
    }),
}));
jest.mock('@/lib/dao/WalletDAO', () => ({ walletDAO: {} }));

const BASE: EarningRow = {
    id: 'e1',
    assistanceRequestId: '66e5f449-87c6-4796-836f-b069f2f694e1',
    grossAmount: '200.00',
    platformFee: '51.00',
    netAmount: '149.00',
    currency: 'usd',
    status: 'ready',
    settledAt: null,
    createdAt: '2026-10-16T16:17:00.000Z',
    job: {
        id: '66e5f449-87c6-4796-836f-b069f2f694e1',
        assistanceType: 'immediate',
        title: 'Immediate Assistance',
        address: '3539 NW 82nd Terrace, Pembroke Pines, FL, 33024',
        createdAt: '2026-10-16T16:17:00.000Z',
        isVideoCall: false,
    },
};

describe('EarningItemCard', () => {
    it('shows the job, its location, the net amount and the status, never the fee', () => {
        const { getByText, queryByText } = render(<EarningItemCard row={BASE} />);
        getByText('Immediate Assistance');
        getByText(/payments\.activity\.location .*Pembroke Pines/);
        getByText('$149.00');
        getByText('payments.status.ready');
        expect(queryByText('$51.00')).toBeNull();
        expect(queryByText('$200.00')).toBeNull();
    });

    it('says the request details are unavailable when the job could not be read', () => {
        const { getByText } = render(<EarningItemCard row={{ ...BASE, job: null, status: 'pending' }} />);
        getByText('payments.activity.fallbackTitle');
        getByText('payments.activity.unavailable');
        getByText('payments.statusHint.pending');
    });
});
