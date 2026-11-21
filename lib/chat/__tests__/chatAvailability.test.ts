import { chatAvailability } from '../chatAvailability';

describe('chatAvailability', () => {
    it('is open once a technician has accepted and until the assistance is finished', () => {
        for (const s of ['accepted', 'scheduled', 'started', 'in_progress', 'disputed']) {
            expect(chatAvailability(s)).toBe('open');
        }
    });
    it('is closed (history only) when the assistance is finished, even if the owner has not confirmed it yet', () => {
        for (const s of ['awaiting_confirmation', 'completed', 'cancelled', 'canceled']) expect(chatAvailability(s)).toBe('closed');
    });
    it('is unavailable before a technician accepts', () => {
        for (const s of ['pending', 'offered', undefined, null]) expect(chatAvailability(s)).toBe('unavailable');
    });
});
