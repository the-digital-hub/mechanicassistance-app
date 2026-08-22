import {
    clearSession,
    getAccessToken,
    getCachedUser,
    getRefreshToken,
    isExpired,
    migrateLegacyTokenStorage,
    onSessionExpired,
    saveCachedUser,
} from '@/lib/auth/session';
import { userDAO } from '@/lib/dao/UserDAO';
import { UserData } from '@/lib/dao/interfaces';
import { firebaseSignOut } from '@/lib/firebase/auth';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

export type { UserData } from '@/lib/dao/interfaces';

interface UserContextType {
    user: UserData | null;
    isLoading: boolean;
    /** Google/Apple sign-in: pass the Firebase ID token. */
    login: (firebaseIdToken: string, phone?: string) => Promise<boolean>;
    /** Adopts a session whose tokens are already stored — the OTP path. */
    adoptSession: (user: UserData) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (updates: Partial<UserData>, syncToBackend?: boolean) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const bootstrapped = useRef(false);

    /**
     * Restores the session on startup.
     *
     * Order matters, and the second step is the one that stops an app update
     * from signing everybody out:
     *
     *   1. Move a token left behind in AsyncStorage into SecureStore.
     *   2. An access token with no refresh token beside it is a session from
     *      before refresh tokens existed. Exchange it for a proper pair rather
     *      than treating it as unusable.
     *   3. An expired access token with a live refresh token only needs a
     *      refresh, which the API client performs on its first request.
     *   4. Otherwise there is no session.
     *
     * This also fixes a real bug in the previous version: with no Firebase
     * session it restored the cached profile *without any token*, so the UI
     * looked signed in while every request quietly 401'd.
     */
    useEffect(() => {
        if (bootstrapped.current) return;
        bootstrapped.current = true;

        let cancelled = false;

        const restore = async () => {
            try {
                await migrateLegacyTokenStorage();

                const [accessToken, refreshToken] = await Promise.all([
                    getAccessToken(),
                    getRefreshToken(),
                ]);

                if (!accessToken && !refreshToken) {
                    await clearSession();
                    if (!cancelled) setUser(null);
                    return;
                }

                if (accessToken && !refreshToken) {
                    // Pre-refresh-token session. One call keeps the user signed in.
                    try {
                        const upgraded = await userDAO.exchangeLegacySession();
                        if (!cancelled) setUser(upgraded);
                    } catch (error) {
                        console.warn('[UserContext] Legacy session could not be upgraded:', error);
                        await clearSession();
                        if (!cancelled) setUser(null);
                    }
                    return;
                }

                // Show the cached profile immediately rather than blocking on the
                // network; a stale name is better than a blank screen.
                const cached = await getCachedUser<UserData>();
                if (cached && !cancelled) setUser(cached);

                // An expired access token is fine as long as a refresh token
                // exists — the API client renews on its first request. With
                // neither usable, there is nothing to restore.
                if ((!accessToken || isExpired(accessToken)) && !refreshToken) {
                    await clearSession();
                    if (!cancelled) setUser(null);
                }
            } catch (error) {
                console.error('[UserContext] Session restore failed:', error);
                await clearSession();
                if (!cancelled) setUser(null);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void restore();

        return () => {
            cancelled = true;
        };
    }, []);

    /**
     * Tears down local state when the API client reports the session is
     * unrecoverable, so the UI cannot keep rendering as though signed in.
     */
    useEffect(() => onSessionExpired(() => setUser(null)), []);

    /** Google/Apple sign-in. Phone sign-in uses `adoptSession` instead. */
    const login = async (firebaseIdToken: string, phone?: string): Promise<boolean> => {
        try {
            const userData = await userDAO.loginWithFirebase(firebaseIdToken, phone);
            if (userData) {
                setUser(userData);
                await saveCachedUser(userData);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login failed', error);
            return false;
        }
    };

    /**
     * Adopts a session the OTP flow has already established.
     *
     * `lib/auth/otp.ts` stores the tokens while verifying, because they arrive in
     * the same response. This is what puts the user into React state.
     */
    const adoptSession = async (userData: UserData): Promise<void> => {
        setUser(userData);
        await saveCachedUser(userData);
    };

    const logout = async () => {
        setUser(null);
        // Revokes the whole rotation family server-side, so the refresh token is
        // useless even if it was copied off the device.
        await userDAO.logout();
        try {
            await firebaseSignOut();
        } catch {
            // Ignore Firebase sign-out errors (e.g. already signed out).
        }
    };

    const updateUser = async (updates: Partial<UserData>, syncToBackend: boolean = true) => {
        if (!user) return;
        try {
            if (syncToBackend) {
                await userDAO.update(user.id, updates);
            }
            const newUser = { ...user, ...updates };
            setUser(newUser);
            await saveCachedUser(newUser);
        } catch (error) {
            // Rethrow: swallowing this left the UI reporting success while the
            // local state kept the old values (e.g. a picked profile photo that
            // never reached the backend). Callers must handle the failure.
            console.error('Failed to update user', error);
            throw error;
        }
    };

    return (
        <UserContext.Provider value={{ user, isLoading, login, adoptSession, logout, updateUser }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
