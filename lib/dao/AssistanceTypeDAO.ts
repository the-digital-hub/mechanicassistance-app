import { apiClient } from '../api/apiClient';
import { AssistanceTypeCatalogItem } from './interfaces';

/**
 * Client for the assistance type catalog (appointments-service, proxied by the
 * gateway at /api/assistance-types).
 *
 * The sibling `ExpertiseDAO.listAssistanceTypes()` hits the same endpoint but only
 * reads `{ id, name }` for the mechanic's expertise picker. This one reads the full
 * catalog the request flow needs.
 */
export class AssistanceTypeDAO {
    /**
     * The catalog ordered by `sortOrder` — render it as-is, do not re-sort.
     *
     * Language-agnostic like the pricing catalog: every row carries its base `name`
     * plus the full `translations[]`, and the caller renders the row matching the
     * app's language (see `lib/i18n/catalogTranslations.ts`), so switching language
     * does NOT require refetching this.
     * `scope: 'app'` drops the types the admin has hidden from the app.
     */
    async getCatalog(): Promise<AssistanceTypeCatalogItem[]> {
        return apiClient.get('/api/assistance-types', { scope: 'app' });
    }
}

export const assistanceTypeDAO = new AssistanceTypeDAO();
