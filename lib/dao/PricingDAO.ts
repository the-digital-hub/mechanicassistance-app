import { apiClient } from '../api/apiClient';
import { CalculatePricePayload, ScheduledServiceCategory, CatalogLanguage, IPricingDAO, PersistRequestPricePayload, PriceCalculationResult, VehicleIssue, VehicleIssueCategory, VehicleIssueSnapshot } from './interfaces';

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

    /**
     * The scheduled-services tree (category → services) in one call. Language-agnostic like
     * the issue catalog: every node carries its English `name` plus `translations[]`.
     * `scope: 'app'` drops what the admin has hidden from the app.
     */
    async getServiceCategories(): Promise<ScheduledServiceCategory[]> {
        return apiClient.get('/api/pricing/service-categories', {
            assistanceType: 'scheduled',
            scope: 'app',
            includeServices: true,
        });
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

    /**
     * The issues of many requests in one go (`POST /api/pricing/requests/issues`, up to 100 ids per call; a request with none, or that does
     * not exist, comes back as `[]`). Replaces one call per request.
     */
    async getRequestIssuesBatch(ids: string[]): Promise<Record<string, VehicleIssueSnapshot[]>> {
        const unique = Array.from(new Set(ids.filter(Boolean)));
        const out: Record<string, VehicleIssueSnapshot[]> = {};
        for (let i = 0; i < unique.length; i += 100) {
            const part = await apiClient.post<Record<string, VehicleIssueSnapshot[]>>('/api/pricing/requests/issues', { ids: unique.slice(i, i + 100) });
            Object.assign(out, part ?? {});
        }
        return out;
    }
}

export const pricingDAO = new PricingDAO();
