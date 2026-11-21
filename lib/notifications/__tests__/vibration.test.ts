import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';

import { __resetVibration, setVibrateEnabled, vibrateIfEnabled } from '../vibration';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn().mockResolvedValue(undefined) },
}));

describe('vibration setting', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetVibration();
        jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    });

    it('does not buzz while Vibrate is off (the default)', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        await vibrateIfEnabled();
        expect(Vibration.vibrate).not.toHaveBeenCalled();
    });

    it('buzzes for an alert once Vibrate is on, and remembers the choice', async () => {
        await setVibrateEnabled(true);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('settings:notifyVibrate', '1');
        (Vibration.vibrate as jest.Mock).mockClear(); // the preview buzz of turning it on
        await vibrateIfEnabled();
        expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
    });

    it('reads what was saved on a previous launch', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
        await vibrateIfEnabled();
        expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
    });

    it('stops buzzing when it is turned off again', async () => {
        await setVibrateEnabled(true);
        await setVibrateEnabled(false);
        (Vibration.vibrate as jest.Mock).mockClear();
        await vibrateIfEnabled();
        expect(Vibration.vibrate).not.toHaveBeenCalled();
    });
});
