jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { compareVins, declaredVin, extractVin, extractVinFromText, isValidVin, normalizeVin, vinCheckDigitOk } from '../vin';

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

describe('extractVinFromText', () => {
    const DOOR = 'WA1LJAF70LD007333'; // read from a real door label and windshield

    it('takes the VIN out of the lines of a label photo', () => {
        const lines = ['MFD. BY AUDI AG 03 20', 'GVWR LBS 6393, KG 2900', DOOR, 'SLOVAKIA'];
        expect(extractVinFromText(lines)).toBe(DOOR);
    });

    it('reads a VIN with spaces, a prefix or lower case', () => {
        expect(extractVinFromText(['vin: wa1ljaf7 0ld007333'])).toBe(DOOR);
    });

    it('fixes the look-alikes: a VIN has no O, I or Q', () => {
        // the zeros read as O and the 1 as I
        expect(extractVinFromText(['WAILJAF7OLDOO7333'])).toBe(DOOR);
    });

    it('does not turn a real L into a 1', () => {
        expect(extractVinFromText([DOOR])).toBe(DOOR);
    });

    it('prefers the reading whose check digit holds', () => {
        expect(extractVinFromText(['1HGCM82633A004352', '1HGCM82633A004353'])).toBe('1HGCM82633A004352');
    });

    it('is null when there is no VIN or too many candidates', () => {
        expect(extractVinFromText(['GVWR LBS 6393', 'SLOVAKIA'])).toBeNull();
        expect(extractVinFromText([])).toBeNull();
    });
});
