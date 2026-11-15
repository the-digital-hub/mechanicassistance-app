const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Filters and orders options for a search box. Matching ignores case and accents.
 * Best matches first: the label starts with what was typed, then a word in it
 * does, then it only contains it. Alphabetical inside each group, so "v" lists
 * Volkswagen then Volvo before anything that merely has a "v" in the middle.
 * An empty query keeps the original order.
 */
export function rankOptions<T extends { label: string }>(options: T[], query: string): T[] {
    const q = normalize(query.trim());
    if (!q) return options;
    const rank = (label: string) => {
        if (label.startsWith(q)) return 0;
        if (label.split(/[\s\-/(),.]+/).some((word) => word.startsWith(q))) return 1;
        return label.includes(q) ? 2 : -1;
    };
    return options
        .map((o) => ({ o, label: normalize(o.label) }))
        .map((x) => ({ ...x, r: rank(x.label) }))
        .filter((x) => x.r >= 0)
        .sort((a, b) => a.r - b.r || a.label.localeCompare(b.label, undefined, { numeric: true }))
        .map((x) => x.o);
}
