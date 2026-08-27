import { ConfigService } from '../config/ConfigService';
import {
    clearSession,
    emitSessionExpired,
    getAccessToken,
    getRefreshToken,
    getSignupToken,
    isExpired,
    saveTokens,
} from '../auth/session';
import { ApiError, ApiResponse } from './types';

/**
 * Routes the registration wizard drives: the gateway's signup-token allowlist,
 * plus the ASE lookup and the handover that trades the scoped token for a
 * session.
 *
 * These prefer the signup token even when a session exists. Registering on a
 * device that is still signed in — a mechanic setting up a colleague, or anyone
 * who ran the flow earlier — would otherwise complete the whole wizard as the
 * *old* user: the account is created under that session, and the final handover
 * then fails, because a session token is not a signup token.
 */
const SIGNUP_ROUTES: ReadonlyArray<RegExp> = [
    /^\/api\/photos\/upload$/,
    /^\/api\/verification\/(session|status)$/,
    /^\/api\/users$/,
    /^\/api\/users\/check-email\//,
    /^\/api\/ase-membership\/verify$/,
    /^\/api\/auth\/session\/from-signup$/,
];

function isSignupRoute(endpoint: string): boolean {
    const path = endpoint.split('?')[0];
    return SIGNUP_ROUTES.some((route) => route.test(path));
}

/**
 * Bearer token for outgoing requests.
 *
 * During registration there is no `access_token` yet — the account does not
 * exist — but the setup flow still has to upload a profile picture, run identity
 * verification, and then create the user. Those calls carry the short-lived
 * `signup_token` instead; the gateway accepts it on exactly those routes.
 *
 * A real session wins everywhere else, but never on a wizard route: there the
 * signup token is the point, so it goes first whenever one is present.
 */
async function getAuthHeaders(
    endpoint: string,
): Promise<Record<string, string>> {
    try {
        if (isSignupRoute(endpoint)) {
            const signupToken = await getSignupToken();
            if (signupToken) return { Authorization: `Bearer ${signupToken}` };
        }

        const token = await getAccessToken();
        if (token) return { Authorization: `Bearer ${token}` };

        const signupToken = await getSignupToken();
        return signupToken ? { Authorization: `Bearer ${signupToken}` } : {};
    } catch {
        return {};
    }
}

/** Auth endpoints must never trigger a refresh — that is what causes loops. */
function isAuthEndpoint(endpoint: string): boolean {
    return endpoint.startsWith('/api/auth');
}

/**
 * In-flight refresh, shared by every caller that needs one.
 *
 * Without this, a screen that fires five requests on mount would, on an expired
 * token, send five refreshes. Rotation is single-use, so the first would succeed
 * and the other four would present an already-spent token — which the backend
 * treats as a replay and answers by revoking the whole session. The user would be
 * logged out by their own app opening a screen.
 */
let refreshInFlight: Promise<boolean> | null = null;

/** True if a usable access token is now stored. */
async function ensureFreshSession(): Promise<boolean> {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        try {
            const refreshToken = await getRefreshToken();
            if (!refreshToken) return false;

            await ConfigService.init();
            const response = await fetch(
                buildUrl(ConfigService.getApiBaseUrl(), '/api/auth/refresh'),
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                },
            );

            if (!response.ok) return false;

            const body = (await response.json()) as ApiResponse<{
                accessToken: string;
                refreshToken: string;
            }>;
            if (!body.success) return false;

            await saveTokens({
                accessToken: body.data.accessToken,
                refreshToken: body.data.refreshToken,
            });
            return true;
        } catch {
            return false;
        } finally {
            // Cleared in `finally` so a failed refresh does not wedge every
            // later request onto a permanently rejected promise.
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
}

/** Ends the session once, however many requests discovered it was gone. */
let expiryAnnounced = false;

async function abandonSession(): Promise<void> {
    await clearSession();
    if (expiryAnnounced) return;

    expiryAnnounced = true;
    emitSessionExpired();
    // Re-armed on a short delay so a later, legitimate expiry still notifies.
    setTimeout(() => {
        expiryAnnounced = false;
    }, 5000);
}

/**
 * Runs a request, refreshing the session once if the token turns out to be dead.
 *
 * Pre-flight check first: an access token we can already see is expired is not
 * worth spending a round trip on.
 */
async function withSession<T>(
    endpoint: string,
    send: () => Promise<T>,
): Promise<T> {
    if (isAuthEndpoint(endpoint)) return send();

    const token = await getAccessToken();
    if (token && isExpired(token)) {
        const refreshed = await ensureFreshSession();
        if (!refreshed) {
            await abandonSession();
            throw new ApiError(401, 'Session expired', { code: 'SESSION_EXPIRED' });
        }
    }

    try {
        return await send();
    } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;

        // A signup-scoped request has no refresh token behind it; a 401 there is
        // the scoped token expiring, and re-running the wizard step is the fix.
        if (!(await getRefreshToken())) throw error;

        const refreshed = await ensureFreshSession();
        if (!refreshed) {
            await abandonSession();
            throw error;
        }

        return send();
    }
}

