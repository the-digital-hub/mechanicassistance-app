import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { getLocalTranscript } from '@/lib/video/transcriptStore';

/** What was last sent for a call (how many lines), so leaving and re-opening does not send the same text again. */
const sent = new Map<string, number>();

/**
 * Sends this phone's transcript of a call to the server, where it is kept with the appointment and shows on the other
 * phone too. Safe to call as often as needed: the server keeps one line per `id`. Nothing is sent when there is
 * nothing new, and any failure (offline, a missing consent, an older backend) leaves the local copy as it was.
 */
export async function syncTranscript(appointmentId: string, myRole: 'owner' | 'mechanic', language: string): Promise<'stored' | 'nothing' | 'consent_required' | 'failed'> {
    try {
        const local = await getLocalTranscript(appointmentId);
        if (local.length === 0 || sent.get(appointmentId) === local.length) return 'nothing';
        const otherRole = myRole === 'owner' ? 'mechanic' : 'owner';
        const result = await videoCallDAO.putTranscript(appointmentId, {
            language,
            lines: local.map((l) => ({
                id: l.id,
                ...(l.speakerId ? { speakerId: l.speakerId } : {}),
                role: l.speaker === 'me' ? myRole : otherRole,
                name: l.name,
                text: l.text,
                at: new Date(l.at || Date.now()).toISOString(),
            })),
        });
        if (result.status === 'stored') sent.set(appointmentId, local.length);
        return result.status;
    } catch {
        return 'failed';
    }
}
