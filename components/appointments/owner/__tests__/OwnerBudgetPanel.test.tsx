import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { OwnerBudgetPanel } from '../OwnerSections';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/hooks/useAppointmentEta', () => ({ useAppointmentEta: () => ({}) }));
jest.mock('@/context/SocketContext', () => ({ useSocket: () => ({}) }));
jest.mock('@/context/UserContext', () => ({ useUser: () => ({ user: null }) }));
jest.mock('@/components/appointments/owner/OwnerRouteMap', () => ({ OwnerRouteMap: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key),
    }),
}));

const labels = (tree: ReturnType<typeof render>) =>
    tree.UNSAFE_getAllByType(Text).map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)));

describe('owner budget of a video call with extra time', () => {
    it('puts the minutes next to the extra time, then the total under a line, and the payment last', () => {
        const tree = render(
            <OwnerBudgetPanel
                total="60.00"
                payment={<Text>VISA</Text>}
                video
                extendedMinutes={30}
                extendedAmount="30.00"
                grandTotal="90.00"
            />,
        );
        const text = labels(tree);
        const at = (needle: string) => text.findIndex((l) => l.includes(needle));
        expect(at('rows.serviceValue')).toBeGreaterThanOrEqual(0);
        // The minutes live in the label, the value is the amount.
        expect(text.some((l) => l.includes('rows.extendedTimeMinutes:30'))).toBe(true);
        expect(text.some((l) => l.includes('+$30.00'))).toBe(true);
        expect(at('rows.extendedTimeMinutes')).toBeLessThan(at('rows.total'));
        expect(at('rows.total')).toBeLessThan(at('rows.payment'));
        expect(at('rows.payment')).toBeLessThan(text.indexOf('VISA'));
        expect(text.some((l) => l.includes('$90.00'))).toBe(true);
    });

    it('has no total row without extra time to add up', () => {
        const tree = render(<OwnerBudgetPanel total="60.00" payment={<Text>VISA</Text>} video />);
        expect(labels(tree).some((l) => l.includes('rows.total'))).toBe(false);
    });
});
