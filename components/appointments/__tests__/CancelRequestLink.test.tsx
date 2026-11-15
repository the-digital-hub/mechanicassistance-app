import { fireEvent, render } from '@testing-library/react-native';

import { CancelRequestLink, canCancelBeforeStart } from '../CancelRequestLink';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('lucide-react-native', () => ({ X: () => null }));

describe('canCancelBeforeStart', () => {
    it('allows only jobs that have not started', () => {
        expect(canCancelBeforeStart('accepted')).toBe(true);
        expect(canCancelBeforeStart('scheduled')).toBe(true);
        expect(canCancelBeforeStart('pending')).toBe(true);
        expect(canCancelBeforeStart('started')).toBe(false);
        expect(canCancelBeforeStart('completed')).toBe(false);
        expect(canCancelBeforeStart('cancelled')).toBe(false);
        expect(canCancelBeforeStart(undefined)).toBe(false);
    });
});

describe('CancelRequestLink', () => {
    beforeEach(() => mockPush.mockClear());

    it('confirms first, then opens the cancel-reason screen', () => {
        const { getByTestId, getByText } = render(<CancelRequestLink appointmentId="abc" />);

        fireEvent.press(getByTestId('cancel-request-link'));
        expect(mockPush).not.toHaveBeenCalled();

        fireEvent.press(getByText('appointments.list.yesCancel'));
        expect(mockPush).toHaveBeenCalledWith({ pathname: '/appointments/cancel-reason', params: { id: 'abc' } });
    });

    it('does nothing when the owner answers No', () => {
        const { getByTestId, getByText } = render(<CancelRequestLink appointmentId="abc" />);

        fireEvent.press(getByTestId('cancel-request-link'));
        fireEvent.press(getByText('appointments.list.no'));
        expect(mockPush).not.toHaveBeenCalled();
    });
});
