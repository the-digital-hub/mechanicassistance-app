import { splitQuoteDescription } from '../offers';
import {
    arrivalSlot,
    arrivalTimes,
    buildQuoteDescription,
    buildQuoteOffer,
    minutesOf,
    parseRequestNotes,
    quoteProblem,
    quoteTotals,
    requestDays,
    type QuoteDraft,
} from '../provider';

const NOW = new Date(2026, 10, 15, 12, 0, 0);

const draft = (extra: Partial<QuoteDraft> = {}): QuoteDraft => ({
    lines: [
        { name: 'Tire rotation', on: true, price: '60' },
        { name: 'Brake pads', on: true, price: '215.50' },
        { name: 'Wheel alignment', on: false, price: '' },
    ],
    partsIncluded: true,
    travelFee: '',
    day: '2026-11-20',
    time: 13 * 60,
    durationId: '2h',
    warrantyId: '90d',
    message: '',
    ...extra,
});

describe('availability written in other shapes', () => {
    it('reads "Rango … al … (window TZ)" as days and window', () => {
        const p = parseRequestNotes('Rango 2026-11-25 al 2026-11-26 (10:00 AM - 7:00 PM EST)', '2026-11-25T00:00:00.000Z');
        expect(p.days).toBe('Wed, Nov 25 – Thu, Nov 26');
        expect(p.window).toBe('10:00 AM – 7:00 PM');
        expect(requestDays(p.days, '2026-11-25T00:00:00.000Z')).toEqual(['2026-11-25', '2026-11-26']);
    });
    it('reads a window with a plain hyphen', () => {
        expect(parseRequestNotes('Wed, Nov 25 · 10:00 AM - 7:00 PM').window).toBe('10:00 AM – 7:00 PM');
    });
    it('a bare day stays that day (no shift to the evening before)', () => {
        expect(requestDays('', '2026-11-25')).toEqual(['2026-11-25']);
        expect(requestDays('', '2026-11-25T00:00:00.000Z')).toEqual(['2026-11-25']);
    });
});

describe('parseRequestNotes', () => {
    const notes = [
        'At a repair shop · within 25 miles of the service address',
        'Fri, Nov 20 – Sun, Nov 22 · 8:00 AM – 12:00 PM',
        'Brake pads: Squeaks when braking',
        'continued on a second line',
        'Other request: Check the spare',
        'Symptoms / special requests: Pulls to the right',
    ].join('\n');

    it('reads every part of what the app writes', () => {
        const p = parseRequestNotes(notes);
        expect(p.mode).toBe('workshop');
        expect(p.days).toBe('Fri, Nov 20 – Sun, Nov 22');
        expect(p.window).toBe('8:00 AM – 12:00 PM');
        expect(p.serviceNotes['Brake pads']).toBe('Squeaks when braking\ncontinued on a second line');
        expect(p.other).toBe('Check the spare');
        expect(p.symptoms).toBe('Pulls to the right');
    });

    it('reads a single day', () => {
        const p = parseRequestNotes('Fri, Nov 20 · 8:00 AM – 12:00 PM');
        expect(p).toMatchObject({ mode: 'onsite', days: 'Fri, Nov 20', window: '8:00 AM – 12:00 PM' });
    });

    it('reads the old label and adds the day from the date', () => {
        const p = parseRequestNotes('Preferred window: 8:00 AM – 12:00 PM', '2026-11-20T14:00:00.000Z');
        expect(p.days).toBe('Fri, Nov 20');
        expect(p.window).toBe('8:00 AM – 12:00 PM');
    });

    it('tolerates empty notes', () => {
        expect(parseRequestNotes(null)).toMatchObject({ days: '', window: '', symptoms: '' });
    });
});

