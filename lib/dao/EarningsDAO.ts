import { apiClient } from '../api/apiClient';
import { MechanicEarning } from './interfaces';

interface EarningsResponse {
    items: MechanicEarning[];
}

export class EarningsDAO {
    /**
     * The signed-in mechanic's earning for one job, or null when it has not been
     * charged yet. The gateway scopes the answer to the caller.
     */
    async getForRequest(assistanceRequestId: string): Promise<MechanicEarning | null> {
        const res = await apiClient.get<EarningsResponse>(
            `/api/earnings/me?assistanceRequestId=${encodeURIComponent(assistanceRequestId)}`,
        );
        return res?.items?.[0] ?? null;
    }
}

export const earningsDAO = new EarningsDAO();
