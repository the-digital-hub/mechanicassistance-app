import i18n from '@/lib/i18n';
import { apiClient } from '../api/apiClient';
import { type LegalPolicies, normalizePolicies } from '../legal/policies';

const locale = () => (i18n.language?.startsWith('en') ? 'en' : 'es');

/** The legal texts the person has to read and accept (`/api/legal`, backend 25-nov, AU). */
class LegalDAO {
    /** The current versions with whether this person accepted each, and the ones still pending. */
    async policies(): Promise<LegalPolicies> {
        const raw = await apiClient.get<unknown>('/api/legal/policies', { locale: locale() });
        return normalizePolicies(raw, locale());
    }

    /** The full text of one published version. */
    async policy(id: string): Promise<LegalPolicies['policies'][number] | null> {
        const raw = await apiClient.get<unknown>(`/api/legal/policies/${id}`, { locale: locale() });
        return normalizePolicies({ policies: [raw] }, locale()).policies[0] ?? null;
    }

    /** Accepts a version (idempotent: the second time keeps the first record). 409 `policy_superseded` when it is no longer the current one. */
    accept(id: string, appVersion?: string): Promise<unknown> {
        return apiClient.post(`/api/legal/policies/${id}/accept`, { locale: locale(), ...(appVersion ? { appVersion } : {}) });
    }
}

export const legalDAO = new LegalDAO();
