import { pinchZoom, startZoom } from '../cameraZoom';

describe('cameraZoom', () => {
    it('starts on the main lens of a camera that switches lenses', () => {
        // a factor of 2 out of a limit of 16: 2 = 16 ** 0.25
        expect(startZoom({ max: 16, wideAt: 2 })).toBeCloseTo(0.25, 5);
    });

    it('starts at 0 when there is nothing to switch', () => {
        expect(startZoom(null)).toBe(0);
        expect(startZoom({ max: 16, wideAt: 1 })).toBe(0);
    });

    it('doubles the factor when the fingers double their distance', () => {
        const limit = 16;
        const z = pinchZoom(0.25, 2, limit); // from 2x to 4x
        expect(limit ** z).toBeCloseTo(4, 5);
    });

    it('halves it when they close, and never leaves 0 to 1', () => {
        expect(16 ** pinchZoom(0.5, 0.5, 16)).toBeCloseTo(2, 5);
        expect(pinchZoom(0.1, 0.01, 16)).toBe(0);
        expect(pinchZoom(0.9, 100, 16)).toBe(1);
    });

    it('ignores a pinch with no distance', () => {
        expect(pinchZoom(0.3, 0, 16)).toBe(0.3);
    });
});
