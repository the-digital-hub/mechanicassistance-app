import { apiClient } from '../api/apiClient';
import type { IMechanicDocumentsDAO, LegalDocument } from './interfaces';

/**
 * A mechanic's legal documents (liability insurance, business licence) after
 * signup.
 *
 * Registration does not go through here: the wizard sends its documents inside
 * `POST /api/users` (see UserDAO.buildRegistrationPayload), because during
 * signup there is no account to attach them to. These endpoints need a real
 * login token.
 *
 * The file upload itself is MediaDAO.uploadDocument(); this only records the
 * `{ key, url }` that came back.
 */
class MechanicDocumentsDAOImpl implements IMechanicDocumentsDAO {
    async list(): Promise<LegalDocument[]> {
        const result = await apiClient.get<LegalDocument[]>('/api/mechanic-documents');
        return result ?? [];
    }

    /**
     * Uploads or replaces one document. Sending a type that is already on file
     * replaces it and sends the new file back to "pending".
     */
    async upsert(document: LegalDocument): Promise<LegalDocument> {
        const { type, fileKey, fileUrl, originalName, mimeType, sizeBytes } = document;

        return apiClient.post<LegalDocument>('/api/mechanic-documents', {
            type,
            fileKey,
            fileUrl,
            ...(originalName !== undefined && { originalName }),
            ...(mimeType !== undefined && { mimeType }),
            ...(sizeBytes !== undefined && { sizeBytes }),
        });
    }

    async remove(documentId: string): Promise<void> {
        await apiClient.delete(`/api/mechanic-documents/${documentId}`);
    }
}

export const mechanicDocumentsDAO = new MechanicDocumentsDAOImpl();
