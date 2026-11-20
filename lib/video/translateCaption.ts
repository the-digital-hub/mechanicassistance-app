import { ApiError } from '@/lib/api/types';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';

/**
 * Live translation of captions. Off until the backend ships `POST /appointments/:id/video/translate` (backlog item V)
 * and product decides the cost and the consent text: with this false the call screen shows no switch and sends nothing.
 */
export const CAPTION_TRANSLATION_ENABLED = false;

/** Why a line did not come back translated: shown to the person as a short note, never as a call error. */
export type TranslateOutcome = { text: string } | { skipped: 'consent_required' | 'unavailable' | 'busy' };

// The first "this route does not exist" answer turns the feature off for the rest of the session: no point asking per line.
let unavailable = false;

export function __resetTranslateCaption(): void {
    unavailable = false;
}

/**
 * Translates one final caption line. Never throws: a call must keep working when the translation does not.
 * 403 / 409 (the consent of both people is missing) and 404 / 405 / 501 (no such endpoint yet) and 429 (too many per minute)
 * each come back as `skipped`.
 */
export async function translateCaption(
    appointmentId: string,
    line: { id: string; text: string; from: string; to: string },
): Promise<TranslateOutcome> {
    if (unavailable) return { skipped: 'unavailable' };
    try {
        const res = await videoCallDAO.translate(appointmentId, { from: line.from, to: line.to, lines: [{ id: line.id, text: line.text }] });
        const text = res.lines?.find((l) => l.id === line.id)?.text?.trim();
        return text ? { text } : { skipped: 'unavailable' };
    } catch (err) {
        if (err instanceof ApiError) {
            if (err.statusCode === 404 || err.statusCode === 405 || err.statusCode === 501) {
                unavailable = true;
                return { skipped: 'unavailable' };
            }
            if (err.statusCode === 403 || err.statusCode === 409) return { skipped: 'consent_required' };
            if (err.statusCode === 429) return { skipped: 'busy' };
        }
        return { skipped: 'unavailable' };
    }
}
