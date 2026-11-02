import { apiClient } from '../api/apiClient';
import { VehicleCatalogEntry } from './interfaces';

export type VehicleCatalogKind = 'vehicle-types' | 'engine-types' | 'fuel-types' | 'spare-tire-types';

/**
 * Client for the vehicle type, engine, fuel and spare-tire catalogs
 * (users-service, proxied by the gateway at /api/<kind>).
 *
 * Reachable with a login token and with the signup-scoped token, so the vehicle
 * step of the setup wizard can use them before the account exists.
 */
export class VehicleCatalogDAO {
    /**
     * Every entry, active or not, ordered for display — render it as-is, do
     * not re-sort. Hiding inactive entries is the caller's job.
     */
    async getCatalog(kind: VehicleCatalogKind): Promise<VehicleCatalogEntry[]> {
        return apiClient.get(`/api/${kind}`);
    }
}

export const vehicleCatalogDAO = new VehicleCatalogDAO();
