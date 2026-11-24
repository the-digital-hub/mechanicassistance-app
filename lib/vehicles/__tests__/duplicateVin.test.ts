import { hasVin } from '../duplicateVin';

const list = [
    { id: 'a', vin: '1HGCM82633A004352' },
    { id: 'b', vin: '5YJSA1E26MF123456' },
    { id: 'c', vin: null },
];

describe('hasVin', () => {
    it('finds a VIN that is already in the list', () => {
        expect(hasVin(list, '1HGCM82633A004352')).toBe(true);
    });

    it('compares it the way it is written: any case, spaces or dashes', () => {
        expect(hasVin(list, '1hgcm82633a004352')).toBe(true);
        expect(hasVin(list, '1HGCM 82633 A004352')).toBe(true);
        expect(hasVin(list, '1HGCM-82633-A004352')).toBe(true);
    });

    it('lets a new VIN through, and a vehicle without one never matches', () => {
        expect(hasVin(list, 'WVWZZZ1JZXW000001')).toBe(false);
        expect(hasVin(list, '')).toBe(false);
        expect(hasVin([{ id: 'x', vin: null }], 'WVWZZZ1JZXW000001')).toBe(false);
    });

    it('does not count the vehicle being edited against itself', () => {
        expect(hasVin(list, '1HGCM82633A004352', 'a')).toBe(false);
        expect(hasVin(list, '5YJSA1E26MF123456', 'a')).toBe(true);
    });

    it('works with the vehicles kept on the device during sign-up (no server id)', () => {
        expect(hasVin([{ vin: '1HGCM82633A004352' }], '1HGCM82633A004352')).toBe(true);
    });
});
