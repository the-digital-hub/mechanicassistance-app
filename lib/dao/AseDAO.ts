import { apiClient } from '../api/apiClient';
import { UserData } from './interfaces';

export interface AseCertification {
    id: string;
    code: string;
    name: string | null;
    description?: string | null;
    expirationDate: string | null;
}

export interface AseMechanicData {
    id: string;
    aseId: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    zip: string | null;
    certifications: AseCertification[];
}

export interface UserCertificationsData {
    userId: string;
    aseId: string;
    mechanicId: string;
    firstName: string;
    lastName: string;
    certifications: AseCertification[];
}

/**
 * Result of checking an ASE ID against the name the mechanic registered with.
 * Carries no holder name by design — the backend never echoes it back, so a
 * caller cannot read real names by guessing IDs.
 *
 * `matched: false` means the ID exists but belongs to someone else; an unknown
 * ID comes back as a 404 instead.
 */
export interface AseVerifyResult {
    matched: boolean;
    aseId?: string;
    certifications?: AseCertification[];
}

export const AseDAO = {
    async lookupByAseId(aseId: string): Promise<AseMechanicData> {
        return apiClient.get<AseMechanicData>(`/api/ase-membership/lookup/${encodeURIComponent(aseId)}`);
    },

    async verify(aseId: string, firstName: string, lastName: string): Promise<AseVerifyResult> {
        return apiClient.post<AseVerifyResult>('/api/ase-membership/verify', { aseId, firstName, lastName });
    },

    async getUserCertifications(userId: string): Promise<UserCertificationsData> {
        return apiClient.get<UserCertificationsData>(`/api/ase-membership/user/${userId}/certifications`);
    },

    /**
     * Links an existing mechanic to their ASE record and flips their
     * aseStatus to "verified".
     *
     * Goes through users-service rather than profile-service directly: only
     * users-service owns aseStatus, and it re-checks the ASE record against
     * the name stored on the account, so the name cannot be spoofed from here.
     * Returns the refreshed user.
     */
    async linkForUser(userId: string, aseId: string): Promise<UserData> {
        return apiClient.post<UserData>(`/api/users/${userId}/ase-membership`, { aseId });
    },
};
