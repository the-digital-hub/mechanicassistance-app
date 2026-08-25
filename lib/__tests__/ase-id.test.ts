import { formatAseId, isCompleteAseId, toAseIdRaw } from '@/lib/ase-id';

describe('toAseIdRaw', () => {
    it('keeps only digits', () => {
        expect(toAseIdRaw('12ab34cd')).toBe('1234');
    });

    it('strips the separators the mask adds', () => {
        expect(toAseIdRaw('ASE-1234-5678')).toBe('12345678');
    });

    it('strips the prefix when typed by hand, mid-entry', () => {
        // The field already shows "ASE-", so a user who types it too must not
        // end up with a doubled prefix.
        expect(toAseIdRaw('ASE-12')).toBe('12');
    });

    it('caps at 8 digits', () => {
        expect(toAseIdRaw('1234567890')).toBe('12345678');
    });

    it('returns empty when there are no digits', () => {
        expect(toAseIdRaw('ASE-')).toBe('');
        expect(toAseIdRaw('')).toBe('');
    });
});

describe('formatAseId', () => {
    it('shows the fixed prefix on an empty field', () => {
        expect(formatAseId('')).toBe('ASE-');
    });

    it('appends digits after the prefix', () => {
        expect(formatAseId('1')).toBe('ASE-1');
        expect(formatAseId('1234')).toBe('ASE-1234');
    });

    it('holds the second dash back until the fifth digit', () => {
        expect(formatAseId('12345')).toBe('ASE-1234-5');
    });

    it('renders a complete id', () => {
        expect(formatAseId('12345678')).toBe('ASE-1234-5678');
    });

    it('round-trips with toAseIdRaw', () => {
        expect(formatAseId(toAseIdRaw('ASE-0000-0001'))).toBe('ASE-0000-0001');
    });

    it('matches the stored aseid format', () => {
        // ase_mechanics.aseid is ASE-9999-9999 for every row, so the formatted
        // value is what the exact-match lookup needs.
        expect(formatAseId('12345678')).toMatch(/^ASE-\d{4}-\d{4}$/);
    });
});

describe('isCompleteAseId', () => {
    it('is true only at full length', () => {
        expect(isCompleteAseId('12345678')).toBe(true);
        expect(isCompleteAseId('1234567')).toBe(false);
        expect(isCompleteAseId('')).toBe(false);
    });
});
