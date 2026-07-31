import { apiClient } from '../api/apiClient';
import { CalculatePricePayload, IPricingDAO, PersistRequestPricePayload, PriceCalculationResult, VehicleIssue } from './interfaces';

/**
 * Client for the pricing microservice (proxied by the gateway under /api/pricing).
 * - `getVehicleIssues()` powers the issue-selection catalog (ids are real UUIDs).
 * - `calculatePrice()` returns the full breakdown for display; callers read `pricing_breakdown.final_price`.
 * - `persistRequestPrice()` prices a created request and persists it server-side
 *   (breakdown + issue pivot + assistance_requests.price).
 */
export class PricingDAO implements IPricingDAO {
    async getVehicleIssues(): Promise<VehicleIssue[]> {
        return apiClient.get('/api/pricing/vehicle-issues');
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
}

export const pricingDAO = new PricingDAO();
