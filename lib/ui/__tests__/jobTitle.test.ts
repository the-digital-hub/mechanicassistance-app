import { splitJobTitle } from '@/lib/ui/jobTitle';

describe('splitJobTitle', () => {
    it('the first part is the service, the rest what is wrong, without the catalog\'s "Other:"', () => {
        expect(splitJobTitle('Tire Assistance, Other: Fast')).toEqual({ main: 'Tire Assistance', topic: 'Fast' });
        expect(splitJobTitle('Brakes, Flat tire, Other: Squeaks')).toEqual({ main: 'Brakes', topic: 'Flat tire, Squeaks' });
    });

    it('a single part is only the title', () => {
        expect(splitJobTitle('Immediate Assistance')).toEqual({ main: 'Immediate Assistance', topic: '' });
    });

    it('does not break on a row without a title', () => {
        expect(splitJobTitle(null)).toEqual({ main: '', topic: '' });
        expect(splitJobTitle(undefined)).toEqual({ main: '', topic: '' });
    });
});
