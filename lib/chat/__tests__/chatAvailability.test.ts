import { chatAvailability } from '../chatAvailability';

describe('chatAvailability', () => {
    it('is open once a technician has accepted and until the job ends', () => {
        for (const s of ['accepted', 'scheduled', 'started', 'in_progress', 'awaiting_confirmation', 'disputed']) {
            expect(chatAvailability(s)).toBe('open');
        }
    });
    it('is closed (history only) when the job ended', () => {
        for (const s of ['completed', 'cancelled', 'canceled']) expect(chatAvailability(s)).toBe('closed');
    });
    it('is unavailable before a technician accepts', () => {
        for (const s of ['pending', 'offered', undefined, null]) expect(chatAvailability(s)).toBe('unavailable');
    });
});
