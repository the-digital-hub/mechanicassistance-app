import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import VideoCallScreen from '@/app/(tabs)/video-call/[id]';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';

// The session timer starts when the other participant first shows up: the
// screen reports it once, however many participant updates follow, and counts
// the 30-minute session down from there.

const mockCall = {
    callState: 'joined' as string,
    remoteParticipant: null as null | { user_name: string; tracks: object },
};

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@daily-co/react-native-webrtc', () => ({ MediaStream: jest.fn() }));
jest.mock('@/components/video/CallControls', () => ({ CallControls: () => null }));
jest.mock('@/components/video/VideoTile', () => ({ VideoTile: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    useGlobalSearchParams: () => ({ id: 'appt-1', roomUrl: 'https://x.daily.co/r', token: 't', expiry: '0' }),
    useRouter: () => ({ navigate: jest.fn(), back: jest.fn(), replace: mockReplace }),
}));
jest.mock('@/lib/video/useDailyCall', () => ({
    useDailyCall: () => ({
        callState: mockCall.callState,
        localParticipant: null,
        remoteParticipant: mockCall.remoteParticipant,
        isAudioMuted: false,
        isCameraOff: false,
        errorMessage: null,
        join: jest.fn(),
        leave: jest.fn(),
        toggleAudio: jest.fn(),
        toggleCamera: jest.fn(),
        switchCamera: jest.fn(),
    }),
}));
jest.mock('@/lib/dao/VideoCallDAO', () => ({ videoCallDAO: { markStarted: jest.fn(), ownerFinish: jest.fn() } }));
jest.mock('@/components/video/ExtendCallSheet', () => ({ ExtendCallSheet: () => null }));
// The OBD report has its own tests; here the call has none.
jest.mock('@/components/video/ObdCallSheet', () => ({ ObdCallSheet: () => null }));
jest.mock('@/components/video/CallTimeAddedToast', () => ({ CallTimeAddedToast: () => null }));
jest.mock('@/components/video/RequestObdPanel', () => ({ useRequestObd: () => ({ report: null }) }));
// The server says how long the call has: 45 minutes, plus `mockAdded` the owner bought.
let mockRole = 'user';
let mockAdded = 0;
jest.mock('@/context/UserContext', () => ({ useUser: () => ({ user: { role: mockRole } }) }));
jest.mock('@/hooks/useVideoCallState', () => ({
    useVideoCallState: () => ({
        state: { baseMinutes: 45, contractedMinutes: 45 + mockAdded, roomExpiryUnixSec: null },
        reload: jest.fn(),
    }),
}));

const markStarted = videoCallDAO.markStarted as jest.Mock;

describe('VideoCallScreen session start', () => {
    beforeEach(() => {
        markStarted.mockReset();
        mockRole = 'user';
        mockAdded = 0;
        mockCall.callState = 'joined';
        mockCall.remoteParticipant = null;
    });

    it('does not report a start while alone in the room, and shows a full session', () => {
        const { getByTestId } = render(<VideoCallScreen />);
        expect(markStarted).not.toHaveBeenCalled();
        expect(getByTestId('call-remaining').props.children).toBe('45:00');
        expect(getByTestId('call-status').props.children).toBe('appointments.videoCall.live.live');
    });

    it('reports it once when the other participant joins, then shows the elapsed time', async () => {
        markStarted.mockResolvedValue({ startedAtLocalMs: Date.now() - 65_000 });
        const { rerender, findByTestId } = render(<VideoCallScreen />);

        mockCall.remoteParticipant = { user_name: 'Client', tracks: {} };
        rerender(<VideoCallScreen />);
        mockCall.remoteParticipant = { user_name: 'Client', tracks: { video: {} } };
        rerender(<VideoCallScreen />);

        await waitFor(() => expect(markStarted).toHaveBeenCalledTimes(1));
        expect(markStarted).toHaveBeenCalledWith('appt-1');
        await waitFor(async () => expect((await findByTestId('call-remaining')).props.children).toBe('43:55'));
    });

    it('stops at 00:00 and says time is up once the session is spent', async () => {
        markStarted.mockResolvedValue({ startedAtLocalMs: Date.now() - 46 * 60_000 });
        mockCall.remoteParticipant = { user_name: 'Client', tracks: {} };

        const { findByTestId, getByTestId } = render(<VideoCallScreen />);
        await waitFor(async () => expect((await findByTestId('call-remaining')).props.children).toBe('00:00'));
        expect(getByTestId('call-status').props.children).toBe('appointments.videoCall.live.timeUp');
    });

    it('still counts locally if the server cannot be reached', async () => {
        markStarted.mockRejectedValue(new Error('offline'));
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        mockCall.remoteParticipant = { user_name: 'Client', tracks: {} };

        const { findByTestId } = render(<VideoCallScreen />);
        await waitFor(() => expect(markStarted).toHaveBeenCalledTimes(1));
        expect((await findByTestId('call-remaining')).props.children).toBe('45:00');
        warn.mockRestore();
    });

    it('counts down from the time the owner bought', async () => {
        mockAdded = 15;
        markStarted.mockResolvedValue({ startedAtLocalMs: Date.now() - 50 * 60_000 });
        mockCall.remoteParticipant = { user_name: 'Client', tracks: {} };

        const { findByTestId } = render(<VideoCallScreen />);
        await waitFor(async () => expect((await findByTestId('call-remaining')).props.children).toBe('10:00'));
    });

    it('offers "Add time" to the owner only', () => {
        const owner = render(<VideoCallScreen />);
        expect(owner.queryByTestId('call-add-time')).not.toBeNull();
        owner.unmount();

        mockRole = 'mechanic';
        const mechanic = render(<VideoCallScreen />);
        expect(mechanic.queryByTestId('call-add-time')).toBeNull();
    });

    it('offers "Finish video call" to the owner only', () => {
        const owner = render(<VideoCallScreen />);
        expect(owner.queryByTestId('call-owner-finish')).not.toBeNull();
        owner.unmount();

        mockRole = 'mechanic';
        const mechanic = render(<VideoCallScreen />);
        expect(mechanic.queryByTestId('call-owner-finish')).toBeNull();
    });

    it('finishes and confirms after the owner agrees, then opens the review', async () => {
        const ownerFinish = videoCallDAO.ownerFinish as jest.Mock;
        ownerFinish.mockResolvedValue({});
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

        const { getByTestId } = render(<VideoCallScreen />);
        fireEvent.press(getByTestId('call-owner-finish'));
        expect(ownerFinish).not.toHaveBeenCalled();

        const buttons = alert.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
        await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/appointments/review/[id]', params: { id: 'appt-1' } }));
        expect(ownerFinish).toHaveBeenCalledWith('appt-1');
        alert.mockRestore();
    });
});
