import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/apiClient';
import { IUserDAO, UserData } from './interfaces';

export class UserDAO implements IUserDAO {
    async getAll(): Promise<UserData[]> {
        return apiClient.get('/api/users');
    }

    async getById(id: string): Promise<UserData | null> {
        return apiClient.get(`/api/users/${id}`);
    }

    /** Legacy phone-only login (kept for reference — use loginWithFirebase instead) */
    async login(phone: string): Promise<UserData | null> {
        return apiClient.post('/api/auth/login', { phone });
    }

    /** Firebase-authenticated login: sends the ID token + phone fallback to the backend.
     *  The backend returns { accessToken, user } — we extract just the user record. */
    async loginWithFirebase(firebaseIdToken: string, phone?: string): Promise<UserData | null> {
        const result = await apiClient.post<{ accessToken: string; user: UserData }>(
            '/api/auth/login',
            { idToken: firebaseIdToken, phone },
        );
        if (result.accessToken) {
            await AsyncStorage.setItem('access_token', result.accessToken);
            // A real session supersedes any leftover signup token.
            await this.clearSignupToken();
        }
        return result.user ?? null;
    }

    /**
     * Obtains the short-lived token that authorizes the registration calls.
     *
     * The setup flow uploads a profile picture and an identity document, and
     * finally creates the user, all before any account (and therefore any login
     * token) exists. The gateway rejects those routes without a Bearer token, so
     * this exchanges the just-verified Firebase OTP token for one scoped to
     * exactly those routes. Stored under its own key so it can never be mistaken
     * for a session.
     */
    async fetchSignupToken(firebaseIdToken: string, phone?: string): Promise<void> {
        const result = await apiClient.post<{ signupToken: string; expiresIn: number }>(
            '/api/auth/signup-token',
            { idToken: firebaseIdToken, phone },
        );
        if (result?.signupToken) {
            await AsyncStorage.setItem('signup_token', result.signupToken);
        }
    }

    async clearSignupToken(): Promise<void> {
        await AsyncStorage.removeItem('signup_token');
    }

    async checkEmailExists(email: string): Promise<boolean> {
        const result = await apiClient.get<{ exists: boolean }>(`/api/users/check-email/${encodeURIComponent(email)}`);
        return result.exists;
    }

    async checkPhoneExists(phone: string): Promise<boolean> {
        const result = await apiClient.get<{ exists: boolean }>(`/api/users/check-phone/${encodeURIComponent(phone)}`);
        return result.exists;
    }

    /** Pre-checks whether a phone number is allowed to receive an OTP before calling Firebase.
     *  Returns a neutral allowed/message response — never reveals account existence to the caller. */
    async preCheckPhone(phone: string): Promise<{ allowed: boolean; message?: string }> {
        return apiClient.post('/api/auth/pre-check', { phone });
    }

    /** Pre-checks whether a phone number is free to start the signup OTP flow.
     *  Lives under the public /api/auth prefix, so it works before any JWT exists
     *  (unlike checkPhoneExists, which the gateway rejects with 401 during signup). */
    async preCheckSignupPhone(phone: string): Promise<{ allowed: boolean; reason?: string }> {
        return apiClient.post('/api/auth/pre-check-signup', { phone });
    }

    async register(setupProgress: Record<string, unknown>): Promise<unknown> {
        const payload = this.buildRegistrationPayload(setupProgress);
        const result = await apiClient.post('/api/users', payload);
        // The account exists now; the scoped token has served its purpose.
        await this.clearSignupToken();
        return result;
    }

    /**
     * Transforms raw setup progress (keyed by step) into the flat
     * CreateUserDto shape the backend expects.
     *
     * Setup progress shape:
     *   { phone, otp, role, basicInfo, address, vehicles, identity,
     *     credentials, dealerInfo, expertise, availability, lastStep }
     *
     * Backend CreateUserDto expects top-level fields:
     *   { name, surname, email, phone, dob, profileImage, role, firebaseUid,
     *     addresses, vehicles, dealerInfo, expertise, credentials, availability, identity }
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
        if (progress.credentials) payload.credentials = progress.credentials;
        if (progress.availability) payload.availability = progress.availability;

        // Vehicles: strip client-generated `id` — Prisma generates UUIDs server-side
        if (vehiclesData && Array.isArray(vehiclesData) && vehiclesData.length > 0) {
            payload.vehicles = vehiclesData.map(({ id: _clientId, ...vehicleFields }) => vehicleFields);
        }

        // Identity verification: the account is linked to the Didit verification
        // started on the identity step. Required server-side — there is no path
        // to an account without one.
        const identityData = progress.identity as Record<string, unknown> | undefined;
        if (identityData?.verificationId) {
            payload.verificationId = identityData.verificationId;
        }

        return payload;
    }

    async update(id: string, updates: Partial<UserData>): Promise<void> {
        return apiClient.patch(`/api/users/${id}`, updates);
    }
}

export const userDAO = new UserDAO();
