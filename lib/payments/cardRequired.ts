import { ApiError } from '@/lib/api/types';

/**
 * `returnTo` value for /payment-cards that means "go back to the screen that
 * sent you here". The request confirmation keeps the wizard in its own route
 * params, which a fresh navigation to it would drop.
 */
export const RETURN_TO_BACK = 'back';

/** True for the 402 appointments-service answers when the customer has no saved card. */
export function isPaymentMethodRequired(error: unknown): boolean {
    if (!(error instanceof ApiError) || error.statusCode !== 402) return false;
    const payload =
        error.apiError !== null && typeof error.apiError === 'object'
            ? (error.apiError as Record<string, unknown>)
            : null;
    return payload?.code === 'payment_method_required';
}
