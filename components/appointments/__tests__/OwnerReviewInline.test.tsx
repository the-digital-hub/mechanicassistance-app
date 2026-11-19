import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';

import { OwnerReviewInline, useOwnerReviewPending } from '../OwnerReviewInline';
import { reviewDAO } from '@/lib/dao/ReviewDAO';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/useMessageDialog', () => ({ useMessageDialog: () => ({ notify: jest.fn(), dialog: null }) }));
jest.mock('@/components/on-site/ui', () => {
    const { Text, TextInput, TouchableOpacity } = require('react-native');
    return {
        OS: { text: '', muted: '', border: '', blue: '', blueSoft: '', green: '', greenSoft: '', orange: '' },
        cardShadow: {},
        NoteInput: (p: any) => <TextInput {...p} />,
        PrimaryButton: ({ label, onPress, testID }: any) => (
            <TouchableOpacity onPress={onPress} testID={testID}>
                <Text>{label}</Text>
            </TouchableOpacity>
        ),
    };
});
jest.mock('@/lib/dao/ReviewDAO', () => ({ reviewDAO: { get: jest.fn(), submit: jest.fn() } }));

const get = reviewDAO.get as jest.Mock;
const submit = reviewDAO.submit as jest.Mock;

describe('owner rating of the technician', () => {
    beforeEach(() => {
        get.mockReset();
        submit.mockReset();
    });

    it('is pending until the owner has rated, and stays done even if a later lookup still says none', async () => {
        get.mockResolvedValue(null);
        const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useOwnerReviewPending('appt-1', enabled), { initialProps: { enabled: true } });
        await waitFor(() => expect(result.current.pending).toBe(true));

        act(() => result.current.markDone());
        expect(result.current.pending).toBe(false);

        // The appointment reloads, the lookup runs again and (slow read after the write) still finds nothing.
        rerender({ enabled: false });
        rerender({ enabled: true });
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        expect(result.current.pending).toBe(false);
    });

    it('says thanks, reports the review at once and asks to go away a moment later', async () => {
        jest.useFakeTimers();
        submit.mockResolvedValue({});
        const onSent = jest.fn();
        const onDismissed = jest.fn();
        const { getByTestId, findByTestId } = render(<OwnerReviewInline appointmentId="appt-1" onSent={onSent} onDismissed={onDismissed} />);

        fireEvent.press(getByTestId('owner-review-star-5'));
        fireEvent.press(getByTestId('owner-review-submit'));

        expect(await findByTestId('owner-review-sent')).toBeTruthy();
        expect(onSent).toHaveBeenCalledTimes(1);
        expect(onDismissed).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(2300);
        });
        expect(onDismissed).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });
});
