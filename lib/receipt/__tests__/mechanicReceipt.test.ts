import { mechanicReceiptTotals } from '../mechanicReceipt';

const breakdown = { base: '50.00', timeBand: { dayType: 'night', multiplier: 1.15, amount: '7.50' }, weather: null, total: '48.87' };

describe('technician receipt totals', () => {
    it('is the service value plus the extra time, and nothing about what was withheld', () => {
        const r = mechanicReceiptTotals(breakdown, '$63.53');
        expect(r.callNet).toBeCloseTo(48.87);
        expect(r.extension).toBeCloseTo(14.66);
        expect(r.total).toBeCloseTo(63.53);
        expect(r.callNet! + r.extension).toBeCloseTo(r.total);
        expect(Object.keys(r).sort()).toEqual(['callNet', 'extension', 'total']);
    });

    it('has no extra-time line when the call is the whole amount', () => {
        const r = mechanicReceiptTotals({ base: '40.00', total: '40.00' }, '40.00');
        expect(r.extension).toBe(0);
        expect(r.total).toBe(40);
    });

    it('falls back to the earning when the card has no amount', () => {
        expect(mechanicReceiptTotals(null, null, '31.20').total).toBeCloseTo(31.2);
    });
});
