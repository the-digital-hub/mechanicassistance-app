import type { AssistanceRequest } from '@/lib/dao/interfaces';

/** True once this technician has sent a quote on the request (whatever became of it): it no longer belongs with the new requests. */
export function hasSentQuote(r: Pick<AssistanceRequest, 'myQuote'>): boolean {
    return !!r.myQuote;
}

/** A quote still waiting for the customer: sent, not decided, and the customer's window has not closed. */
export function isQuoteWaiting(r: Pick<AssistanceRequest, 'myQuote' | 'offersCloseAt'>, now: number = Date.now()): boolean {
    if (!r.myQuote) return false;
    const status = r.myQuote.status ?? 'submitted';
    if (status !== 'submitted') return false;
    const end = r.offersCloseAt ? Date.parse(r.offersCloseAt) : NaN;
    return !Number.isFinite(end) || end > now;
}

/** The quotes waiting for the customer, the one that closes first on top (the ones without a date last). */
export function quotesWaiting<T extends Pick<AssistanceRequest, 'myQuote' | 'offersCloseAt'>>(list: readonly T[], now: number = Date.now()): T[] {
    const at = (r: T) => (r.offersCloseAt ? Date.parse(r.offersCloseAt) : Infinity);
    return list.filter((r) => isQuoteWaiting(r, now)).sort((a, b) => at(a) - at(b));
}
