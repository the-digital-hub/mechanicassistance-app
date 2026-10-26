import { apiClient } from '../api/apiClient';

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
    /** Seconds the call keeps going after its time is up before the server ends it (set from the hub; 120 by default). */
    graceSeconds?: number;
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
    /** held | captured | released | unpaid add time; failed | pending do not. */
    status: 'pending' | 'held' | 'failed' | 'captured' | 'released' | 'unpaid';
    failureCode?: string | null;
    timestamp: string;
    newExpiryUnixSec: number | null;
}

export interface VideoExtensions {
    appointmentId: string;
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
    extend(appointmentId: string, minutes: number, idempotencyKey: string, paymentMethodId?: string): Promise<VideoExtension> {
        return apiClient.post(`/api/appointments/${appointmentId}/video/extensions`, {
            minutes,
            idempotencyKey,
            ...(paymentMethodId ? { paymentMethodId } : {}),
        });
    }

    /** Owner: it was not resolved; nothing is charged until support decides. */
    async dispute(appointmentId: string, reason: string): Promise<VideoCallState> {
        return withLocalStart(await apiClient.post<VideoCallStateResponse>(`/api/appointments/${appointmentId}/video/dispute`, { reason }));
    }
}

export const videoCallDAO = new VideoCallDAO();