/**
 * Safely joins baseUrl and endpoint, preventing double-slash issues.
 * e.g. buildUrl('https://host.com/', '/api/users') → 'https://host.com/api/users'
 */
function buildUrl(baseUrl: string, endpoint: string): string {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${normalizedBase}${normalizedEndpoint}`;
}

/** Query params accepted by `apiClient.get`. `undefined` values are dropped. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

/** Appends a query string, skipping params the caller left undefined. */
function withQuery(endpoint: string, params?: QueryParams): string {
    if (!params) return endpoint;
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) search.append(key, String(value));
    });
    const qs = search.toString();
    if (!qs) return endpoint;
    return endpoint.includes('?') ? `${endpoint}&${qs}` : `${endpoint}?${qs}`;
}

/**
 * Parses the standardized API envelope and returns only the `data` field.
 *
 * All backend endpoints return:
 *   Success → { success: true,  message: string, data: T }
 *   Error   → { success: false, message: string, error: string }
 *
 * This function acts as the single unwrapping point so that every DAO
 * receives clean domain data without knowing about the envelope.
 */
async function unwrapResponse<T>(response: Response, method: string, endpoint: string): Promise<T> {
    let body: ApiResponse<T>;

    try {
        body = await response.json();
    } catch {
        throw new Error(`${method} ${endpoint}: Failed to parse response body (status ${response.status})`);
    }

    // The API may return non-2xx with the standard envelope — handle both cases.
    if (!response.ok || !body.success) {
        const apiMessage = body.message ?? response.statusText;
        const apiError = 'error' in body ? body.error : 'Unknown error';
        throw new ApiError(response.status, apiMessage, apiError);
    }

    return body.data as T;
}

/** One place that actually performs a request, so every verb behaves the same. */
async function send<T>(
    method: string,
    endpoint: string,
    init: Omit<RequestInit, 'method'> = {},
): Promise<T> {
    await ConfigService.init();
    const authHeaders = await getAuthHeaders(endpoint);
    const url = buildUrl(ConfigService.getApiBaseUrl(), endpoint);

    console.log(`[apiClient] ${method} ${url}`);

    let response: Response;
    try {
        response = await fetch(url, {
            ...init,
            method,
            headers: { ...(init.headers ?? {}), ...authHeaders },
        });
    } catch (error) {
        console.log(`[apiClient] transport failure for ${url}:`, error);
        throw error;
    }

    return unwrapResponse<T>(response, method, endpoint);
}

/**
 * A usable access token, refreshing first if the stored one is spent.
 *
 * For callers that authenticate outside the request path — the WebSocket
 * handshake, which carries the token once at connect time and cannot retry with
 * a fresh one mid-connection. Reuses the shared in-flight refresh so a socket
 * reconnecting while screens are loading does not race the rotation and get the
 * whole session revoked as a replay.
 *
 * Returns null when there is no recoverable session; the caller should not
 * connect. Deliberately does NOT announce expiry — a socket failing to connect
 * is not on its own proof the session is gone, and apiClient's next 401 is.
 */
export async function getFreshAccessToken(): Promise<string | null> {
    try {
        const token = await getAccessToken();
        if (token && !isExpired(token)) return token;

        if (!(await getRefreshToken())) return null;
        if (!(await ensureFreshSession())) return null;

        return getAccessToken();
    } catch {
        return null;
    }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const apiClient = {
    async get<T = unknown>(endpoint: string, params?: QueryParams): Promise<T> {
        const path = withQuery(endpoint, params);
        return withSession(path, () => send<T>('GET', path));
    },

    async post<T = unknown>(endpoint: string, data: unknown): Promise<T> {
        return withSession(endpoint, () =>
            send<T>('POST', endpoint, {
                headers: JSON_HEADERS,
                body: JSON.stringify(data),
            }),
        );
    },

    async patch<T = unknown>(endpoint: string, data: unknown): Promise<T> {
        return withSession(endpoint, () =>
            send<T>('PATCH', endpoint, {
                headers: JSON_HEADERS,
                body: JSON.stringify(data),
            }),
        );
    },

    async delete<T = unknown>(endpoint: string): Promise<T> {
        return withSession(endpoint, () => send<T>('DELETE', endpoint));
    },

    async upload<T = unknown>(endpoint: string, formData: FormData): Promise<T> {
        // No Content-Type: fetch sets it along with the multipart boundary.
        return withSession(endpoint, () =>
            send<T>('POST', endpoint, { body: formData }),
        );
    },
};
