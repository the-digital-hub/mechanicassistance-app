import { apiClient } from '../api/apiClient';
import { ConfigService } from '../config/ConfigService';
import { AssistanceRequest, IAssistanceDAO } from './interfaces';

export class AssistanceDAO implements IAssistanceDAO {
    async getAll(filters?: { userId?: string; mechanicId?: string; status?: string; zip?: string; lat?: number; lng?: number; radiusKm?: number }): Promise<AssistanceRequest[]> {
        let url = '/api/assistance';
        if (filters) {
            const params = new URLSearchParams(filters as any);
            url += `?${params.toString()}`;
        }
        return apiClient.get(url);
    }

    async getById(id: string): Promise<AssistanceRequest | null> {
        return apiClient.get(`/api/assistance/${id}`);
    }

    async updateStatus(id: string, mechanicId: string, status: string, extra?: { eta?: string; price?: string }): Promise<void> {
        return apiClient.patch(`/api/assistance/${id}`, { mechanicId, status, ...extra });
    }

    async create(request: Partial<AssistanceRequest>): Promise<AssistanceRequest> {
        return apiClient.post('/api/assistance', request);
    }

    /**
     * Uploads a local image URI to S3 and returns the permanent URL.
     * React Native FormData accepts { uri, type, name } as a file object.
     */
    async uploadPhoto(localUri: string): Promise<string> {
        const filename = localUri.split('/').pop() || 'photo.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

        const formData = new FormData();
        formData.append('photo', { uri: localUri, type: mimeType, name: filename } as any);

        const result = await apiClient.upload<{ key: string; url: string }>('/api/photos/upload', formData);
        return this.absoluteUrl(result.url);
    }

    /**
     * Uploads a local video URI and returns the permanent URL. Same contract as
     * `uploadPhoto`, but the media service caps videos at 50 MB and only accepts
     * mp4 / mov / webm.
     */
    async uploadVideo(localUri: string): Promise<string> {
        const filename = localUri.split('/').pop() || 'video.mp4';
        const ext = filename.split('.').pop()?.toLowerCase() || 'mp4';
        const mimeType =
            ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';

        const formData = new FormData();
        formData.append('video', { uri: localUri, type: mimeType, name: filename } as any);

        const result = await apiClient.upload<{ key: string; url: string }>('/api/videos/upload', formData);
        return this.absoluteUrl(result.url);
    }

    /** Media service returns a relative path (/uploads/filename); make it absolute. */
    private absoluteUrl(url: string): string {
        const baseUrl = ConfigService.getApiBaseUrl();
        return url.startsWith('http') ? url : `${baseUrl}${url}`;
    }
}

export const assistanceDAO = new AssistanceDAO();
