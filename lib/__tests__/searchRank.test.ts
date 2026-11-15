import { rankOptions } from '../searchRank';

const labels = (items: { label: string }[]) => items.map((i) => i.label);
const opts = (...names: string[]) => names.map((label) => ({ label }));

describe('rankOptions', () => {
    const makes = opts('Ford', 'Revology', 'Volvo', 'Chevrolet', 'Volkswagen', 'Land Rover', 'Toyota');

    it('lists names starting with the typed letter first, alphabetically', () => {
        // Volkswagen and Volvo lead; the rest only contain a "v".
        expect(labels(rankOptions(makes, 'v'))).toEqual(['Volkswagen', 'Volvo', 'Chevrolet', 'Land Rover', 'Revology']);
    });

    it('puts a word start before a plain contains', () => {
        // "Land Rover" has a word starting with "r"; Chevrolet and Ford only contain one; Toyota has none.
        expect(labels(rankOptions(makes, 'r'))).toEqual(['Revology', 'Land Rover', 'Chevrolet', 'Ford']);
    });

    it('ignores case and accents and drops non-matches', () => {
        expect(labels(rankOptions(opts('Citroën', 'Cadillac'), 'CIT'))).toEqual(['Citroën']);
    });

    it('keeps the original order for an empty query', () => {
        expect(rankOptions(makes, '  ')).toBe(makes);
    });
});
