import { File, Paths } from 'expo-file-system';

import { apiClient, getFreshAccessToken } from '../api/apiClient';
import { ConfigService } from '../config/ConfigService';
import { EarningsFilters, EarningsList, MechanicEarning, PayoutPage } from './interfaces';

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

    /** Earnings matching the filters, plus the all-time totals of the account. */
    list(filters: EarningsFilters = {}): Promise<EarningsList> {
        return apiClient.get<EarningsList>('/api/earnings/me', { ...filters });
    }

    /** Transfers sent to the mechanic's Stripe account, newest first. */
    payouts(page = 1, limit = 25): Promise<PayoutPage> {
        return apiClient.get<PayoutPage>('/api/earnings/me/payouts', { page, limit });
    }

    /**
     * Downloads the account statement PDF to the cache and returns its local uri.
     * A file, not JSON, so it bypasses apiClient's envelope unwrapping.
     */
    async downloadStatement(period: { from?: string; to?: string } = {}): Promise<string> {
        await ConfigService.init();
        const token = await getFreshAccessToken();
        if (!token) throw new Error('No session');
        const query = new URLSearchParams(
            Object.entries(period).filter((e): e is [string, string] => !!e[1]),
        ).toString();
        const base = ConfigService.getApiBaseUrl().replace(/\/+$/, '');
        const url = `${base}/api/earnings/me/statement${query ? `?${query}` : ''}`;
        const target = new File(Paths.cache, `statement-${new Date().toISOString().slice(0, 10)}.pdf`);
        if (target.exists) target.delete();
        const file = await File.downloadFileAsync(url, target, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return file.uri;
    }
}

export const earningsDAO = new EarningsDAO();
