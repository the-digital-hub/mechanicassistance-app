import { refLabel } from '../refCode';

describe('refLabel', () => {
    it('shows the short reference when the server sent one', () => {
        expect(refLabel('AS-4H8TX2', 'c3d4e5f6-a7b8-4012-8def-123456789012')).toBe('AS-4H8TX2');
    });

    it('falls back to the start of the id for rows that have none yet', () => {
        expect(refLabel(undefined, 'c3d4e5f6-a7b8-4012-8def-123456789012')).toBe('#c3d4e5f6');
        expect(refLabel(null, 'c3d4e5f6-a7b8-4012-8def-123456789012')).toBe('#c3d4e5f6');
        expect(refLabel('', 'c3d4e5f6-a7b8-4012-8def-123456789012')).toBe('#c3d4e5f6');
    });
});
