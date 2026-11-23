import { isRemoteAddress, localizedAddress } from '../remoteAddress';

const t = (key: string) => (key === 'appointments.videoCall.remoteHint' ? 'Remote assistance by video call' : key);

describe('localizedAddress', () => {
    it('says the video-call line in the language of the app', () => {
        expect(localizedAddress('Asesoría Remota por Videollamada', t)).toBe('Remote assistance by video call');
        expect(localizedAddress('  asesoria remota por videollamada', t)).toBe('Remote assistance by video call');
    });

    it('leaves a real address, and nothing, untouched', () => {
        expect(localizedAddress('3539 NW 82nd Ter, Pembroke Pines, FL, 33024', t)).toBe('3539 NW 82nd Ter, Pembroke Pines, FL, 33024');
        expect(localizedAddress(undefined, t)).toBeUndefined();
        expect(isRemoteAddress('')).toBe(false);
    });
});
