import { apiClient } from '../api/apiClient';
import { ApiError } from '../api/types';
import { ConfigService } from '../config/ConfigService';
import { mediaDAO } from './MediaDAO';

// The on-site visit (appointments-service src/on-site): check-in at the vehicle,
// captures, checklist and close-out. Every call is checked server-side against
// who is calling — the mechanic on the job, or the customer for their code.

export type OnSiteStep =
    | 'incident' | 'diagnostics-obd' | 'diagnostics-photos' | 'validating' | 'feasibility'
    | 'options-checkin' | 'buy-parts' | 'resolve' | 'options-execution'
    | 'video-out' | 'close' | 'done';

export type MediaKind =
    | 'plate' | 'dashboard' | 'walkaround_in' | 'extra_in' | 'proof' | 'walkaround_out' | 'exit_photo';

export type RedirectReasonId = 'notReported' | 'obdFlag' | 'noParts' | 'needsShop' | 'other';

export interface OnSiteMedia {
    id: string;
    kind: MediaKind;
    mediaKey: string;
    url: string;
    mediaType: 'image' | 'video';
    note: string | null;
    createdAt: string;
}

export interface ObdCode {
    code: string;
    severity: 'High' | 'Medium' | 'Low' | null;
    description: { en: string; es: string } | null;
    suggestion: { en: string; es: string } | null;
}

/** none → no report; processing → being read; ready → codes read; failed → unreadable; manual → typed in. */
export type ObdStatus = 'none' | 'processing' | 'ready' | 'failed' | 'manual';

export interface OnSiteVisit {
    appointmentId: string;
    step: OnSiteStep;
    checkedInAt: string;
    checkinMethod: 'pin' | 'qr';
    feasibility: 'yes' | 'parts' | 'no' | null;
    workStartedAt: string | null;
    workNotes: string | null;
    maintenanceChecklist: Record<string, boolean>;
    outcome: 'resolved' | 'redirected' | null;
    redirectReason: RedirectReasonId | null;
    redirectNote: string | null;
    exitSkipped: boolean;
    closedAt: string | null;
    obdStatus: ObdStatus;
    obdDocumentKey: string | null;
    obdCodes: ObdCode[];
    serviceAmount: string | null;
    /** Last time the owner was asked for a review (ISO); null if never. */
    reviewRequestedAt: string | null;
    /** The owner has reviewed the mechanic for this job. */
    ownerReviewSubmitted: boolean;
    /** Score the mechanic gave the owner, once rated. */
    clientRating: number | null;
    /** Estimated payout date (closed + 7 days). Informative: no payments yet. */
    estimatedPayoutAt: string | null;
    media: OnSiteMedia[];
}

export interface CheckInCode {
    pin: string;
    qrPayload: string;
}

export type CheckInResult =
    | { ok: true; visit: OnSiteVisit }
    | { ok: false; reason: 'mismatch' | 'locked' };

const base = (id: string) => `/api/appointments/${id}`;

