import { addDismissed, attentionKey, MAX_DISMISSED, visibleAttention } from '../attention';

describe('attention dismissal', () => {
    const items = [
        { id: 'payouts' },
        { id: 'notifications', signature: 'notifications:3' },
    ];

    it('shows everything when nothing was hidden', () => {
        expect(visibleAttention(items, new Set())).toHaveLength(2);
    });

    it('keeps a hidden alert hidden', () => {
        expect(visibleAttention(items, new Set(['payouts'])).map((i) => i.id)).toEqual(['notifications']);
    });

    it('brings an alert back when its signature changes', () => {
        const hidden = new Set(['notifications:3']);
        expect(visibleAttention(items, hidden).map((i) => i.id)).toEqual(['payouts']);
        const grown = [{ id: 'notifications', signature: 'notifications:4' }];
        expect(visibleAttention(grown, hidden)).toHaveLength(1);
    });

    it('uses the id when there is no signature', () => {
        expect(attentionKey({ id: 'x' })).toBe('x');
    });

    it('does not duplicate and caps the stored list', () => {
        expect(addDismissed(['a'], 'a')).toEqual(['a']);
        const many = Array.from({ length: MAX_DISMISSED }, (_, i) => `k${i}`);
        const next = addDismissed(many, 'new');
        expect(next).toHaveLength(MAX_DISMISSED);
        expect(next[next.length - 1]).toBe('new');
        expect(next[0]).toBe('k1');
    });
});
