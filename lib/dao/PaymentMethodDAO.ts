import { apiClient } from '../api/apiClient';
import { CardSetupIntent, PaymentCard, StripeConfig } from './interfaces';

/**
 * Client for the signed-in customer's saved cards (billing-service, proxied by
 * the gateway at /api/payment-methods/me).
 *
 * The card number never reaches billing: the card form confirms the setup
 * intent with Stripe directly, and billing then reads the result back from
 * Stripe when `confirmCard` names the intent.
 */
export class PaymentMethodDAO {
    async getConfig(): Promise<StripeConfig> {
        return apiClient.get('/api/payment-methods/me/config');
    }

    async createSetupIntent(): Promise<CardSetupIntent> {
        return apiClient.post('/api/payment-methods/me/setup-intent', {});
    }

    /** Saves the card behind a setup intent that Stripe already confirmed. */
    async confirmCard(setupIntentId: string): Promise<PaymentCard> {
        return apiClient.post('/api/payment-methods/me', { setupIntentId });
    }

    /** Default card first, then newest. */
    async list(): Promise<PaymentCard[]> {
        return apiClient.get('/api/payment-methods/me');
    }

    async setDefault(id: string): Promise<PaymentCard> {
        return apiClient.patch(`/api/payment-methods/me/${id}/default`, {});
    }

    /** 409 when the card backs a payment in progress. */
    async remove(id: string): Promise<void> {
        return apiClient.delete(`/api/payment-methods/me/${id}`);
    }
}

export const paymentMethodDAO = new PaymentMethodDAO();
