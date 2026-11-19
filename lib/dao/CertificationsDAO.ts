import { apiClient } from '../api/apiClient';

export type CertificationType = 'manufacturer' | 'industry' | 'other';
export type CertificationStatus = 'pending' | 'verified' | 'declined';

/** A certification the technician holds besides ASE (backlog Z: `/api/mechanic-certifications`). */
export interface Certification {
    id: string;
    type: CertificationType;
    name: string;
    issuer?: string | null;
    credentialId?: string | null;
    /** ISO date; null when it does not expire. */
    expiresAt?: string | null;
    fileKey?: string | null;
    fileUrl?: string | null;
    originalName?: string | null;
    status: CertificationStatus;
    declineReason?: string | null;
}

export interface CertificationInput {
    type: CertificationType;
    name: string;
    issuer?: string;
    credentialId?: string;
    expiresAt?: string | null;
    fileKey?: string;
    fileUrl?: string;
    originalName?: string;
}

class CertificationsDAOImpl {
    async list(): Promise<Certification[]> {
        const result = await apiClient.get<Certification[]>('/api/mechanic-certifications');
        return result ?? [];
    }

    create(input: CertificationInput): Promise<Certification> {
        return apiClient.post<Certification>('/api/mechanic-certifications', input);
    }

    update(id: string, input: Partial<CertificationInput>): Promise<Certification> {
        return apiClient.patch<Certification>(`/api/mechanic-certifications/${id}`, input);
    }

    async remove(id: string): Promise<void> {
        await apiClient.delete(`/api/mechanic-certifications/${id}`);
    }
}

export const certificationsDAO = new CertificationsDAOImpl();

/** `MM/YYYY` typed by the technician -> the last day of that month (ISO date), or null when empty/invalid. */
export function parseExpiry(text: string): string | null {
    const m = text.trim().match(/^(0?[1-9]|1[0-2])\s*\/\s*(\d{4})$/);
    if (!m) return null;
    const month = Number(m[1]);
    const year = Number(m[2]);
    const last = new Date(Date.UTC(year, month, 0));
    return last.toISOString().slice(0, 10);
}

/** ISO date -> `MM/YYYY` for the field. */
export function formatExpiry(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

export function isExpired(iso?: string | null, now = new Date()): boolean {
    if (!iso) return false;
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && d.getTime() < now.getTime();
}
