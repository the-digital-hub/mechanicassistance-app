jest.mock('@/lib/dao/VideoCallDAO', () => ({ videoCallDAO: { translate: jest.fn() } }));

import { ApiError } from '@/lib/api/types';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { __resetTranslateCaption, translateCaption } from '../translateCaption';

const translate = videoCallDAO.translate as jest.Mock;
const line = { id: 'l1', text: 'Hello', from: 'en', to: 'es' };
const fail = (status: number) => new ApiError(status, 'x', null);

beforeEach(() => {
    translate.mockReset();
    __resetTranslateCaption();
});

describe('translateCaption', () => {
    it('returns the translated text of the line', async () => {
        translate.mockResolvedValue({ lines: [{ id: 'l1', text: ' Hola ' }] });
        expect(await translateCaption('a1', line)).toEqual({ text: 'Hola' });
        expect(translate).toHaveBeenCalledWith('a1', { from: 'en', to: 'es', lines: [{ id: 'l1', text: 'Hello' }] });
    });

    it('reports a missing consent without throwing', async () => {
        translate.mockRejectedValue(fail(409));
        expect(await translateCaption('a1', line)).toEqual({ skipped: 'consent_required' });
    });

    it('stops asking once the endpoint does not exist', async () => {
        translate.mockRejectedValue(fail(404));
        expect(await translateCaption('a1', line)).toEqual({ skipped: 'unavailable' });
        expect(await translateCaption('a1', line)).toEqual({ skipped: 'unavailable' });
        expect(translate).toHaveBeenCalledTimes(1);
    });

    it('reports the rate limit and any other failure as skipped', async () => {
        translate.mockRejectedValueOnce(fail(429));
        expect(await translateCaption('a1', line)).toEqual({ skipped: 'busy' });
        translate.mockRejectedValueOnce(new Error('offline'));
        expect(await translateCaption('a1', line)).toEqual({ skipped: 'unavailable' });
    });
});
