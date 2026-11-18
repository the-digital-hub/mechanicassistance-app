import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import VideoCallWhenScreen from '@/app/(tabs)/request-assistance/when';

// Before asking for a video call the owner picks how long it lasts (the backend's menu,
// no default; without a menu the old flat-fee flow applies), sees that it can be extended, the wait labelled as an estimate, and
// the request button stays locked until a length is chosen.

let mockDurations: { minutes: number; price: number }[] | undefined = [
    { minutes: 15, price: 60 },
    { minutes: 30, price: 70 },
    { minutes: 45, price: 80 },
];

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { count?: number }) => (opts?.count != null ? `${key}:${opts.count}` : key),
        i18n: { language: 'en' },
    }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({ vehicleId: 'veh-1', vehicleName: 'Civic' }),
}));
jest.mock('@/components/payments/CardPickerModal', () => ({ CardPickerModal: () => null }));
jest.mock('@/context/RequestDraftContext', () => ({
    useRequestDraft: () => ({ vehicleDetails: null, obdFile: null, setObdFile: jest.fn() }),
}));
jest.mock('@/context/UserContext', () => ({ useUser: () => ({ user: { id: 'user-1', role: 'user' } }) }));
jest.mock('@/lib/dao/AssistanceDAO', () => ({ assistanceDAO: { create: jest.fn() } }));
jest.mock('@/lib/dao/RequestObdDAO', () => ({ requestObdDAO: { attach: jest.fn() } }));
jest.mock('@/lib/dao/PricingDAO', () => ({
    pricingDAO: {
        calculatePrice: jest.fn().mockResolvedValue({ pricing_breakdown: { final_price: 30 } }),
        persistRequestPrice: jest.fn(),
    },
}));
jest.mock('@/lib/payments/usePaymentChoice', () => ({
    usePaymentChoice: () => ({ cards: [], wallet: null, selectedId: 'card-1', selectedLabel: 'Visa •4242', pick: jest.fn() }),
}));
jest.mock('@/lib/dao/VideoCallDAO', () => ({
    deviceTimeZone: () => 'America/New_York',
    videoCallDAO: {
        getNow: jest.fn(() =>
            Promise.resolve({ mechanicsOnline: 3, estimatedWaitMinutes: 2, durations: mockDurations }),
        ),
        getSlots: jest.fn(() => Promise.resolve({ timezone: 'America/New_York', days: [] })),
    },
}));

describe('VideoCallWhenScreen summary', () => {
    beforeEach(() => {
        mockDurations = [
            { minutes: 15, price: 60 },
            { minutes: 30, price: 70 },
            { minutes: 45, price: 80 },
        ];
    });

    it('asks for the call length first and keeps the request locked until it is chosen', async () => {
        const { findByTestId, getByText, queryByTestId } = render(<VideoCallWhenScreen />);
        expect(await findByTestId('when-duration-15')).toBeTruthy();
        expect(getByText('requestAssistance.when.ctaPickDuration')).toBeTruthy();
        expect(getByText('requestAssistance.when.durationUnset')).toBeTruthy();
        expect(queryByTestId('when-duration-note')).toBeNull();
    });

    it('shows the chosen length, that it can be extended, the estimated wait and the search button', async () => {
        const { findByTestId, getByText, getByTestId } = render(<VideoCallWhenScreen />);
        fireEvent.press(await findByTestId('when-duration-30'));
        expect(getByText('requestAssistance.when.durationValue:30')).toBeTruthy();
        expect(getByTestId('when-duration-note').props.children).toBe('requestAssistance.when.durationNote:30');
        expect(getByText('requestAssistance.when.waitValue:2')).toBeTruthy();
        // Neither "Now" nor "Schedule" is marked until the owner picks: the button asks for it.
        expect(getByText('requestAssistance.when.ctaPickWhen')).toBeTruthy();
        fireEvent.press(getByTestId('when-option-now'));
        expect(getByText('requestAssistance.when.ctaNow')).toBeTruthy();
    });

    it('offers the menu the hub set', async () => {
        mockDurations = [{ minutes: 20, price: 50 }, { minutes: 40, price: 90 }];
        const { findByTestId, queryByTestId } = render(<VideoCallWhenScreen />);
        expect(await findByTestId('when-duration-20')).toBeTruthy();
        expect(queryByTestId('when-duration-45')).toBeNull();
    });

    it('keeps the old flat-fee flow, with no length to pick, while the backend sends no menu', async () => {
        mockDurations = undefined;
        const { findByText, queryByTestId } = render(<VideoCallWhenScreen />);
        expect(await findByText('requestAssistance.when.ctaNow')).toBeTruthy();
        expect(queryByTestId('when-duration-section')).toBeNull();
        expect(queryByTestId('when-duration-15')).toBeNull();
    });
});
