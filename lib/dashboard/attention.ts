/** An alert of "Needs your attention". `signature` changes when the alert is a new one (e.g. a different count). */
export interface AttentionLike {
    id: string;
    signature?: string;
}

/** What identifies an alert for dismissal purposes: its signature, or its id when it has none. */
export const attentionKey = (item: AttentionLike): string => item.signature ?? item.id;

/** Alerts the user has not hidden. A hidden alert comes back only when its signature changes. */
export function visibleAttention<T extends AttentionLike>(items: readonly T[], dismissed: ReadonlySet<string>): T[] {
    return items.filter((item) => !dismissed.has(attentionKey(item)));
}

/** Newest dismissals kept; the list must not grow forever. */
export const MAX_DISMISSED = 50;

export function addDismissed(current: readonly string[], key: string): string[] {
    if (current.includes(key)) return [...current];
    return [...current, key].slice(-MAX_DISMISSED);
}
