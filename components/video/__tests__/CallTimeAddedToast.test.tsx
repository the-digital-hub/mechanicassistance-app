import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { NOTICE_MS } from '@/hooks/useCallTimeAddedNotice';

import { CallTimeAddedToast } from '../CallTimeAddedToast';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key) }),
}));
let mockLastMessage: unknown = null;
jest.mock('@/context/SocketContext', () => ({ useSocket: () => ({ lastMessage: mockLastMessage }) }));

const K = 'videoCall.extend';

const extended = (over: Record<string, unknown> = {}) => ({
    type: 'video_call_update',
    payload: { appointmentId: 'appt-1', stage: 'extended', minutes: '15', at: '2026-10-24T20:40:00.000Z', role: 'mechanic', ...over },
});

/** Renders the toast, then delivers `message` as the socket's latest event. */
function deliver(message: unknown) {
    mockLastMessage = null;
    const utils = render(<CallTimeAddedToast appointmentId="appt-1" />);
    mockLastMessage = message;
    utils.rerender(<CallTimeAddedToast appointmentId="appt-1" />);
    return utils;
}

describe('CallTimeAddedToast', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('tells the mechanic the client added time', () => {
        const { getByTestId } = deliver(extended());
        expect(getByTestId('call-time-added-text').props.children).toBe(`${K}.addedByOwner {"minutes":15}`);
    });

    it('confirms it to the owner who bought it', () => {
        const { getByTestId } = deliver(extended({ role: 'owner', minutes: '30' }));
        expect(getByTestId('call-time-added-text').props.children).toBe(`${K}.addedBySelf {"minutes":30}`);
    });

    it('ignores another call and other stages', () => {
        expect(deliver(extended({ appointmentId: 'appt-2' })).queryByTestId('call-time-added-toast')).toBeNull();
        expect(deliver(extended({ stage: 'finished' })).queryByTestId('call-time-added-toast')).toBeNull();
        expect(deliver({ type: 'appointment_update', payload: { id: 'appt-1' } }).queryByTestId('call-time-added-toast')).toBeNull();
    });

    it('goes away by itself', () => {
        const { queryByTestId } = deliver(extended());
        expect(queryByTestId('call-time-added-toast')).not.toBeNull();
        act(() => {
            jest.advanceTimersByTime(NOTICE_MS);
        });
        // Then the fade-out.
        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(queryByTestId('call-time-added-toast')).toBeNull();
    });

    it('closes when tapped', () => {
        const { getByTestId, queryByTestId } = deliver(extended());
        fireEvent.press(getByTestId('call-time-added-toast'));
        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(queryByTestId('call-time-added-toast')).toBeNull();
    });

    it('shows the same event once', () => {
        const message = extended();
        const { queryByTestId, rerender } = deliver(message);
        act(() => {
            jest.advanceTimersByTime(NOTICE_MS);
        });
        // Then the fade-out.
        act(() => {
            jest.advanceTimersByTime(500);
        });
        mockLastMessage = { ...message };
        rerender(<CallTimeAddedToast appointmentId="appt-1" />);
        expect(queryByTestId('call-time-added-toast')).toBeNull();
    });
});
