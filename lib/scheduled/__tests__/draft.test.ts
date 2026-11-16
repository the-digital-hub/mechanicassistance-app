jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

import {
    bookableDates,
    buildNotes,
    buildScheduledPayload,
    draftFromRequest,
    earliestMinutes,
    emptyDraft,
    firstIncompleteStep,
    formatMinutes,
    isSameDay,
    MAX_SERVICES,
    parseMileage,
    requestTitle,
    serviceDateISO,
    stepIsValid,
    timeSlots,
    toDateKey,
    type ScheduledDraft,
} from '../draft';

// Wednesday 2026-11-11, 10:15 local.
const NOW = new Date(2026, 10, 11, 10, 15);

const complete = (): ScheduledDraft => ({
    ...emptyDraft(),
    vehicleId: 'veh-1',
    vehicleName: '2024 Ford Mustang',
    mileage: '28,540',
    location: { source: 'saved', addressId: 'a1', label: 'Home', line: '16329 Malibu Dr, Weston, FL', lat: 26.1, lng: -80.4, zip: '33326' },
    services: ['tire_rotation', 'brake_fluid', 'wheel_alignment'],
    customRequest: 'Check the spare too',
    date: '2026-11-13',
    fromMin: 13 * 60,
    toMin: 16 * 60,
    symptoms: 'Pulls to the right',
});

describe('time helpers', () => {
    it('offers 6:00 AM to 9:00 PM every 30 minutes', () => {
        const slots = timeSlots();
        expect(slots[0]).toBe(360);
        expect(slots[slots.length - 1]).toBe(1260);
        expect(slots).toHaveLength(31);
    });

    it('formats minutes as a 12-hour time', () => {
        expect(formatMinutes(360)).toBe('6:00 AM');
        expect(formatMinutes(12 * 60)).toBe('12:00 PM');
        expect(formatMinutes(13 * 60 + 30)).toBe('1:30 PM');
        expect(formatMinutes(0)).toBe('12:00 AM');
    });

    it('lists today plus the next seven days', () => {
        const days = bookableDates(NOW);
        expect(days).toHaveLength(8);
        expect(days[0]).toBe('2026-11-11');
        expect(days[7]).toBe('2026-11-18');
    });

    it('applies the one-hour lead time only on the same day', () => {
        expect(earliestMinutes('2026-11-11', NOW)).toBe(10 * 60 + 15 + 60);
        expect(earliestMinutes('2026-11-12', NOW)).toBe(0);
        expect(isSameDay('2026-11-11', NOW)).toBe(true);
        expect(isSameDay('2026-11-12', NOW)).toBe(false);
        expect(toDateKey(NOW)).toBe('2026-11-11');
    });

    it('reads digits out of the mileage field', () => {
        expect(parseMileage('28,540')).toBe(28540);
        expect(parseMileage('')).toBeUndefined();
        expect(parseMileage('abc')).toBeUndefined();
    });
});

describe('step validation', () => {
    it('needs a vehicle on step 1', () => {
        expect(stepIsValid(1, emptyDraft(), NOW)).toBe(false);
        expect(stepIsValid(1, complete(), NOW)).toBe(true);
    });

    it('needs a location, and a contact when someone else is in the vehicle', () => {
        const d = complete();
        expect(stepIsValid(2, d, NOW)).toBe(true);
        expect(stepIsValid(2, { ...d, location: null }, NOW)).toBe(false);
        expect(stepIsValid(2, { ...d, contactIsOwner: false }, NOW)).toBe(false);
        expect(stepIsValid(2, { ...d, contactIsOwner: false, contactFirst: 'Ana', contactLast: 'Diaz', contactPhone: '9545550100' }, NOW)).toBe(true);
    });

    it('needs at least one service and at most the backend limit', () => {
        const d = complete();
        expect(stepIsValid(3, { ...d, services: [] }, NOW)).toBe(false);
        expect(stepIsValid(3, { ...d, services: Array.from({ length: MAX_SERVICES + 1 }, (_, i) => `s${i}`) }, NOW)).toBe(false);
        expect(stepIsValid(3, d, NOW)).toBe(true);
    });

    it('needs a day and a window that ends after it starts', () => {
        const d = complete();
        expect(stepIsValid(4, d, NOW)).toBe(true);
        expect(stepIsValid(4, { ...d, toMin: d.fromMin }, NOW)).toBe(false);
        expect(stepIsValid(4, { ...d, date: '' }, NOW)).toBe(false);
    });

    it('rejects a same-day start inside the lead time', () => {
        const d = { ...complete(), date: '2026-11-11', fromMin: 10 * 60 + 30, toMin: 14 * 60 };
        expect(stepIsValid(4, d, NOW)).toBe(false);
        expect(stepIsValid(4, { ...d, fromMin: 12 * 60 }, NOW)).toBe(true);
    });

    it('finds the first step with missing data', () => {
        expect(firstIncompleteStep(emptyDraft(), NOW)).toBe(1);
        expect(firstIncompleteStep({ ...complete(), services: [] }, NOW)).toBe(3);
        expect(firstIncompleteStep(complete(), NOW)).toBeNull();
    });
});

