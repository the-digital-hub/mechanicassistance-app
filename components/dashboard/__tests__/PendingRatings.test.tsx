import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockSubmit = jest.fn();
const mockReviewClient = jest.fn();

jest.mock('@/lib/dao/ReviewDAO', () => ({ reviewDAO: { submit: (...a: unknown[]) => mockSubmit(...a) } }));
jest.mock('@/lib/dao/OnSiteDAO', () => ({ onSiteDAO: { reviewClient: (...a: unknown[]) => mockReviewClient(...a) } }));
jest.mock('@/lib/dao/UserDAO', () => ({ userDAO: { getPublicProfile: jest.fn().mockResolvedValue({ name: 'Ana', surname: 'Diaz' }) } }));
jest.mock('@/hooks/useAppointmentMechanic', () => ({ useAppointmentMechanic: () => ({ displayName: 'Diego M.' }) }));
jest.mock('@/lib/ui/appAlert', () => ({ appAlert: jest.fn() }));
jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return { __esModule: true, default: { View }, FadeIn: { duration: () => undefined }, FadeOut: { duration: () => undefined } };
});

import { PendingRatings } from '../PendingRatings';

const job = (id: string) => ({ id, title: 'Tire Assistance, Other: Fast', car: 'TESLA Model 3', status: 'completed', mechanicId: 'm1', userId: 'u1', completedAt: '2026-11-19T10:00:00Z' }) as never;

describe('PendingRatings', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows a card per pending job, with who is rated', () => {
        const { getByTestId, getAllByText } = render(<PendingRatings appointments={[job('a'), job('b')]} role="user" onSent={jest.fn()} onClose={jest.fn()} />);
        expect(getByTestId('rating-card-a')).toBeTruthy();
        expect(getByTestId('rating-card-b')).toBeTruthy();
        expect(getAllByText('Diego M.').length).toBe(2);
    });

    it('the owner rates the technician with the stars and sends it', async () => {
        mockSubmit.mockResolvedValue({});
        const onSent = jest.fn();
        jest.useFakeTimers();
        const { getAllByTestId } = render(<PendingRatings appointments={[job('a')]} role="user" onSent={onSent} onClose={jest.fn()} />);
        fireEvent.press(getAllByTestId('rating-star-4')[0]);
        await act(async () => { fireEvent.press(getAllByTestId('rating-send')[0]); });
        expect(mockSubmit).toHaveBeenCalledWith('a', 4, undefined, []);
        await act(async () => { jest.advanceTimersByTime(1200); });
        expect(onSent).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('the technician rates the customer through the visit call', async () => {
        mockReviewClient.mockResolvedValue({});
        const { getAllByTestId } = render(<PendingRatings appointments={[job('a')]} role="mechanic" onSent={jest.fn()} onClose={jest.fn()} />);
        fireEvent.press(getAllByTestId('rating-star-5')[0]);
        await act(async () => { fireEvent.press(getAllByTestId('rating-send')[0]); });
        await waitFor(() => expect(mockReviewClient).toHaveBeenCalledWith('a', 5, undefined, []));
    });

    it('does not send without stars', async () => {
        const { getAllByTestId } = render(<PendingRatings appointments={[job('a')]} role="user" onSent={jest.fn()} onClose={jest.fn()} />);
        await act(async () => { fireEvent.press(getAllByTestId('rating-send')[0]); });
        expect(mockSubmit).not.toHaveBeenCalled();
    });
});
