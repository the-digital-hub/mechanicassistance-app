jest.mock('lucide-react-native', () => ({ Calendar: 'Calendar', Clock: 'Clock', ShieldCheck: 'ShieldCheck', Video: 'Video' }));

import { getCardState } from '../appointmentCardTheme';

const base = { type: 'immediate', assistanceType: 'immediate', currentStatus: undefined, departedAt: undefined, date: '' } as const;

describe('getCardState', () => {
    it('is "ready" before heading out and "en route" after', () => {
        expect(getCardState({ ...base, status: 'accepted' } as never)).toBe('ready');
        expect(getCardState({ ...base, status: 'accepted', departedAt: '2026-11-21T12:00:00Z' } as never)).toBe('enRoute');
    });

    it('is no longer "en route" once the technician checked in (the backend makes it in_progress)', () => {
        expect(getCardState({ ...base, status: 'in_progress', departedAt: '2026-11-21T12:00:00Z' } as never)).toBe('inProgress');
        expect(getCardState({ ...base, status: 'started' } as never)).toBe('inProgress');
    });
});
