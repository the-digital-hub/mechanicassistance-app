import { apiClient } from '../api/apiClient';
import {
    clearSession,
    clearSignupToken as clearStoredSignupToken,
    getRefreshToken,
    saveCachedUser,
    saveTokens,
} from '../auth/session';
import { IUserDAO, MechanicStatus, PublicUserProfile, UserData } from './interfaces';

export class UserDAO implements IUserDAO {
    async getAll(): Promise<UserData[]> {
        return apiClient.get('/api/users');
    }

    async getById(id: string): Promise<UserData | null> {
        return apiClient.get(`/api/users/${id}`);
    }

    /**
     * Name, surname, avatar and role for any user.
     *
     * `getById` is restricted to your own account server-side — it returns
     * addresses, vehicles and identity verification. Use this to render someone
     * else, such as the other participant in a chat.
     */
    async getPublicProfile(id: string): Promise<PublicUserProfile | null> {
        return apiClient.get(`/api/users/${id}/public`);
    }

    /**
     * Firebase-authenticated login, now used only by Google and Apple sign-in.
     *
     * Phone sign-in goes through our own OTP (`lib/auth/otp.ts`); this route
     * stays for the social providers until they are migrated off Firebase too.
     */
    async loginWithFirebase(firebaseIdToken: string, phone?: string): Promise<UserData | null> {
        const result = await apiClient.post<{
            accessToken: string;
            refreshToken?: string;
            user: UserData;
        }>('/api/auth/login', { idToken: firebaseIdToken, phone });

        if (result.accessToken) {
            await saveTokens({
                accessToken: result.accessToken,
                // The backend always sends one now; the fallback only matters
                // against an older deployment.
                refreshToken: result.refreshToken ?? '',
            });
            if (result.user) await saveCachedUser(result.user);
            // A real session supersedes any leftover signup token.
            await this.clearSignupToken();
        }

        return result.user ?? null;
    }

    /**
     * Trades a pre-refresh-token session for a current one.
     *
     * Older builds stored a single long-lived access token and nothing else.
     * Called once at startup when that is what we find, so updating the app does
     * not sign the user out.
     */
    async exchangeLegacySession(): Promise<UserData | null> {
        const result = await apiClient.post<{
            accessToken: string;
            refreshToken: string;
            user: UserData;
        }>('/api/auth/session/exchange', {});

        await saveTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
        if (result.user) await saveCachedUser(result.user);

        return result.user ?? null;
    }

    /**
     * Trades the signup-scoped token for a real session, right after the account
     * is created.
     *
     * The wizard runs on a scoped token because the account does not exist yet;
     * this is the handover at the end. Sent as the Bearer, which apiClient
     * already attaches from the stored signup token.
     */
    async startSessionFromSignup(): Promise<UserData | null> {
        const result = await apiClient.post<{
            accessToken: string;
            refreshToken: string;
            user: UserData;
        }>('/api/auth/session/from-signup', {});

        await saveTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
        if (result.user) await saveCachedUser(result.user);
        await this.clearSignupToken();

        return result.user ?? null;
    }

    /** Ends the session server-side, revoking the whole rotation family. */
    async logout(): Promise<void> {
        const refreshToken = await getRefreshToken();

        if (refreshToken) {
            // A failure here must not strand the client with local state it
            // cannot clear, so the outcome is deliberately ignored.
            await apiClient
                .post('/api/auth/logout', { refreshToken })
                .catch(() => undefined);
        }

        await clearSession();
    }

    async clearSignupToken(): Promise<void> {
        await clearStoredSignupToken();
    }

    async checkEmailExists(email: string): Promise<boolean> {
        const result = await apiClient.get<{ exists: boolean }>(`/api/users/check-email/${encodeURIComponent(email)}`);
        return result.exists;
    }

    async register(setupProgress: Record<string, unknown>): Promise<unknown> {
        const payload = this.buildRegistrationPayload(setupProgress);
        const result = await apiClient.post('/api/users', payload);
        // The scoped token is NOT cleared here: startSessionFromSignup() still
        // has to send it as the Bearer to trade it for a real session. It is
        // cleared there, once the handover has succeeded.
        return result;
    }

