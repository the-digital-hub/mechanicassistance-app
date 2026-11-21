import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ImmediateOfferPanel } from '../ImmediateOfferPanel';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => ({ ArrowUpRight: 'ArrowUpRight', Clock: 'Clock' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@/components/ui/FixedLocationMap', () => ({ FixedLocationMap: 'FixedLocationMap' }));
jest.mock('@/hooks/useRequestRoute', () => ({ useRequestRoute: () => ({ distKm: 3.2, etaText: '9 min' }) }));

const request = { id: 'r1', type: 'immediate', title: 'Tire Assistance', car: 'Ford', address: 'x', locationLat: 25.1, locationLng: -80.2 } as never;

describe('ImmediateOfferPanel', () => {
    it('shows the distance and ETA on the card and sends the offer with that ETA in one tap', () => {
        const onSend = jest.fn();
        const onDecline = jest.fn();
        const tree = render(<ImmediateOfferPanel request={request} onSend={onSend} onDecline={onDecline} />);
        expect(tree.getByText('2.0 mi')).toBeTruthy();
        expect(tree.getByText('9 min')).toBeTruthy();
        fireEvent.press(tree.getByTestId('request-send-offer'));
        expect(onSend).toHaveBeenCalledWith(request, '9 min');
        fireEvent.press(tree.getByText('dashboard.mechanic.decline'));
        expect(onDecline).toHaveBeenCalledWith('r1');
    });
});
