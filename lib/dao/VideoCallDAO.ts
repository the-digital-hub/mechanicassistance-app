import { apiClient } from '../api/apiClient';
import { ApiError } from '../api/types';

// Video-call assistance (appointments-service src/video-calls). A video call is
// remote: it has no check-in, PIN, QR or on-site close-out. Booking reads the
// availability below; it ends when the mechanic finishes it and the owner
// confirms (or disputes) it.

/** "Now" option of the When screen. */
export interface VideoCallNow {
    /** Mechanics marked "available" right now. */
    mechanicsOnline: number;
    /** Typical minutes until pick-up; null without enough history — hide it then. */
    estimatedWaitMinutes: number | null;
    /** Minutes the call lasts before the owner has to extend it; missing on older backends. */
    baseMinutes?: number;
    /** The menu the owner picks from: base price in USD (before time band and tax). Missing on older backends. */
    durations?: VideoCallDuration[];
}

export interface VideoCallDuration {
    minutes: number;
    price: number;
}

export type SlotPeriod = 'morning' | 'afternoon' | 'evening';
export type SlotUnavailableReason = 'past' | 'full' | 'no_mechanics';

export interface VideoCallSlot {
    /** ISO 8601 UTC; send exactly this as `date` to book it. */
    start: string;
    /** Local "HH:mm" in the zone asked for. */
    time: string;
    period: SlotPeriod;
    available: boolean;
    reason?: SlotUnavailableReason;
}

export interface VideoCallSlotDay {
    /** Local "YYYY-MM-DD". */
    date: string;
    weekday: string;
    slots: VideoCallSlot[];
}

export interface VideoCallSlots {
    timezone: string;
    days: VideoCallSlotDay[];
}

/** Appointment statuses only a video call goes through. */
export const VIDEO_CALL_STATUS = {
    awaitingConfirmation: 'awaiting_confirmation',
    disputed: 'disputed',
} as const;

export interface VideoCallState {
    appointmentId: string;
    /** accepted | in_progress | awaiting_confirmation | disputed | completed */
    status: string;
    /** On completed: "completed" (charged) or "not_resolved" (released). */
    currentStatus: string | null;
    finishedAt: string | null;
    finishNote: string | null;
    /** Unanswered past this, it is confirmed and charged automatically. */
    confirmDeadline: string | null;
    confirmedAt: string | null;
    confirmedBy: 'owner' | 'auto' | null;
    disputedAt: string | null;
    disputeReason: string | null;
    resolvedAt: string | null;
    resolution: 'capture' | 'release' | null;
    /** When both sides were first connected in the call; null until then. */
    callStartedAt: string | null;
    /** Seconds since callStartedAt, measured by the server when it answered. */
    elapsedSeconds: number | null;
    /** Minutes the call lasts before any extension (set from the hub; 45 by default). */
    baseMinutes?: number;
    /** Base plus every extension the owner bought: the timer counts down from this. */
    contractedMinutes?: number;
    extensionsUsed?: number;
    maxExtensions?: number;
    /** When the video room closes (unix seconds). */
    roomExpiryUnixSec?: number | null;
    /**
     * callStartedAt on this phone's clock (epoch ms), derived from
     * elapsedSeconds when the answer arrived, so a phone whose clock is off
     * still counts the same time as the other side. Null until started.
     */
    startedAtLocalMs: number | null;
}

type VideoCallStateResponse = Omit<VideoCallState, 'startedAtLocalMs'>;


/** The server's transcript of a call. */
export interface VideoTranscript {
    appointmentId: string;
    language?: string;
    lines: { id: string; role: 'owner' | 'mechanic'; name?: string; text: string; at: string }[];
}

/** A block of extra time the owner can buy, priced for this call. */
export interface VideoExtensionOption {
    id: string;
    minutes: number;
    /** Decimal string, "20.00". */
    price: string;
    currency: string;
}

export interface VideoExtension {
    id: string;
    appointmentId: string;
    minutesAdded: number;
    /** Owner only. */
    amount?: string;
    currency?: string;
    paymentMethodId?: string | null;
    /**
     * held | captured | released | unpaid add time. failed | pending do not, and neither do the
     * three the technician's approval adds: requested (waiting for the technician, nothing held),
     * declined and expired.
     */
    status: 'pending' | 'requested' | 'declined' | 'expired' | 'held' | 'failed' | 'captured' | 'released' | 'unpaid';
    /** requested only: until when the technician can answer (ISO). */
    expiresAt?: string | null;
    failureCode?: string | null;
    timestamp: string;
    newExpiryUnixSec: number | null;
}

/** An extra-time request still waiting for the technician (both sides see it; never with amounts). */
export interface PendingExtensionRequest {
    extensionId: string;
    minutes: number;
    /** ISO: the technician can answer until then (never past the end of the call). */
    expiresAt: string;
    requestedAt: string;
}

export interface VideoExtensions {
    appointmentId: string;
    /** The request waiting for the technician, if any. With one pending, `options` comes empty. */
    pendingRequest?: PendingExtensionRequest | null;
    baseMinutes: number;
    maxExtensions: number;
    extensionsUsed: number;
    contractedMinutes: number;
    /** Empty for the mechanic, at the limit, or when the call is not running. */
    options: VideoExtensionOption[];
    extensions: VideoExtension[];
}

function withLocalStart(state: VideoCallStateResponse): VideoCallState {
    const elapsed = state.elapsedSeconds;
    return {
        ...state,
        startedAtLocalMs: typeof elapsed === 'number' ? Date.now() - elapsed * 1000 : null,
    };
}

/** The device's IANA zone, e.g. "America/New_York". */
export function deviceTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
        return 'America/New_York';
    }
}

