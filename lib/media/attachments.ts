/**
 * Attachments a user adds on the "Vehicle documentation" step.
 *
 * The backend stores them in `assistance_requests.photos`, which historically
 * held a JSON array of plain URL strings. It now holds objects so a clip and a
 * per-file note fit, but rows created before that change still hold the old
 * shape — every reader must go through `parseAttachments`.
 */
export type AttachmentType = 'photo' | 'video';

export interface Attachment {
    url: string;
    type: AttachmentType;
    note?: string;
}

/** A local file the wizard has not uploaded yet. */
export interface PendingAttachment {
    uri: string;
    type: AttachmentType;
    note?: string;
}

const isAttachmentType = (value: unknown): value is AttachmentType =>
    value === 'photo' || value === 'video';

const fromUnknown = (entry: unknown): Attachment | null => {
    if (typeof entry === 'string') {
        return entry ? { url: entry, type: 'photo' } : null;
    }

    if (entry && typeof entry === 'object') {
        const { url, type, note } = entry as Record<string, unknown>;
        if (typeof url !== 'string' || !url) return null;
        return {
            url,
            type: isAttachmentType(type) ? type : 'photo',
            ...(typeof note === 'string' && note ? { note } : {}),
        };
    }

    return null;
};

/**
 * Normalizes whatever `photos` came back as — a JSON string, an array of URLs,
 * or an array of attachment objects — into a single shape. Never throws: a
 * malformed value yields an empty list rather than breaking the screen.
 */
export function parseAttachments(raw: unknown): Attachment[] {
    if (!raw) return [];

    let value = raw;
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(value)) return [];

    return value
        .map(fromUnknown)
        .filter((entry): entry is Attachment => entry !== null);
}
