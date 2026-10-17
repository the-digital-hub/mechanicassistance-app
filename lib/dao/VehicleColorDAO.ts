import { apiClient } from '../api/apiClient';
import { VehicleColor } from './interfaces';

/**
 * Client for the vehicle color catalog (users-service, proxied by the gateway
 * at /api/vehicle-colors).
 *
 * Reachable with a login token and with the signup-scoped token, so the vehicle
 * step of the setup wizard can use it before the account exists.
 */
export class VehicleColorDAO {
    /**
     * Every entry, active or not, ordered by `sortOrder` — render it as-is, do
     * not re-sort. Hiding inactive entries is the caller's job.
     */
    async getCatalog(): Promise<VehicleColor[]> {
        return apiClient.get('/api/vehicle-colors');
    }
}

export const vehicleColorDAO = new VehicleColorDAO();