export class VideoCallDAO {
    getNow(): Promise<VideoCallNow> {
        return apiClient.get('/api/video-call/now');
    }

    getSlots(timezone = deviceTimeZone(), days = 14): Promise<VideoCallSlots> {
        return apiClient.get('/api/video-call/slots', { timezone, days });
    }

    async getState(appointmentId: string): Promise<VideoCallState> {
        return withLocalStart(await apiClient.get<VideoCallStateResponse>(`/api/appointments/${appointmentId}/video`));
    }

    /**
     * Either side: the other participant is now in the call. Records when the
     * session started; the first call wins, so both phones may send it.
     */
    async markStarted(appointmentId: string): Promise<VideoCallState> {
        return withLocalStart(await apiClient.post<VideoCallStateResponse>(`/api/appointments/${appointmentId}/video/started`, {}));
    }

    /** Mechanic: the help is done; the owner is asked to confirm. */
    async finish(appointmentId: string, note?: string): Promise<VideoCallState> {
        return withLocalStart(await apiClient.post<VideoCallStateResponse>(`/api/appointments/${appointmentId}/video/finish`, note ? { note } : {}));
    }

    /** Owner: confirms; the payment is charged. */
    async confirm(appointmentId: string): Promise<VideoCallState> {
        return withLocalStart(await apiClient.post<VideoCallStateResponse>(`/api/appointments/${appointmentId}/video/confirm`, {}));
    }

    /** Owner, during the call: ends it and confirms it at once; the payment is charged. */
    async ownerFinish(appointmentId: string): Promise<VideoCallState> {
        return withLocalStart(await apiClient.post<VideoCallStateResponse>(`/api/appointments/${appointmentId}/video/owner-finish`, {}));
    }

    /**
     * The saved transcript of the call, as the server keeps it; null while it has none (404: no transcript yet,
     * or the backend does not offer it). `role` tells who spoke.
     */
    async getTranscript(appointmentId: string): Promise<VideoTranscript | null> {
        try {
            return await apiClient.get<VideoTranscript>(`/api/appointments/${appointmentId}/video/transcript`);
        } catch (err) {
            if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 403)) return null;
            throw err;
        }
    }

    /**
     * Sends what this phone heard (`PUT …/video/transcript`). The server keeps one line per `id` (the other phone may
     * send the same ones) and decides who spoke from `speakerId`; `role` is only its fallback. Answers `stored`, or
     * `consent_required` (409) with what is still missing, in which case nothing was saved.
     */
    async putTranscript(
        appointmentId: string,
        body: { language: string; lines: { id: string; speakerId?: string; role: 'owner' | 'mechanic'; name: string; text: string; at: string }[] },
    ): Promise<{ status: 'stored' } | { status: 'consent_required'; missing: string[] }> {
        try {
            await apiClient.put(`/api/appointments/${appointmentId}/video/transcript`, body);
            return { status: 'stored' };
        } catch (err) {
            if (err instanceof ApiError && err.statusCode === 409) {
                const payload = err.apiError as { missing?: unknown; details?: { missing?: unknown } } | null;
                const missing = payload?.missing ?? payload?.details?.missing;
                return { status: 'consent_required', missing: Array.isArray(missing) ? missing.map(String) : [] };
            }
            throw err;
        }
    }

    /** Extra time of the call; the owner also gets the blocks on sale with their prices. */
    getExtensions(appointmentId: string): Promise<VideoExtensions> {
        return apiClient.get(`/api/appointments/${appointmentId}/video/extensions`);
    }

    /**
     * Owner: buys `minutes` more. The price is held on the wallet or card
     * (`paymentMethodId`, else how the call is paid) and charged with the call.
     * 402 `insufficient_funds` / `card_declined`: nothing added — retry with a
     * NEW `idempotencyKey`; the same key only repeats the first answer.
     */
    async extend(appointmentId: string, minutes: number, idempotencyKey: string, paymentMethodId?: string): Promise<VideoExtension> {
        const url = `/api/appointments/${appointmentId}/video/extensions`;
        const body = { minutes, idempotencyKey, ...(paymentMethodId ? { paymentMethodId } : {}) };
        // `requireApproval`: with the Hub's switch on, the request goes to the technician first
        // (status `requested`, nothing held); without it the time is bought at once, as before.
        try {
            return await apiClient.post(url, { ...body, requireApproval: true });
        } catch (error) {
            // A backend that does not know the field yet answers 400 "should not exist": buy at once.
            if (error instanceof ApiError && error.statusCode === 400 && /should not exist/i.test(error.apiMessage ?? error.message)) {
                return apiClient.post(url, body);
            }
            throw error;
        }
    }

    /** Technician: accepts a requested extension; only now the owner's money is held and the time added. */
    acceptExtension(appointmentId: string, extensionId: string): Promise<VideoExtension> {
        return apiClient.post(`/api/appointments/${appointmentId}/video/extensions/${extensionId}/accept`, {});
    }

    /** Technician: turns a requested extension down. Nothing is charged. */
    declineExtension(appointmentId: string, extensionId: string, reason?: string): Promise<VideoExtension> {
        return apiClient.post(`/api/appointments/${appointmentId}/video/extensions/${extensionId}/decline`, reason ? { reason } : {});
    }

    /** Owner: it was not resolved; nothing is charged until support decides. */
    async dispute(appointmentId: string, reason: string): Promise<VideoCallState> {
        return withLocalStart(await apiClient.post<VideoCallStateResponse>(`/api/appointments/${appointmentId}/video/dispute`, { reason }));
    }
}

export const videoCallDAO = new VideoCallDAO();
