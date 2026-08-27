import { apiClient } from '../api/apiClient';
import { ConfigService } from '../config/ConfigService';

interface UploadedFile {
  key: string;
  url: string;
}

/** Kept as an alias so existing callers of uploadPhoto() keep their type name. */
type UploadedPhoto = UploadedFile;

/**
 * Extension → MIME. iOS can hand back heic, webp or jpeg for a photo, and the
 * document picker adds pdf. media-service validates the MIME, not the extension,
 * so getting this wrong is a 415.
 */
const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function mimeFor(filename: string, fallback = 'image/jpeg'): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? fallback;
}

class MediaDAOImpl {
  /**
   * Uploads a local image file to the media-service.
   * Returns the storage key and public URL for the uploaded photo.
   */
  async uploadPhoto(localUri: string): Promise<UploadedPhoto> {
    const filename = localUri.split('/').pop() || 'photo.jpg';

    return this.upload('/api/photos/upload', 'photo', {
      uri: localUri,
      name: filename,
      type: mimeFor(filename),
    });
  }

  /**
   * Uploads a legal document (mechanic liability insurance / business licence).
   *
   * Separate endpoint from photos on purpose: `/api/documents/upload` accepts
   * PDFs and allows 10 MB, `/api/photos/upload` is images only at 5 MB.
   */
  async uploadDocument(
    localUri: string,
    options?: { name?: string; mimeType?: string },
  ): Promise<UploadedFile> {
    const filename = options?.name || localUri.split('/').pop() || 'document.pdf';

    return this.upload('/api/documents/upload', 'document', {
      uri: localUri,
      name: filename,
      // The picker usually reports the MIME itself; fall back to the extension.
      type: options?.mimeType || mimeFor(filename, 'application/pdf'),
    });
  }

  /**
   * media-service answers with a relative `/uploads/<key>` url. Absolutize it
   * here so callers can store it and render it without knowing about the API
   * base — which changes with the environment.
   */
  private async upload(
    endpoint: string,
    field: string,
    file: { uri: string; name: string; type: string },
  ): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append(field, file as any);

    const result = await apiClient.upload<UploadedFile>(endpoint, formData);

    if (result.url?.startsWith('/')) {
      const base = ConfigService.getApiBaseUrl().replace(/\/+$/, '');
      result.url = `${base}${result.url}`;
    }

    return result;
  }
}

export const mediaDAO = new MediaDAOImpl();
