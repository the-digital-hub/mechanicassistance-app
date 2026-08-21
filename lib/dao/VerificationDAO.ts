import { apiClient } from '../api/apiClient';
import { IdentityVerification, VerificationStatus } from './interfaces';

/** What the SDK needs to run a verification flow. */
export interface VerificationSession {
    /** Our record id. Sent back on POST /api/users to link it to the account. */
    verificationId: string;
    sessionId: string;
    /** Short-lived token handed straight to startVerification(). */
    sessionToken: string;
    status: VerificationStatus;
}

/**
 * Identity verification (KYC) through Didit.
 *
 * The app never holds the Didit API key: the backend creates the session and
 * returns a short-lived token. The real decision reaches the backend by webhook,
 * so the SDK's own result only ever drives the UI.
 *
 * Both endpoints work during registration (signup token) and afterwards
 * (access token) — apiClient sends whichever exists.
 */
class VerificationDAO {
    /**
     * Starts a verification, or resumes the one already in flight for this
     * caller. Rejects with status 409 when the identity is already approved.
     */
    async createSession(
        options: { language?: string; role?: string } = {},
    ): Promise<VerificationSession> {
        return apiClient.post<VerificationSession>('/api/verification/session', options);
    }

    /**
     * Current status, or null when the caller has never started a verification.
     * This is what the app gates on — not the SDK result.
     */
    async getStatus(): Promise<IdentityVerification | null> {
        return apiClient.get<IdentityVerification | null>('/api/verification/status');
    }
}

export const verificationDAO = new VerificationDAO();
