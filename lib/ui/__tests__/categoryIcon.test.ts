import { CarFront, CircleDot, Cog, Fuel, KeyRound, Snowflake, Wrench, Zap } from 'lucide-react-native';

import { categoryIcon } from '../categoryIcon';

describe('categoryIcon', () => {
    it('picks the icon from the category name', () => {
        expect(categoryIcon({ name: 'Starting & electrical' })).toBe(Zap);
        expect(categoryIcon({ name: 'Tires & wheels' })).toBe(CircleDot);
        expect(categoryIcon({ name: 'Engine & Temperature' })).toBe(Cog);
        expect(categoryIcon({ name: 'Climate Control' })).toBe(Snowflake);
        expect(categoryIcon({ name: 'Access & Stuck components' })).toBe(KeyRound);
        expect(categoryIcon({ name: 'Body Damage' })).toBe(CarFront);
        expect(categoryIcon({ name: 'Fuel' })).toBe(Fuel);
    });

    it('understands Spanish names', () => {
        expect(categoryIcon({ name: 'Neumáticos y llantas' })).toBe(CircleDot);
        expect(categoryIcon({ name: 'Combustible' })).toBe(Fuel);
    });

    it('prefers the catalog key when it knows it, and falls back to a wrench', () => {
        expect(categoryIcon({ icon: 'battery', name: 'Whatever' })).not.toBe(Wrench);
        expect(categoryIcon({ icon: 'mystery', name: 'Something unrelated' })).toBe(Wrench);
    });
});