describe('days and times', () => {
    it('lists the days of a range from the request date', () => {
        expect(requestDays('Fri, Nov 20 – Sun, Nov 22', new Date(2026, 10, 20, 8).toISOString())).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    });
    it('gives one day without a range', () => {
        expect(requestDays('Fri, Nov 20', new Date(2026, 10, 20, 8).toISOString())).toEqual(['2026-11-20']);
        expect(requestDays('', undefined)).toEqual([]);
    });
    it('reads a time label', () => {
        expect(minutesOf('8:00 AM')).toBe(480);
        expect(minutesOf('12:30 PM')).toBe(12 * 60 + 30);
        expect(minutesOf('12:00 AM')).toBe(0);
        expect(Number.isNaN(minutesOf('noon'))).toBe(true);
    });
    it('offers the start and each full hour inside the window', () => {
        expect(arrivalTimes('8:00 AM – 12:00 PM')).toEqual([480, 540, 600, 660]);
        expect(arrivalTimes('12:30 PM – 4:30 PM')).toEqual([750, 780, 840, 900, 960]);
        expect(arrivalTimes('')).toEqual([480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080]);
    });
});

describe('quote totals', () => {
    it('adds the services that are on and the travel fee', () => {
        const t = quoteTotals(draft({ travelFee: '25' }));
        expect(t.subtotal).toBeCloseTo(275.5);
        expect(t.total).toBeCloseTo(300.5);
        expect(t.notIncluded).toEqual(['Wheel alignment']);
        expect(t.valid).toBe(true);
    });
    it('is not valid without a price on every service that is on, or with none on', () => {
        expect(quoteTotals(draft({ lines: [{ name: 'A', on: true, price: '' }] })).valid).toBe(false);
        expect(quoteTotals(draft({ lines: [{ name: 'A', on: false, price: '' }] })).valid).toBe(false);
    });
    it('names what is missing', () => {
        expect(quoteProblem(draft({ lines: [{ name: 'A', on: false, price: '' }] }), NOW)).toBe('services');
        expect(quoteProblem(draft({ lines: [{ name: 'A', on: true, price: '' }] }), NOW)).toBe('prices');
        expect(quoteProblem(draft({ time: null }), NOW)).toBe('arrival');
        expect(quoteProblem(draft({ day: '2026-11-10' }), NOW)).toBe('arrival');
        expect(quoteProblem(draft(), NOW)).toBeNull();
    });
});

describe('the offer', () => {
    it('sends one final price with the slot and the warranty', () => {
        const o = buildQuoteOffer(draft({ travelFee: '24.50' }));
        expect(o.quoteType).toBe('final');
        expect(o.price).toBe('300.00');
        expect(o.warrantyDays).toBe(90);
        expect(new Date(o.proposedEnd as string).getTime() - new Date(o.proposedStart as string).getTime()).toBe(120 * 60000);
        expect(new Date(o.proposedStart as string).getHours()).toBe(13);
    });

    it('arrival slot follows the chosen duration', () => {
        const slot = arrivalSlot(draft({ durationId: '1.5h' })) as { start: string; end: string };
        expect(new Date(slot.end).getTime() - new Date(slot.start).getTime()).toBe(90 * 60000);
        expect(arrivalSlot(draft({ time: null }))).toBeNull();
    });

    it('writes a description the owner app can read back as service lines', () => {
        const d = buildQuoteDescription(draft({ travelFee: '25', message: 'I bring my own tools' }));
        const { text, items } = splitQuoteDescription(d);
        expect(text).toContain('Quote for: Tire rotation, Brake pads.');
        expect(text).toContain('Not included: Wheel alignment.');
        expect(text).toContain('I bring my own tools');
        expect(text.length).toBeGreaterThanOrEqual(10);
        expect(items.filter((i) => i.quoted).map((i) => [i.name, i.total])).toEqual([
            ['Tire rotation', 60],
            ['Brake pads', 215.5],
            ['Travel fee', 25],
        ]);
        expect(items.find((i) => i.name === 'Wheel alignment')?.quoted).toBe(false);
    });
});
