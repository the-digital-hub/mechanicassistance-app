/**
 * The request's title joins its parts ("Tire Assistance, Other: Fast"): the first is the service, the rest is what is wrong. The
 * service is the title; the rest goes in a row of its own, without the catalog's "Other:" in front of what the owner wrote.
 */
export function splitJobTitle(title: string): { main: string; topic: string } {
    const parts = title.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return { main: title.trim(), topic: '' };
    return { main: parts[0], topic: parts.slice(1).map((p) => p.replace(/^other:\s*/i, '')).join(', ') };
}
