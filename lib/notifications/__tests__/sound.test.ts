import AsyncStorage from '@react-native-async-storage/async-storage';

const mockPlay = jest.fn();
const mockSeekTo = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-audio', () => ({
    createAudioPlayer: jest.fn(() => ({ play: mockPlay, seekTo: mockSeekTo })),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/assets/sounds/bell.wav', () => 1, { virtual: true });

import { __resetSound, ringIfEnabled, setSoundEnabled } from '../sound';

describe('sound setting', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetSound();
    });

    it('rings for an alert by default (Sound starts on)', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        await ringIfEnabled();
        expect(mockPlay).toHaveBeenCalledTimes(1);
        expect(mockSeekTo).toHaveBeenCalledWith(0);
    });

    it('stays quiet once turned off, and remembers it', async () => {
        await setSoundEnabled(false);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('settings:notifySound', '0');
        await ringIfEnabled();
        expect(mockPlay).not.toHaveBeenCalled();
    });

    it('rings once when turned on, so the person hears the choice', async () => {
        await setSoundEnabled(true);
        expect(mockPlay).toHaveBeenCalledTimes(1);
    });

    it('reads a saved "off" on the next launch', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('0');
        await ringIfEnabled();
        expect(mockPlay).not.toHaveBeenCalled();
    });

    it('plays even when setting the audio mode fails, and asks to ring with the phone on silent', async () => {
        const audio = jest.requireMock('expo-audio') as { setAudioModeAsync: jest.Mock };
        audio.setAudioModeAsync.mockRejectedValueOnce(new Error('no session'));
        await setSoundEnabled(true);
        expect(audio.setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentMode: true }));
        expect(mockPlay).toHaveBeenCalledTimes(1);
    });
});
