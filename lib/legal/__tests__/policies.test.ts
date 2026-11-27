import { localizedText, normalizePolicies, policyBlocks } from '../policies';

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
