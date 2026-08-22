import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where the session lives, and how the rest of the app asks about it.
 *
 * Storage is split deliberately:
 *
 *   access_token   SecureStore — the bearer for every request.
 *   refresh_token  SecureStore — the long-lived credential; leaking it through
 *                  an unencrypted device backup would hand over a week of access.
 *   user_session   AsyncStorage — cached profile only, re-fetchable from the
 *                  token, and a record with addresses and vehicles would exceed
 *                  SecureStore's ~2KB per-value limit anyway.
 *   signup_token   AsyncStorage — short-lived, and the identity-verification
 *                  flow already reads it from there.
 *
 * SecureStore has no web implementation, so web falls back to AsyncStorage. That
 * also keeps the Playwright suites able to seed a session via localStorage.
 */
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_SESSION_KEY = "user_session";
const SIGNUP_TOKEN_KEY = "signup_token";

/** Treat a token as expired this many seconds early, to cover clock skew. */
const EXPIRY_SKEW_SECONDS = 60;

const useSecureStore = Platform.OS !== "web";

async function secureGet(key: string): Promise<string | null> {
    try {
        return useSecureStore
            ? await SecureStore.getItemAsync(key)
            : await AsyncStorage.getItem(key);
    } catch {
        return null;
    }
}

async function secureSet(key: string, value: string): Promise<void> {
    if (useSecureStore) {
        await SecureStore.setItemAsync(key, value);
        return;
    }
    await AsyncStorage.setItem(key, value);
}

async function secureDelete(key: string): Promise<void> {
    try {
        if (useSecureStore) {
            await SecureStore.deleteItemAsync(key);
            return;
        }
        await AsyncStorage.removeItem(key);
    } catch {
        // Already gone, which is the desired state.
    }
}

export interface SessionTokens {
    accessToken: string;
    refreshToken: string;
}

export async function getAccessToken(): Promise<string | null> {
    return secureGet(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
    return secureGet(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: SessionTokens): Promise<void> {
    await Promise.all([
        secureSet(ACCESS_TOKEN_KEY, tokens.accessToken),
        secureSet(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
}

export async function getSignupToken(): Promise<string | null> {
    return AsyncStorage.getItem(SIGNUP_TOKEN_KEY);
}

export async function saveSignupToken(token: string): Promise<void> {
    await AsyncStorage.setItem(SIGNUP_TOKEN_KEY, token);
}

export async function clearSignupToken(): Promise<void> {
    await AsyncStorage.removeItem(SIGNUP_TOKEN_KEY);
}

export async function getCachedUser<T>(): Promise<T | null> {
    try {
        const raw = await AsyncStorage.getItem(USER_SESSION_KEY);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

export async function saveCachedUser(user: unknown): Promise<void> {
    await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
}

/** Wipes every trace of the session. Safe to call when nothing is stored. */
export async function clearSession(): Promise<void> {
    await Promise.all([
        secureDelete(ACCESS_TOKEN_KEY),
        secureDelete(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_SESSION_KEY),
        AsyncStorage.removeItem(SIGNUP_TOKEN_KEY),
    ]);
}

/**
 * Moves an access token left behind in AsyncStorage into SecureStore.
 *
 * Runs once per install after the update. Without it, a user who was signed in
 * before this version would appear signed out purely because the token moved.
 */
export async function migrateLegacyTokenStorage(): Promise<void> {
    if (!useSecureStore) return;

    const legacy = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    if (!legacy) return;

    const existing = await secureGet(ACCESS_TOKEN_KEY);
    if (!existing) await secureSet(ACCESS_TOKEN_KEY, legacy);

    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}

/** The `exp` claim, in epoch ms, or null if the token is unreadable. */
export function decodeJwtExpiry(token: string): number | null {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;

        // base64url → base64 before decoding. atob exists in Hermes and on web.
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(
            normalized.length + ((4 - (normalized.length % 4)) % 4),
            "=",
        );
        const claims = JSON.parse(atob(padded)) as { exp?: number };

        return typeof claims.exp === "number" ? claims.exp * 1000 : null;
    } catch {
        return null;
    }
}

/**
 * Whether a token is expired, or close enough that using it would race.
 *
 * A token that cannot be decoded counts as expired: one unnecessary refresh is
 * better than a request failing for a reason the client cannot explain.
 */
export function isExpired(
    token: string,
    skewSeconds = EXPIRY_SKEW_SECONDS,
): boolean {
    const expiresAtMs = decodeJwtExpiry(token);
    if (expiresAtMs === null) return true;

    return expiresAtMs - skewSeconds * 1000 <= Date.now();
}

type ExpiryListener = () => void;

const expiryListeners = new Set<ExpiryListener>();

/**
 * Notifies the app that the session is gone and cannot be recovered.
 *
 * Pub/sub rather than a direct navigation call, for two reasons: apiClient must
 * not depend on the router, and several concurrent requests can each see a 401
 * while the user should be sent to the login screen exactly once.
 */
export function onSessionExpired(listener: ExpiryListener): () => void {
    expiryListeners.add(listener);
    return () => {
        expiryListeners.delete(listener);
    };
}

export function emitSessionExpired(): void {
    expiryListeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // One bad listener must not stop the others from tearing down.
        }
    });
}
