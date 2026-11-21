import { hasSentQuote, isQuoteWaiting, quotesWaiting } from '../quotes';

const now = Date.parse('2026-11-22T12:00:00Z');
const quote = (status: string | undefined, closes: string | null) => ({ myQuote: { price: '500.00', status }, offersCloseAt: closes });

describe('quotes sent on scheduled requests', () => {
    it('knows a request that already has a quote of this technician', () => {
        expect(hasSentQuote({ myQuote: { price: '1' } })).toBe(true);
        expect(hasSentQuote({ myQuote: null })).toBe(false);
        expect(hasSentQuote({})).toBe(false);
    });

    it('waits only while submitted and before the customer window closes', () => {
        expect(isQuoteWaiting(quote('submitted', '2026-11-23T12:00:00Z'), now)).toBe(true);
        expect(isQuoteWaiting(quote(undefined, null), now)).toBe(true);
        expect(isQuoteWaiting(quote('submitted', '2026-11-21T12:00:00Z'), now)).toBe(false);
        expect(isQuoteWaiting(quote('not_selected', '2026-11-23T12:00:00Z'), now)).toBe(false);
        expect(isQuoteWaiting({ offersCloseAt: '2026-11-23T12:00:00Z' }, now)).toBe(false);
    });

    it('lists the ones closing first on top, undated last', () => {
        const a = { id: 'a', ...quote('submitted', '2026-11-25T12:00:00Z') };
        const b = { id: 'b', ...quote('submitted', '2026-11-23T12:00:00Z') };
        const c = { id: 'c', ...quote('submitted', null) };
        const gone = { id: 'd', ...quote('expired', '2026-11-23T12:00:00Z') };
        expect(quotesWaiting([a, c, gone, b], now).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    });
});