/** media-service answers relative paths (/uploads/…); the app needs the full address. */
export function absoluteMediaUrl(url: string): string {
    if (url.startsWith('http')) return url;
    const baseUrl = ConfigService.getApiBaseUrl().replace(/\/+$/, '');
    return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

class OnSiteDAOImpl {
    /** Customer: the PIN and QR to show the mechanic on arrival. */
    getCheckinCode(appointmentId: string): Promise<CheckInCode> {
        return apiClient.get(`${base(appointmentId)}/check-in/code`);
    }

    /** Mechanic: check in with the typed PIN or the scanned QR text. */
    async checkIn(appointmentId: string, method: 'pin' | 'qr', code: string): Promise<CheckInResult> {
        try {
            const visit = await apiClient.post<OnSiteVisit>(`${base(appointmentId)}/check-in`, { method, code });
            return { ok: true, visit };
        } catch (e) {
            if (e instanceof ApiError && e.statusCode === 400 && e.apiMessage.includes('CHECKIN_CODE_MISMATCH')) {
                return { ok: false, reason: 'mismatch' };
            }
            if (e instanceof ApiError && e.statusCode === 429) return { ok: false, reason: 'locked' };
            throw e;
        }
    }

    /** The visit, or null before the mechanic has checked in. */
    async get(appointmentId: string): Promise<OnSiteVisit | null> {
        try {
            return await apiClient.get<OnSiteVisit>(`${base(appointmentId)}/on-site`);
        } catch (e) {
            if (e instanceof ApiError && e.statusCode === 404) return null;
            throw e;
        }
    }

    update(
        appointmentId: string,
        changes: Partial<Pick<OnSiteVisit, 'step' | 'feasibility' | 'workNotes' | 'maintenanceChecklist' | 'exitSkipped'>>,
    ): Promise<OnSiteVisit> {
        return apiClient.patch(`${base(appointmentId)}/on-site`, changes);
    }

    /** Uploads a local photo or video to media-service and attaches it to the visit. */
    async addCapture(
        appointmentId: string,
        kind: MediaKind,
        localUri: string,
        mediaType: 'image' | 'video',
        note?: string,
    ): Promise<OnSiteMedia> {
        const uploaded =
            mediaType === 'video' ? await this.uploadVideo(localUri) : await mediaDAO.uploadPhoto(localUri);
        return apiClient.post(`${base(appointmentId)}/on-site/media`, {
            kind,
            mediaKey: uploaded.key,
            mediaType,
            ...(note ? { note } : {}),
        });
    }

    removeCapture(appointmentId: string, mediaId: string): Promise<{ count: number }> {
        return apiClient.delete(`${base(appointmentId)}/on-site/media/${mediaId}`);
    }

    /** "Validating": throws with the missing photos named when plate/dashboard are absent. */
    submitDiagnostic(appointmentId: string): Promise<{ ready: true }> {
        return apiClient.post(`${base(appointmentId)}/on-site/diagnostic`, {});
    }

    close(
        appointmentId: string,
        outcome: 'resolved' | 'redirected',
        reason?: RedirectReasonId,
        note?: string,
    ): Promise<OnSiteVisit> {
        return apiClient.post(`${base(appointmentId)}/close`, {
            outcome,
            ...(reason ? { reason } : {}),
            ...(note ? { note } : {}),
        });
    }

    /**
     * Uploads an OBD scanner report (PDF or photo) and attaches it to the visit.
     * The codes are read in the background; an `obd_update` socket event says
     * when they are in.
     */
    async attachObdReport(
        appointmentId: string,
        localUri: string,
        name?: string,
        mimeType?: string,
    ): Promise<OnSiteVisit> {
        const uploaded = await mediaDAO.uploadDocument(localUri, { name, mimeType, documentType: 'obd' });
        return apiClient.post(`${base(appointmentId)}/on-site/obd`, { documentKey: uploaded.key });
    }

    /** Codes typed in by the mechanic; replaces the visit's list. */
    setObdCodes(appointmentId: string, codes: string[]): Promise<OnSiteVisit> {
        return apiClient.put(`${base(appointmentId)}/on-site/obd/codes`, { codes });
    }

    /**
     * Asks the vehicle owner, by push, to review the job. At most once every
     * 12 hours: a 429 comes back as `{ ok: false, retryAt }`.
     */
    async requestOwnerReview(
        appointmentId: string,
    ): Promise<{ ok: true; visit: OnSiteVisit } | { ok: false; retryAt: string | null }> {
        try {
            const visit = await apiClient.post<OnSiteVisit>(`${base(appointmentId)}/review-request`, {});
            return { ok: true, visit };
        } catch (e) {
            if (e instanceof ApiError && e.statusCode === 429) {
                const match = e.apiMessage.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/);
                return { ok: false, retryAt: match ? match[0] : null };
            }
            throw e;
        }
    }

    reviewClient(appointmentId: string, rating: number, review?: string): Promise<unknown> {
        return apiClient.post(`${base(appointmentId)}/client-review`, { rating, ...(review ? { review } : {}) });
    }

    private uploadVideo(localUri: string): Promise<{ key: string; url: string }> {
        const filename = localUri.split('/').pop() || 'video.mp4';
        const ext = filename.split('.').pop()?.toLowerCase() || 'mp4';
        const type = ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
        const formData = new FormData();
        formData.append('video', { uri: localUri, type, name: filename } as unknown as Blob);
        return apiClient.upload('/api/videos/upload', formData);
    }
}

export const onSiteDAO = new OnSiteDAOImpl();
