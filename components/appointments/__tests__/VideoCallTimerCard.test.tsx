import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { VIDEO_SESSION_SECONDS, VideoCallTimerCard, timerTone } from '../VideoCallTimerCard';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle' }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key),
    }),
}));

const K = 'appointments.videoCall.timer';

describe('timerTone', () => {
    it('is normal, then warn for the last 5 minutes, then over', () => {
        expect(VIDEO_SESSION_SECONDS).toBe(45 * 60);
        expect(timerTone(0, VIDEO_SESSION_SECONDS)).toBe('normal');
        expect(timerTone(39 * 60 + 59, VIDEO_SESSION_SECONDS)).toBe('normal');
        expect(timerTone(40 * 60, VIDEO_SESSION_SECONDS)).toBe('warn');
        expect(timerTone(45 * 60, VIDEO_SESSION_SECONDS)).toBe('over');
    });
});

describe('VideoCallTimerCard', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-18T12:00:00Z'));
    });
    afterEach(() => jest.useRealTimers());

    const startedSecondsAgo = (s: number) => Date.now() - s * 1000;

    it('counts down the time left since the other person joined', () => {
        const { getByTestId } = render(<VideoCallTimerCard startedAtMs={startedSecondsAgo(125)} />);
        expect(getByTestId('video-call-timer-elapsed').props.children).toBe('42:55');
        expect(getByTestId('video-call-timer-label').props.children).toBe(`${K}.remaining`);
    });

    it('stops at 00:00 and says time is up once the call has no time left', () => {
        const { getByTestId, getByText } = render(
            <VideoCallTimerCard startedAtMs={startedSecondsAgo(46 * 60)} limitSeconds={45 * 60} />,
        );
        expect(getByTestId('video-call-timer-elapsed').props.children).toBe('00:00');
        expect(getByTestId('video-call-timer-label').props.children).toBe(`${K}.timeUp`);
        expect(getByText(`${K}.over`)).toBeTruthy();
    });

    it('keeps the digits on one line and shrinks them to fit the ring', () => {
        const { getByTestId } = render(<VideoCallTimerCard startedAtMs={startedSecondsAgo(10)} />);
        const digits = getByTestId('video-call-timer-elapsed');
        expect(digits.props.numberOfLines).toBe(1);
        expect(digits.props.adjustsFontSizeToFit).toBe(true);
    });

    it('time the owner bought moves the limit, so the same time still has minutes left', () => {
        const { getByTestId } = render(
            <VideoCallTimerCard startedAtMs={startedSecondsAgo(46 * 60)} limitSeconds={60 * 60} addedMinutes={15} />,
        );
        expect(getByTestId('video-call-timer-elapsed').props.children).toBe('14:00');
        expect(getByTestId('video-call-timer-label').props.children).toBe(`${K}.remaining`);
        expect(getByTestId('video-call-timer-added').props.children).toBe(`${K}.added {"minutes":15}`);
    });

    it('offers "Add time" only when the screen gives it a handler (the owner)', () => {
        const onExtend = jest.fn();
        const { getByTestId } = render(<VideoCallTimerCard startedAtMs={startedSecondsAgo(10)} onExtend={onExtend} />);
        fireEvent.press(getByTestId('video-call-extend'));
        expect(onExtend).toHaveBeenCalledTimes(1);
    });

    it('shows no "Add time" to the mechanic', () => {
        const { queryByTestId } = render(<VideoCallTimerCard startedAtMs={startedSecondsAgo(10)} />);
        expect(queryByTestId('video-call-extend')).toBeNull();
    });
});
