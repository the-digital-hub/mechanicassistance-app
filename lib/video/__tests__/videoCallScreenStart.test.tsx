import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import VideoCallScreen from '@/app/(tabs)/video-call/[id]';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';

// The session timer starts when the other participant first shows up: the
// screen reports it once, however many participant updates follow.

const mockCall = {
    callState: 'joined' as string,
    remoteParticipant: null as null | { user_name: string; tracks: object },
};

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@daily-co/react-native-webrtc', () => ({ MediaStream: jest.fn() }));
jest.mock('@/components/video/CallControls', () => ({ CallControls: () => null }));
jest.mock('@/components/video/VideoTile', () => ({ VideoTile: () => null }));
jest.mock('expo-router', () => ({
    useGlobalSearchParams: () => ({ id: 'appt-1', roomUrl: 'https://x.daily.co/r', token: 't', expiry: '0' }),
    useRouter: () => ({ navigate: jest.fn(), back: jest.fn() }),
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
jest.mock('@/lib/dao/VideoCallDAO', () => ({ videoCallDAO: { markStarted: jest.fn() } }));

const markStarted = videoCallDAO.markStarted as jest.Mock;

describe('VideoCallScreen session start', () => {
    beforeEach(() => {
        markStarted.mockReset();
        mockCall.callState = 'joined';
        mockCall.remoteParticipant = null;
    });

    it('does not report a start while alone in the room', () => {
        const { queryByTestId } = render(<VideoCallScreen />);
        expect(markStarted).not.toHaveBeenCalled();
        expect(queryByTestId('call-elapsed')).toBeNull();
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
        expect((await findByTestId('call-elapsed')).props.children).toBe('01:05');
    });

    it('still counts locally if the server cannot be reached', async () => {
        markStarted.mockRejectedValue(new Error('offline'));
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        mockCall.remoteParticipant = { user_name: 'Client', tracks: {} };

        const { findByTestId } = render(<VideoCallScreen />);
        expect((await findByTestId('call-elapsed')).props.children).toBe('00:00');
        warn.mockRestore();
    });
});
