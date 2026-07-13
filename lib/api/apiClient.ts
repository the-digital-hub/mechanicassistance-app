import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConfigService } from '../config/ConfigService';
import { ApiError, ApiResponse } from './types';

async function getAuthHeaders(): Promise<Record<string, string>> {
    try {
        const token = await AsyncStorage.getItem('access_token');
        return token ? { Authorization: `Bearer ${token}` } : {};
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
    async get<T = unknown>(endpoint: string): Promise<T> {
        await ConfigService.init();
        const baseUrl = ConfigService.getApiBaseUrl();
        const authHeaders = await getAuthHeaders();
        const response = await fetch(buildUrl(baseUrl, endpoint), {
            headers: { ...authHeaders },
        });
        return unwrapResponse<T>(response, 'GET', endpoint);
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
