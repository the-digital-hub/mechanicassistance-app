import React from 'react';
import { render } from '@testing-library/react-native';
import VideoCallWhenScreen from '@/app/(tabs)/request-assistance/when';

// Before asking for a video call the owner sees how long it lasts (the hub's
// base minutes, 45 when the server does not say) and that it can be extended,
// the wait labelled as an estimate, and a "Confirm and request" button.

let mockBaseMinutes: number | undefined = 45;

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
            Promise.resolve({ mechanicsOnline: 3, estimatedWaitMinutes: 2, baseMinutes: mockBaseMinutes }),
        ),
        getSlots: jest.fn(() => Promise.resolve({ timezone: 'America/New_York', days: [] })),
    },
}));

describe('VideoCallWhenScreen summary', () => {
    beforeEach(() => {
        mockBaseMinutes = 45;
    });

    it('shows the call length, that it can be extended, the estimated wait and the search button', async () => {
        const { findByText, getByText, getByTestId } = render(<VideoCallWhenScreen />);
        expect(await findByText('requestAssistance.when.durationValue:45')).toBeTruthy();
        expect(getByText('requestAssistance.when.duration')).toBeTruthy();
        expect(getByTestId('when-duration-note').props.children).toBe('requestAssistance.when.durationNote:45');
        expect(getByText('requestAssistance.when.waitValue:2')).toBeTruthy();
        expect(getByText('requestAssistance.when.ctaNow')).toBeTruthy();
    });

    it('uses the length the hub set', async () => {
        mockBaseMinutes = 60;
        const { findByText } = render(<VideoCallWhenScreen />);
        expect(await findByText('requestAssistance.when.durationValue:60')).toBeTruthy();
    });

    it('falls back to 45 minutes when the server does not say', async () => {
        mockBaseMinutes = undefined;
        const { findByText } = render(<VideoCallWhenScreen />);
        expect(await findByText('requestAssistance.when.durationValue:45')).toBeTruthy();
    });
});
