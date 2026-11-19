import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { JoinCallSheet } from '../JoinCallSheet';

const mockJoin: Record<string, unknown> = {};
jest.mock('@/hooks/useVideoCallJoin', () => ({ useVideoCallJoin: () => mockJoin }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/video/LiveRadar', () => ({ LiveRadar: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/appointments/VideoCallTimerCard', () => ({ VideoCallTimerCard: () => null }));

function setup(over: Record<string, unknown> = {}) {
    Object.assign(mockJoin, {
        appointment: { car: 'AUDI Q7' },
        callState: null,
        isUserRole: true,
        otherPartyName: 'Alex Mech',
        roomUrl: null,
        checkingRoom: false,
        connecting: false,
        accepted: false,
        acceptedAt: null,
        setAccepted: jest.fn(),
        minutes: 30,
        rejoin: false,
        canConnect: false,
        connect: jest.fn(),
    }, over);
    return render(<JoinCallSheet visible appointmentId="a1" onClose={jest.fn()} onEnter={jest.fn()} />);
}

describe('the sheet that opens from "Join video call"', () => {
    it('shows the conditions and the vehicle, and keeps Connect off until they are accepted', () => {
        const tree = setup();
        expect(tree.getByTestId('lobby-consent')).toBeTruthy();
        expect(tree.getByText('AUDI Q7')).toBeTruthy();
        const connect = tree.getByTestId('join-call-connect');
        expect(connect.props.accessibilityState?.disabled ?? connect.props.disabled).toBeTruthy();
    });

    it('asks to accept with the checkbox, and Connect runs once it is on', () => {
        const connect = jest.fn();
        const tree = setup({ accepted: true, canConnect: true, connect });
        fireEvent.press(tree.getByTestId('join-call-connect'));
        expect(connect).toHaveBeenCalledTimes(1);
        fireEvent.press(tree.getByTestId('lobby-consent-check'));
        expect((mockJoin.setAccepted as jest.Mock)).toHaveBeenCalled();
    });

    it('says it is waiting for the room when the technician has none yet', () => {
        const tree = setup({ isUserRole: false, roomUrl: null });
        expect(tree.getByText('videoCall.lobby.waiting')).toBeTruthy();
    });
});
