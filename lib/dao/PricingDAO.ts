import { apiClient } from '../api/apiClient';
import { CalculatePricePayload, CatalogLanguage, IPricingDAO, PersistRequestPricePayload, PriceCalculationResult, VehicleIssue, VehicleIssueCategory, VehicleIssueSnapshot } from './interfaces';

/**
 * Client for the pricing microservice (proxied by the gateway under /api/pricing).
 * - `getVehicleIssues()` powers the issue-selection catalog (ids are real UUIDs).
 * - `calculatePrice()` returns the full breakdown for display; callers read `pricing_breakdown.final_price`.
 * - `persistRequestPrice()` prices a created request and persists it server-side
 *   (breakdown + issue pivot + assistance_requests.price).
 */
export class PricingDAO implements IPricingDAO {
    async getVehicleIssues(): Promise<VehicleIssue[]> {
        return apiClient.get('/api/pricing/vehicle-issues', { scope: 'app' });
    }

    /**
     * The whole category → issue → symptom tree in one request.
     *
     * The response is language-agnostic: every node carries its base `name` plus
     * the full `translations[]`, and the caller renders the row matching the
     * app's language (see `lib/i18n/catalogTranslations.ts`). Switching language
     * therefore does NOT require refetching this.
     * `scope: 'app'` drops rows the admin has hidden from the app.
     */
    async getVehicleIssueCatalog(): Promise<VehicleIssueCategory[]> {
        return apiClient.get('/api/pricing/vehicle-issue-catalog', { scope: 'app' });
    }

    /** Locale code → languageId, needed to read the right row out of `translations[]`. */
    async getLanguages(): Promise<CatalogLanguage[]> {
        return apiClient.get('/api/pricing/languages');
    }

    async calculatePrice(payload: CalculatePricePayload): Promise<PriceCalculationResult> {
        return apiClient.post('/api/pricing/calculate', payload);
    }

    async persistRequestPrice(
        serviceRequestId: string,
        payload: PersistRequestPricePayload,
    ): Promise<PriceCalculationResult> {
        return apiClient.post(`/api/pricing/requests/${serviceRequestId}/price`, payload);
    }

    async getRequestIssues(serviceRequestId: string): Promise<VehicleIssueSnapshot[]> {
        return apiClient.get(`/api/pricing/requests/${serviceRequestId}/issues`);
    }
}

export const pricingDAO = new PricingDAO();
