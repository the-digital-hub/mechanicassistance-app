import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConfigService } from '../config/ConfigService';
import { ApiError, ApiResponse } from './types';

/**
 * Bearer token for outgoing requests.
 *
 * During registration there is no `access_token` yet — the account does not
 * exist — but the setup flow still has to upload a profile picture and an
 * identity document, and then create the user. Those calls carry the short-lived
 * `signup_token` issued by /api/auth/signup-token instead; the gateway accepts
 * it on exactly those routes. A real session always wins over it.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
    try {
        const token = await AsyncStorage.getItem('access_token');
        if (token) return { Authorization: `Bearer ${token}` };

        const signupToken = await AsyncStorage.getItem('signup_token');
        return signupToken ? { Authorization: `Bearer ${signupToken}` } : {};
    } catch {
        return {};
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

export const apiClient = {
    async get<T = unknown>(endpoint: string, params?: QueryParams): Promise<T> {
        await ConfigService.init();
        const baseUrl = ConfigService.getApiBaseUrl();
        const authHeaders = await getAuthHeaders();
        const path = withQuery(endpoint, params);
        const response = await fetch(buildUrl(baseUrl, path), {
            headers: { ...authHeaders },
        });
        return unwrapResponse<T>(response, 'GET', path);
    },

    async post<T = unknown>(endpoint: string, data: unknown): Promise<T> {
        await ConfigService.init();
        const baseUrl = ConfigService.getApiBaseUrl();
        const authHeaders = await getAuthHeaders();
        const response = await fetch(buildUrl(baseUrl, endpoint), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(data),
        });
        return unwrapResponse<T>(response, 'POST', endpoint);
    },

    async patch<T = unknown>(endpoint: string, data: unknown): Promise<T> {
        await ConfigService.init();
        const baseUrl = ConfigService.getApiBaseUrl();
        const authHeaders = await getAuthHeaders();
        const response = await fetch(buildUrl(baseUrl, endpoint), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify(data),
        });
        return unwrapResponse<T>(response, 'PATCH', endpoint);
    },

    async delete<T = unknown>(endpoint: string): Promise<T> {
        await ConfigService.init();
        const baseUrl = ConfigService.getApiBaseUrl();
        const authHeaders = await getAuthHeaders();
        const response = await fetch(buildUrl(baseUrl, endpoint), {
            method: 'DELETE',
            headers: { ...authHeaders },
        });
        return unwrapResponse<T>(response, 'DELETE', endpoint);
    },

    async upload<T = unknown>(endpoint: string, formData: FormData): Promise<T> {
        await ConfigService.init();
        const baseUrl = ConfigService.getApiBaseUrl();
        const authHeaders = await getAuthHeaders();
        // Do NOT set Content-Type — fetch sets it automatically with the multipart boundary
        const response = await fetch(buildUrl(baseUrl, endpoint), {
            method: 'POST',
            headers: { ...authHeaders },
            body: formData,
        });
        return unwrapResponse<T>(response, 'POST', endpoint);
    },
};
