jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { compareVins, declaredVin, extractVin, isValidVin, normalizeVin, vinCheckDigitOk } from '../vin';

const GOOD = '1HGCM82633A004352'; // valid North-American check digit

describe('vin', () => {
    it('normalises and validates', () => {
        expect(normalizeVin(' 1hgcm 8263-3a004352 ')).toBe(GOOD);
        expect(isValidVin(GOOD)).toBe(true);
        expect(isValidVin('1HGCM82633A00435')).toBe(false);
        expect(isValidVin('1HGCM82633A00435O')).toBe(false); // O is never in a VIN
    });

    it('checks the North-American check digit', () => {
        expect(vinCheckDigitOk(GOOD)).toBe(true);
        expect(vinCheckDigitOk('1HGCM82643A004352')).toBe(false);
        expect(vinCheckDigitOk('short')).toBe(false);
    });

    it('extracts a VIN from what a barcode carries', () => {
        expect(extractVin(GOOD)).toBe(GOOD);
        expect(extractVin(`I${GOOD}`)).toBe(GOOD);
        expect(extractVin(`https://example.com/v?vin=${GOOD}&x=1`)).toBe(GOOD);
        expect(extractVin('not a vin')).toBeNull();
        expect(extractVin(`${GOOD} 2HGCM82633A004352`)).toBeNull(); // two candidates: ambiguous
    });

    it('compares VINs ignoring case and spaces', () => {
        expect(compareVins(GOOD, ` ${GOOD.toLowerCase()} `)).toBe('match');
        expect(compareVins(GOOD, '2HGCM82633A004352')).toBe('differ');
        expect(compareVins(GOOD, null)).toBe('unknown');
    });

    it('derives the declared VIN from the OBD comparison', () => {
        expect(declaredVin({ obdVin: GOOD, obdVinMismatch: false, vehicleVin: null })).toBe(GOOD);
        expect(declaredVin({ obdVin: '2HGCM82633A004352', obdVinMismatch: true, vehicleVin: GOOD })).toBe(GOOD);
        expect(declaredVin({ obdVin: null, obdVinMismatch: null, vehicleVin: null })).toBeNull();
        expect(declaredVin(null)).toBeNull();
    });
});
