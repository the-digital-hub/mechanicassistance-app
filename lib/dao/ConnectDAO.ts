import { apiClient } from '../api/apiClient';
import { ConnectStatus } from './interfaces';

/**
 * The mechanic's Stripe payout account (billing-service, /api/connect/me).
 * Bank and identity details are typed on Stripe's own pages, never in the app;
 * payouts then go out automatically once earnings are ready.
 */
export class ConnectDAO {
    /** Read fresh from Stripe, so it is right after coming back from onboarding. */
    status(): Promise<ConnectStatus> {
        return apiClient.get<ConnectStatus>('/api/connect/me');
    }

    /**
     * Single-use link to Stripe's onboarding, to open in a browser. No return
     * url: billing only accepts Mechanic Assistance web pages, so the default
     * one is used and the app re-reads the status when it comes back to front.
     */
    onboardingLink(): Promise<{ url: string }> {
        return apiClient.post<{ url: string }>('/api/connect/me/onboarding', {});
    }

    /** Link to the Stripe Express dashboard: change bank account, see transfers. */
    dashboardLink(): Promise<{ url: string }> {
        return apiClient.post<{ url: string }>('/api/connect/me/dashboard', {});
    }
}

export const connectDAO = new ConnectDAO();
