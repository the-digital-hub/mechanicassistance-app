import { render } from '@testing-library/react-native';
import React from 'react';

import { CallConditions, TechnicianCard } from '../OfferSections';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('the offer of a video call', () => {
    it('keeps its conditions to a title, when it is charged and when it is held', () => {
        const { getByText, queryByText } = render(<CallConditions hold="$69.00 is held when you confirm." />);
        expect(getByText('requestAssistance.mechanicFound.callConditionsTitle')).toBeTruthy();
        expect(getByText('requestAssistance.mechanicFound.callConditionsCharge')).toBeTruthy();
        expect(getByText('$69.00 is held when you confirm.')).toBeTruthy();
        expect(queryByText('requestAssistance.mechanicFound.protectedTitle')).toBeNull();
    });

    it('leaves the hold line out when there is no payment method yet', () => {
        const { queryByText } = render(<CallConditions hold={null} />);
        expect(queryByText('requestAssistance.mechanicFound.callConditionsCharge')).toBeTruthy();
        expect(queryByText(/held/)).toBeNull();
    });

    it('can leave "Fixed price" out from under the price', () => {
        const withCaption = render(<TechnicianCard mechanic={null} eta="Now" price="$69.00" />);
        expect(withCaption.queryByText('requestAssistance.mechanicFound.fixedPrice')).toBeTruthy();
        const without = render(<TechnicianCard mechanic={null} eta="Now" price="$69.00" priceCaption={false} />);
        expect(without.queryByText('requestAssistance.mechanicFound.fixedPrice')).toBeNull();
    });

    it('hides who the technician is while locked, and keeps price and rating', () => {
        const mechanic = { displayName: 'Diego M.', initials: 'DM', profileImage: null, avgRating: 4.8, servicesCount: 12, aseCertified: true, idVerified: true } as never;
        const locked = render(<TechnicianCard mechanic={mechanic} eta="Now" price="$69.00" locked />);
        expect(locked.queryByText('Diego M.')).toBeNull();
        expect(locked.queryByText('DM')).toBeNull();
        expect(locked.queryByText('requestAssistance.mechanicFound.technicianLocked')).toBeTruthy();
        expect(locked.queryByText('$69.00')).toBeTruthy();
        const open = render(<TechnicianCard mechanic={mechanic} eta="Now" price="$69.00" />);
        expect(open.queryByText('Diego M.')).toBeTruthy();
    });
});
