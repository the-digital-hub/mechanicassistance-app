import type { Appointment } from '@/context/AppointmentsContext';
import { ratingsFromAppointments } from '../fromAppointments';

const appt = (over: Partial<Appointment>): Appointment => ({ id: 'a', type: 'immediate', title: 'Tire Assistance', date: '2026-11-20T10:00:00Z', time: '', car: 'BMW 530i (2019)', address: '', budget: '', status: 'completed', ...over } as Appointment);

describe('ratingsFromAppointments', () => {
    it('lists the stars the customers gave a technician, newest first, skipping the unrated', () => {
        const list = ratingsFromAppointments([
            appt({ id: 'old', reviewRating: 4, completedAt: '2026-11-18T10:00:00Z' }),
            appt({ id: 'none', reviewRating: null }),
            appt({ id: 'new', reviewRating: 5, completedAt: '2026-11-21T10:00:00Z' }),
        ], true);
        expect(list.map((r) => r.id)).toEqual(['new', 'old']);
        expect(list[0]).toMatchObject({ rating: 5, car: 'BMW 530i (2019)', tags: [] });
    });

    it('reads the stars technicians gave the owner when it is not a technician', () => {
        const list = ratingsFromAppointments([appt({ id: 'x', reviewRating: 5, clientRating: 3 })], false);
        expect(list).toHaveLength(1);
        expect(list[0].rating).toBe(3);
    });
});