describe('request body', () => {
    it('dates the request at the start of the window, local time', () => {
        const iso = serviceDateISO(complete());
        const d = new Date(iso as string);
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(10);
        expect(d.getDate()).toBe(13);
        expect(d.getHours()).toBe(13);
    });

    it('titles the request with the first services and a count', () => {
        expect(requestTitle([])).toBe('Scheduled assistance');
        expect(requestTitle(['Tire Rotation'])).toBe('Tire Rotation');
        expect(requestTitle(['A', 'B'])).toBe('A, B');
        expect(requestTitle(['A', 'B', 'C', 'D'])).toBe('A, B +2');
    });

    it('carries the window end and the owner words in the notes', () => {
        const notes = buildNotes(complete());
        expect(notes).toContain('Fri, Nov 13 · 1:00 PM – 4:00 PM');
        expect(notes).toContain('Other request: Check the spare too');
        expect(notes).toContain('Symptoms / special requests: Pulls to the right');
    });

    it('builds the scheduled payload with catalog service codes', () => {
        const payload = buildScheduledPayload({
            draft: complete(),
            userId: 'user-1',
            serviceNames: ['Tire Rotation', 'Brake Fluid Flush & Exchange', 'Wheel Alignment'],
            photos: [{ url: 'https://x/p.jpg', type: 'photo' }],
            paymentMethodId: 'card-1',
        });
        expect(payload.type).toBe('scheduled');
        expect(payload.assistanceType).toBe('scheduled');
        expect(payload.services).toEqual([{ code: 'tire_rotation' }, { code: 'brake_fluid' }, { code: 'wheel_alignment' }]);
        expect(payload.mileage).toBe(28540);
        expect(payload.driverIsOwner).toBe(true);
        expect(payload.driverFirstName).toBeUndefined();
        expect(payload.paymentMethodId).toBe('card-1');
        expect(payload.locationLat).toBe(26.1);
        expect(payload.zip).toBe('33326');
        expect(payload.title).toBe('Tire Rotation, Brake Fluid Flush & Exchange +1');
    });

    it('sends the contact only when someone else is in the vehicle', () => {
        const payload = buildScheduledPayload({
            draft: { ...complete(), contactIsOwner: false, contactFirst: ' Ana ', contactLast: 'Diaz', contactPhone: '9545550100' },
            userId: 'user-1',
            serviceNames: ['Tire Rotation'],
            photos: [],
        });
        expect(payload.driverIsOwner).toBe(false);
        expect(payload.driverFirstName).toBe('Ana');
        expect(payload.driverPhone).toBe('9545550100');
        expect(payload.paymentMethodId).toBeUndefined();
    });
});

describe('draftFromRequest', () => {
    it('keeps vehicle, place, contact and services, and leaves the schedule empty', () => {
        const d = draftFromRequest({
            vehicleId: 'v1', car: '2024 KIA Sportage', address: '920 Golden Cane Dr', locationLat: 26.1, locationLng: -80.4, zip: '33327',
            driverIsOwner: false, driverFirstName: 'Ana', driverPhone: '555',
            services: [{ code: 'oil_change' }, { code: 'oil_change' }, { code: 'brakes' }],
        });
        expect(d.step).toBe(4);
        expect(d.vehicleId).toBe('v1');
        expect(d.location?.line).toBe('920 Golden Cane Dr');
        expect(d.contactIsOwner).toBe(false);
        expect(d.services).toEqual(['oil_change', 'brakes']);
        expect(d.date).toBe('');
        expect(d.fromMin).toBeNull();
        expect(d.mileage).toBe('');
    });

    it('has no location when the request had no coordinates', () => {
        expect(draftFromRequest({ address: 'x' }).location).toBeNull();
        expect(draftFromRequest({}).contactIsOwner).toBe(true);
    });
});
