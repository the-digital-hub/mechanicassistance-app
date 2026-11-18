/**
 * What the two phones send each other during a video call, over Daily's app messages
 * (peer to peer; nothing is stored). Points are normalised 0..1 over the picture, so
 * both screens line up whatever their size.
 */
export type Point = [number, number];

export type CallMessage =
    /** The technician's marking, a stroke at a time. `end` closes the stroke. */
    | { t: 'draw'; id: string; pts: Point[]; end?: boolean }
    /** Wipes every marking. */
    | { t: 'clear' }
    /** A line of in-call chat. */
    | { t: 'chat'; id: string; text: string };

export interface Stroke {
    id: string;
    pts: Point[];
}

export interface ChatLine {
    id: string;
    text: string;
    mine: boolean;
    at: number;
}

/** Anything that is not one of ours (or is malformed) is dropped. */
export function parseCallMessage(data: unknown): CallMessage | null {
    if (!data || typeof data !== 'object') return null;
    const m = data as Record<string, unknown>;
    if (m.t === 'clear') return { t: 'clear' };
    if (m.t === 'chat' && typeof m.id === 'string' && typeof m.text === 'string') {
        return { t: 'chat', id: m.id, text: m.text.slice(0, 500) };
    }
    if (m.t === 'draw' && typeof m.id === 'string' && Array.isArray(m.pts)) {
        const pts = m.pts.filter(
            (p): p is Point => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && n >= 0 && n <= 1),
        );
        return { t: 'draw', id: m.id, pts, end: m.end === true };
    }
    return null;
}

/** Adds the points of a received draw message to the strokes already known. */
export function applyDraw(strokes: Stroke[], msg: Extract<CallMessage, { t: 'draw' }>): Stroke[] {
    const i = strokes.findIndex((s) => s.id === msg.id);
    if (i === -1) return [...strokes, { id: msg.id, pts: msg.pts }];
    const next = strokes.slice();
    next[i] = { id: msg.id, pts: [...next[i].pts, ...msg.pts] };
    return next;
}
