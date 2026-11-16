jest.mock('react-native', () => ({ Alert: { alert: jest.fn() }, Linking: { openURL: jest.fn() } }));

import { directionsUrl } from '../directions';

describe('directionsUrl', () => {
    it('prefers the coordinates over the address', () => {
        expect(directionsUrl({ address: '1148 Skylark Dr, Weston, FL', lat: 26.1003, lng: -80.3997 })).toBe(
            'https://www.google.com/maps/dir/?api=1&destination=26.1003%2C-80.3997&travelmode=driving',
        );
    });

    it('accepts coordinates that arrive as strings', () => {
        expect(directionsUrl({ lat: '26.1', lng: '-80.4' })).toContain('destination=26.1%2C-80.4');
    });

    it('falls back to the address, encoded', () => {
        const url = directionsUrl({ address: '1148 Skylark Dr, Weston, FL' });
        expect(url).toContain('destination=1148%20Skylark%20Dr%2C%20Weston%2C%20FL');
    });

    it('returns null when there is nothing to navigate to', () => {
        expect(directionsUrl({})).toBeNull();
        expect(directionsUrl({ address: '   ', lat: null, lng: 'x' })).toBeNull();
    });
});
