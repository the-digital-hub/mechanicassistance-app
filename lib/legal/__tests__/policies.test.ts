import { appliesToRole, hasReachedEnd, localizedText, normalizePolicies, policiesForRole, policyBlocks } from '../policies';

describe('localizedText', () => {
    it('takes plain text as it is and picks the shown language of a pair', () => {
        expect(localizedText('Hello', 'es')).toBe('Hello');
        expect(localizedText({ es: 'Hola', en: 'Hello' }, 'es-AR')).toBe('Hola');
        expect(localizedText({ es: 'Hola', en: 'Hello' }, 'en')).toBe('Hello');
    });
    it('falls back to the other language, then to empty', () => {
        expect(localizedText({ es: 'Hola' }, 'en')).toBe('Hola');
        expect(localizedText(null, 'en')).toBe('');
    });
});

describe('normalizePolicies', () => {
    it('reads the versions, which are pending and whether something is', () => {
        const res = normalizePolicies({
            policies: [
                { id: 'p1', kind: 'privacy', version: '2', title: { es: 'Privacidad', en: 'Privacy' }, accepted: false, requiresAcceptance: true },
                { id: 't1', kind: 'terms', version: '1', title: 'Terms', accepted: true, acceptedAt: '2026-11-01T10:00:00Z' },
            ],
            pending: ['p1'],
            hasPending: true,
        }, 'en');
        expect(res.policies.map((p) => p.title)).toEqual(['Privacy', 'Terms']);
        expect(res.pending.map((p) => p.id)).toEqual(['p1']);
        expect(res.hasPending).toBe(true);
        expect(res.policies[1]).toMatchObject({ accepted: true, acceptedAt: '2026-11-01T10:00:00Z' });
    });
    it('accepts pending as objects, and works out pending itself when the server sends none', () => {
        const withObjects = normalizePolicies({ policies: [{ id: 'a', version: '1' }], pending: [{ id: 'a' }] }, 'es');
        expect(withObjects.pending.map((p) => p.id)).toEqual(['a']);
        const none = normalizePolicies({ policies: [{ id: 'a', version: '1', accepted: false }, { id: 'b', version: '1', accepted: true }] }, 'es');
        expect(none.pending.map((p) => p.id)).toEqual(['a']);
        expect(none.hasPending).toBe(true);
    });
    it('an informative version (no acceptance needed) is never pending', () => {
        const res = normalizePolicies({ policies: [{ id: 'n', version: '3', requiresAcceptance: false, accepted: false }] }, 'es');
        expect(res.pending).toEqual([]);
        expect(res.hasPending).toBe(false);
    });
    it('survives an empty or odd answer', () => {
        expect(normalizePolicies(null, 'es')).toEqual({ policies: [], pending: [], hasPending: false });
        expect(normalizePolicies([{ nope: 1 }], 'es').policies).toEqual([]);
    });
});

describe('policyBlocks', () => {
    it('splits headings, bullets and paragraphs', () => {
        expect(policyBlocks('# Title\n\nFirst line\nsecond line\n\n- one\n- two')).toEqual([
            { kind: 'heading', text: 'Title' },
            { kind: 'paragraph', text: 'First line second line' },
            { kind: 'bullet', text: 'one' },
            { kind: 'bullet', text: 'two' },
        ]);
    });
});

// Policies can be aimed at roles (backend 26-nov): the server answers with the versions of all the roles of the account.
describe('policies aimed at roles', () => {
    const answer = normalizePolicies({
        policies: [
            { id: 'o', kind: 'privacy', version: '3', roles: ['user'], accepted: false },
            { id: 'm', kind: 'privacy', version: '2', roles: ['mechanic'], accepted: false },
            { id: 'all', kind: 'terms', version: '1', roles: [], accepted: true },
            { id: 'legacy', kind: 'cookies', version: '1', accepted: true },
        ],
        pending: ['o', 'm'],
        hasPending: true,
    }, 'en');

    it('reads the roles of a version, and none means every role', () => {
        expect(answer.policies.map((p) => p.roles)).toEqual([['user'], ['mechanic'], [], []]);
        expect(appliesToRole(answer.policies[2], 'mechanic')).toBe(true);
        expect(appliesToRole(answer.policies[0], 'mechanic')).toBe(false);
        expect(appliesToRole(answer.policies[0], undefined)).toBe(true);
    });

    it('shows a person with both roles the versions of the role in use, and what is pending for it', () => {
        const owner = policiesForRole(answer, 'user');
        expect(owner.policies.map((p) => p.id)).toEqual(['o', 'all', 'legacy']);
        expect(owner.pending.map((p) => p.id)).toEqual(['o']);
        const technician = policiesForRole(answer, 'mechanic');
        expect(technician.policies.map((p) => p.id)).toEqual(['m', 'all', 'legacy']);
        expect(technician.pending.map((p) => p.id)).toEqual(['m']);
    });

    it('nothing is pending for a role whose versions are accepted, even if the other role has one', () => {
        const res = normalizePolicies({
            policies: [{ id: 'o', roles: ['user'], accepted: true }, { id: 'm', roles: ['mechanic'], accepted: false }],
            pending: ['m'],
            hasPending: true,
        }, 'en');
        expect(policiesForRole(res, 'user').hasPending).toBe(false);
        expect(policiesForRole(res, 'mechanic').hasPending).toBe(true);
    });
});

describe('hasReachedEnd', () => {
    it('is false while there is text left to read', () => {
        expect(hasReachedEnd(600, 2400, 0)).toBe(false);
        expect(hasReachedEnd(600, 2400, 1700)).toBe(false);
    });
    it('is true at the bottom, with a little slack', () => {
        expect(hasReachedEnd(600, 2400, 1800)).toBe(true);
        expect(hasReachedEnd(600, 2400, 1780)).toBe(true);
    });
    it('is true when the text fits without scrolling, and false before the view is measured', () => {
        expect(hasReachedEnd(800, 500, 0)).toBe(true);
        expect(hasReachedEnd(0, 0, 0)).toBe(false);
        expect(hasReachedEnd(800, 0, 0)).toBe(false);
    });
});
