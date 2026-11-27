jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.1' } } }));
jest.mock('@/lib/dao/LegalDAO', () => ({ legalDAO: { policies: jest.fn(), accept: jest.fn() } }));

import { legalDAO } from '@/lib/dao/LegalDAO';

import { acceptPendingPolicies } from '../acceptPending';
import { normalizePolicies } from '../policies';

const policies = legalDAO.policies as jest.Mock;
const accept = legalDAO.accept as jest.Mock;

const answer = normalizePolicies({
    policies: [
        { id: 'o', kind: 'privacy', version: '3', roles: ['user'], accepted: false },
        { id: 'm', kind: 'privacy', version: '2', roles: ['mechanic'], accepted: false },
        { id: 'all', kind: 'terms', version: '1', roles: [], accepted: false },
        { id: 'done', kind: 'cookies', version: '1', accepted: true },
    ],
    pending: ['o', 'm', 'all'],
    hasPending: true,
}, 'en');

describe('acceptPendingPolicies', () => {
    beforeEach(() => {
        policies.mockReset();
        accept.mockReset();
        accept.mockResolvedValue({});
    });

    it('records the pending versions of the role the person signed up as, with the app version', async () => {
        policies.mockResolvedValue(answer);
        expect(await acceptPendingPolicies('mechanic')).toBe(2);
        expect(accept.mock.calls).toEqual([['m', '1.0.1'], ['all', '1.0.1']]);
    });

    it('leaves out the versions of the other role', async () => {
        policies.mockResolvedValue(answer);
        await acceptPendingPolicies('user');
        expect(accept.mock.calls.map((c) => c[0])).toEqual(['o', 'all']);
    });

    it('does not stop at a version the server refuses (409 or 404): the others are still recorded', async () => {
        policies.mockResolvedValue(answer);
        accept.mockRejectedValueOnce(new Error('policy_superseded')).mockResolvedValue({});
        expect(await acceptPendingPolicies('user')).toBe(1);
        expect(accept).toHaveBeenCalledTimes(2);
    });

    it('never throws when the policies cannot be read', async () => {
        policies.mockRejectedValue(new Error('offline'));
        await expect(acceptPendingPolicies('user')).resolves.toBe(0);
        expect(accept).not.toHaveBeenCalled();
    });
});
