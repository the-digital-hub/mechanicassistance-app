import { ApiError } from '@/lib/api/types';

import { DELETION_BLOCK_CODES, deletionBlocks, isDeletionUnavailable } from '../deletion';

describe('deletionBlocks', () => {
    it('reads the reasons of a 409 from error.details.reasons', () => {
        const error = new ApiError(409, 'Account deletion is blocked', {
            code: 'ACCOUNT_DELETION_BLOCKED',
            details: { reasons: [{ code: 'open_job', message: 'You have a job open' }, { code: 'wallet_balance', message: 'Money in the wallet' }] },
        });
        expect(deletionBlocks(error)).toEqual([
            { code: 'open_job', message: 'You have a job open' },
            { code: 'wallet_balance', message: 'Money in the wallet' },
        ]);
    });

    it('also reads reasons that come at the top of the payload, and drops what is not a reason', () => {
        const error = new ApiError(409, 'blocked', { reasons: [{ code: 'debt' }, { message: 'no code' }, 'x'] });
        expect(deletionBlocks(error)).toEqual([{ code: 'debt', message: undefined }]);
    });

    it('is empty for anything that is not a 409 with reasons', () => {
        expect(deletionBlocks(new ApiError(503, 'unavailable', 'x'))).toEqual([]);
        expect(deletionBlocks(new ApiError(409, 'blocked', 'plain text'))).toEqual([]);
        expect(deletionBlocks(new Error('network'))).toEqual([]);
    });
});

describe('isDeletionUnavailable', () => {
    it('is true only for a 503 from the API', () => {
        expect(isDeletionUnavailable(new ApiError(503, 'x', null))).toBe(true);
        expect(isDeletionUnavailable(new ApiError(409, 'x', null))).toBe(false);
        expect(isDeletionUnavailable(new Error('x'))).toBe(false);
    });
});

describe('DELETION_BLOCK_CODES', () => {
    it('lists the ten reasons the server can give', () => {
        expect(DELETION_BLOCK_CODES).toHaveLength(10);
    });
});
