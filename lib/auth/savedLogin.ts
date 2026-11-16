import * as SecureStore from 'expo-secure-store';

const KEY = 'mechanic_saved_email_login';

export interface SavedLogin {
    email: string;
    password: string;
}

/** Email + password the user chose to remember, kept in the device keychain (never AsyncStorage). */
export async function getSavedLogin(): Promise<SavedLogin | null> {
    try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<SavedLogin>;
        return typeof v.email === 'string' && typeof v.password === 'string'
            ? { email: v.email, password: v.password }
            : null;
    } catch {
        return null;
    }
}

export async function saveLogin(login: SavedLogin): Promise<void> {
    try {
        await SecureStore.setItemAsync(KEY, JSON.stringify(login));
    } catch {
        // Remembering is a convenience: a keychain failure must not block signing in.
    }
}

export async function clearSavedLogin(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(KEY);
    } catch {
        // nothing to clear
    }
}
