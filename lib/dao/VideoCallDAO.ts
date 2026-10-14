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

    getState(appointmentId: string): Promise<VideoCallState> {
        return apiClient.get(`/api/appointments/${appointmentId}/video`);
    }

    /** Mechanic: the help is done; the owner is asked to confirm. */
    finish(appointmentId: string, note?: string): Promise<VideoCallState> {
        return apiClient.post(`/api/appointments/${appointmentId}/video/finish`, note ? { note } : {});
    }

    /** Owner: confirms; the payment is charged. */
    confirm(appointmentId: string): Promise<VideoCallState> {
        return apiClient.post(`/api/appointments/${appointmentId}/video/confirm`, {});
    }

    /** Owner: it was not resolved; nothing is charged until support decides. */
    dispute(appointmentId: string, reason: string): Promise<VideoCallState> {
        return apiClient.post(`/api/appointments/${appointmentId}/video/dispute`, { reason });
    }
}

export const videoCallDAO = new VideoCallDAO();
