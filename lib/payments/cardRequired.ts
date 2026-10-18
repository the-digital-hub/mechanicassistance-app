import { ApiError } from '@/lib/api/types';

/**
 * `returnTo` value for /payment-cards that means "go back to the screen that
 * sent you here". The request confirmation keeps the wizard in its own route
 * params, which a fresh navigation to it would drop.
 */
export const RETURN_TO_BACK = 'back';

/**
 * The machine-readable `code` of an API error (`OFFER_EXPIRED`,
 * `card_declined`, `payment_pending`…), or undefined for anything else.
 */
export function apiErrorCode(error: unknown): string | undefined {
    if (!(error instanceof ApiError)) return undefined;
    const payload =
        error.apiError !== null && typeof error.apiError === 'object'
            ? (error.apiError as Record<string, unknown>)
            : null;
    return typeof payload?.code === 'string' ? payload.code : undefined;
}

/** True for the 402 appointments-service answers when the customer has no saved card. */
export function isPaymentMethodRequired(error: unknown): boolean {
    return error instanceof ApiError && error.statusCode === 402 && apiErrorCode(error) === 'payment_method_required';
}