    /**
     * Transforms raw setup progress (keyed by step) into the flat
     * CreateUserDto shape the backend expects.
     *
     * Setup progress shape:
     *   { phone, otp, role, basicInfo, address, vehicles, identity,
     *     credentials, dealerInfo, expertise, availability, legalDocuments,
     *     lastStep }
     *
     * Backend CreateUserDto expects top-level fields:
     *   { name, surname, email, phone, dob, profileImage, role, firebaseUid,
     *     addresses, vehicles, dealerInfo, expertise, credentials, availability,
     *     legalDocuments, identity }
     */
    private buildRegistrationPayload(progress: Record<string, unknown>): Record<string, unknown> {
        const basicInfo = (progress.basicInfo ?? {}) as Record<string, unknown>;
        const phoneData = (progress.phone ?? {}) as Record<string, unknown>;
        const otpData = (progress.otp ?? {}) as Record<string, unknown>;
        const roleData = (progress.role ?? {}) as Record<string, unknown>;
        const addressData = progress.address as Record<string, unknown> | undefined;
        const vehiclesData = progress.vehicles as Record<string, unknown>[] | undefined;
        const hasAddressData = (a?: Record<string, unknown>) =>
            !!a && (!!a.street || !!a.city);

        const payload: Record<string, unknown> = {
            // Flat top-level fields extracted from basicInfo
            name: basicInfo.name,
            surname: basicInfo.surname,
            email: basicInfo.email,
            dob: basicInfo.dob,
            profileImage: basicInfo.profileImage,

            // Phone as a plain string (backend expects string, not object)
            phone: phoneData.phoneNumber,

            // Role as a plain string
            role: roleData.role,

            // Firebase UID from OTP step
            firebaseUid: otpData.firebaseUid,
        };

        // Nested objects — pass through as the backend expects Record<string, any>
        // Address: send home and/or work as an array, only including blocks that
        // were actually filled in (so a single completed block sends just one entry).
        if (addressData) {
            const home = addressData.home as Record<string, unknown> | undefined;
            const work = addressData.work as Record<string, unknown> | undefined;
            const addresses: Record<string, unknown>[] = [];
            if (hasAddressData(home)) addresses.push({ ...home, type: 'home' });
            if (hasAddressData(work)) addresses.push({ ...work, type: 'work' });
            if (addresses.length > 0) payload.addresses = addresses;
        }
        if (progress.dealerInfo) payload.dealerInfo = progress.dealerInfo;
        if (progress.expertise) payload.expertise = progress.expertise;
        // ASE is optional: send credentials only when the step was actually
        // completed. A skipped step sends nothing, and the backend leaves the
        // mechanic at aseStatus "pending" so the profile keeps prompting.
        const credentialsData = progress.credentials as Record<string, unknown> | undefined;
        if (credentialsData?.validated && credentialsData.aseId) {
            payload.credentials = { aseId: credentialsData.aseId };
        }
        if (progress.availability) payload.availability = progress.availability;

        // Vehicles: strip client-generated `id` — Prisma generates UUIDs server-side
        if (vehiclesData && Array.isArray(vehiclesData) && vehiclesData.length > 0) {
            payload.vehicles = vehiclesData.map(({ id: _clientId, ...vehicleFields }) => vehicleFields);
        }

        // Legal documents (mechanic liability insurance + business licence).
        // The step is skippable, so an empty array is the common case and is
        // omitted rather than sent — same criterion as `credentials`. The files
        // are already in media-service; these are just the pointers.
        const legalDocuments = progress.legalDocuments as
            | Record<string, unknown>[]
            | undefined;
        if (Array.isArray(legalDocuments) && legalDocuments.length > 0) {
            payload.legalDocuments = legalDocuments
                .filter((doc) => doc?.type && doc?.fileKey && doc?.fileUrl)
                .map(({ type, fileKey, fileUrl, originalName, mimeType, sizeBytes }) => ({
                    type,
                    fileKey,
                    fileUrl,
                    ...(originalName !== undefined && { originalName }),
                    ...(mimeType !== undefined && { mimeType }),
                    ...(sizeBytes !== undefined && { sizeBytes }),
                }));
        }

        // Identity verification: links the account to the Didit verification
        // started on the identity step. Absent when that step was skipped —
        // "verify later" is allowed for both roles and the account is created
        // unverified. What stays closed until Didit approves is the mechanic's
        // offer on a request, which appointments-service enforces.
        const identityData = progress.identity as Record<string, unknown> | undefined;
        if (identityData?.verificationId) {
            payload.verificationId = identityData.verificationId;
        }

        return payload;
    }

    async update(id: string, updates: Partial<UserData>): Promise<void> {
        return apiClient.patch(`/api/users/${id}`, updates);
    }

    /**
     * Sets the mechanic's live status. Separate from `update` because the
     * backend owns the outcome: losing every socket forces offline and an
     * active job forces busy, so the applied status can differ from the one
     * sent. Use what comes back, not what was requested.
     */
    async setPresence(
        id: string,
        status: MechanicStatus,
    ): Promise<{ status: MechanicStatus; isOnline: boolean }> {
        return apiClient.patch(`/api/users/${id}/presence`, { status });
    }
}

export const userDAO = new UserDAO();
