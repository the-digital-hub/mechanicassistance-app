import { userDAO } from '@/lib/dao/UserDAO';
import { UserData } from '@/lib/dao/interfaces';
import { firebaseSignOut } from '@/lib/firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

export type { UserData } from '@/lib/dao/interfaces';

interface UserContextType {
    user: UserData | null;
    isLoading: boolean;
    /** Pass the Firebase ID token obtained after OTP verification */
    login: (firebaseIdToken: string, phone?: string) => Promise<boolean>;
    logout: () => Promise<void>;
    updateUser: (updates: Partial<UserData>, syncToBackend?: boolean) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const initialCheckDone = useRef(false);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        try {
            unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
                // Only restore the session on the initial startup check.
                // Post-login state is managed by the explicit login() call in the OTP flow.
                if (initialCheckDone.current) return;
                initialCheckDone.current = true;

                if (firebaseUser) {
                    try {
                        const idToken = await firebaseUser.getIdToken();
                        const userData = await userDAO.loginWithFirebase(idToken);
                        if (userData) {
                            setUser(userData);
                            await AsyncStorage.setItem('user_session', JSON.stringify(userData));
                        } else {
                            // Firebase session valid but phone not registered in our DB
                            setUser(null);
                            await AsyncStorage.removeItem('user_session');
                        }
                    } catch (error) {
                        console.error('[UserContext] Session restore failed:', error);
                        setUser(null);
                        await AsyncStorage.removeItem('user_session');
                    }
                } else {
                    // No Firebase session — restore from AsyncStorage cache if available
                    try {
                        const stored = await AsyncStorage.getItem('user_session');
                        if (stored) {
                            setUser(JSON.parse(stored));
                        } else {
                            setUser(null);
                        }
                    } catch {
                        setUser(null);
                        await AsyncStorage.removeItem('user_session');
                    }
                }
                setIsLoading(false);
            });
        } catch (err) {
            // Firebase unavailable (e.g. web browser without native modules).
            // Fall back to AsyncStorage-cached session so the app still loads.
            console.warn('[UserContext] Firebase auth unavailable, using cached session:', err);
            AsyncStorage.getItem('user_session')
                .then(stored => {
                    if (stored) {
                        try { setUser(JSON.parse(stored)); } catch { setUser(null); }
                    } else {
                        setUser(null);
                    }
                })
                .catch(() => setUser(null))
                .finally(() => setIsLoading(false));
        }

        return () => unsubscribe?.();
    }, []);

    /** Authenticates with the backend by sending the Firebase ID token.
     *  The backend verifies the token, extracts the phone number, and returns the user record.
     */
    const login = async (firebaseIdToken: string, phone?: string): Promise<boolean> => {
        try {
            const userData = await userDAO.loginWithFirebase(firebaseIdToken, phone);
            if (userData) {
                setUser(userData);
                await AsyncStorage.setItem('user_session', JSON.stringify(userData));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login failed', error);
            return false;
        }
    };

    const logout = async () => {
        setUser(null);
        await AsyncStorage.removeItem('user_session');
        await AsyncStorage.removeItem('access_token');
        try {
            await firebaseSignOut();
        } catch {
            // Ignore Firebase sign-out errors (e.g. already signed out)
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
            await AsyncStorage.setItem('user_session', JSON.stringify(newUser));
        } catch (error) {
            // Rethrow: swallowing this left the UI reporting success while the
            // local state kept the old values (e.g. a picked profile photo that
            // never reached the backend). Callers must handle the failure.
            console.error('Failed to update user', error);
            throw error;
        }
    };

    return (
        <UserContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
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
