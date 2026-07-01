import { apiClient } from '../api/apiClient';

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

export const AseDAO = {
    async lookupByAseId(aseId: string): Promise<AseMechanicData> {
        return apiClient.get<AseMechanicData>(`/api/ase-membership/lookup/${encodeURIComponent(aseId)}`);
    },

    async getUserCertifications(userId: string): Promise<UserCertificationsData> {
        return apiClient.get<UserCertificationsData>(`/api/ase-membership/user/${userId}/certifications`);
    },

    async associate(userId: string, aseId: string): Promise<void> {
        await apiClient.post('/api/ase-membership/associate', { userId, aseId });
    },
};
