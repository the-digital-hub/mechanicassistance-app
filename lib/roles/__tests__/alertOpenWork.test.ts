const mockAppAlert = jest.fn();
jest.mock('@/lib/ui/appAlert', () => ({ appAlert: (...args: unknown[]) => mockAppAlert(...args) }));

import { alertOpenWork } from '../roleSwitchMessages';

const t = (key: string) => key;

describe('alertOpenWork', () => {
    beforeEach(() => mockAppAlert.mockClear());

    it('shows the day and the hour of the booked service in their own block, not inside the sentence', () => {
        alertOpenWork({ ownerRequestsOpen: 0, upcomingMechanicJobs: [{ appointmentId: 'a', date: '2026-11-24T15:30:00Z' }] } as never, t as never, 'en-US');
        expect(mockAppAlert).toHaveBeenCalledTimes(1);
        const [title, message, , options] = mockAppAlert.mock.calls[0];
        expect(title).toBe('profile.switchRole.openWorkTitle');
        expect(message).toBe('profile.switchRole.upcomingMechanicJobSwitch'); // no date in the text
        expect(options.highlight.label).toBe('profile.switchRole.upcomingLabel');
        expect(options.highlight.value).toMatch(/November/);
        expect(options.highlight.sub).toMatch(/\d{1,2}:\d{2}/);
    });

    it('with no date it still shows a block (what is waiting and in which role) and the sentence about what to do', () => {
        alertOpenWork({ ownerRequestsOpen: 0, upcomingMechanicJobs: [{ appointmentId: 'a', date: null }] } as never, t as never);
        expect(mockAppAlert.mock.calls[0][1]).toBe('profile.switchRole.upcomingMechanicJobNoDate');
        const options = mockAppAlert.mock.calls[0][3];
        expect(options.highlight.label).toBe('profile.switchRole.upcomingLabel');
        expect(options.highlight.value).toBe('profile.switchRole.upcomingNoDateValue');
        expect(options.highlight.sub).toBeUndefined();
    });

    it('says nothing when nothing is open', () => {
        alertOpenWork({ ownerRequestsOpen: 0, upcomingMechanicJobs: [] } as never, t as never);
        expect(mockAppAlert).not.toHaveBeenCalled();
    });
});
