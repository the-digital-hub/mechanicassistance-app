/**
 * The legal texts (privacy policy, terms, whatever comes) are written and published from the Hub and served by
 * `GET /api/legal/policies` (backend, 25-nov, AU). A published version never changes; changing the text is publishing another
 * version, which each person has to accept again. This turns the server's answer into what the screens use, tolerating that a
 * title or content comes as plain text or as `{ es, en }`.
 */
export interface LegalPolicy {
    id: string;
    kind: string;
    version: string;
    title: string;
    /** The full text; the list may not carry it (it is then asked for with `GET /api/legal/policies/:id`). */
    content: string | null;
    requiresAcceptance: boolean;
    /** The roles this version is aimed at (`user`, `mechanic`…); empty is every role (backend 26-nov, `legal_policies.roles`). */
    roles: string[];
    accepted: boolean;
    acceptedAt: string | null;
    publishedAt: string | null;
}

export interface LegalPolicies {
    policies: LegalPolicy[];
    /** Versions to accept now (the ones `hasPending` talks about). */
    pending: LegalPolicy[];
    hasPending: boolean;
}

type Localized = string | { es?: string; en?: string } | null | undefined;

/** A text that may come in both languages: the shown language first, then the other, then ''. */
export function localizedText(value: Localized, language: string): string {
    if (typeof value === 'string') return value;
    if (!value) return '';
    const lang = language?.startsWith('en') ? 'en' : 'es';
    return value[lang] ?? value[lang === 'en' ? 'es' : 'en'] ?? '';
}

type RawPolicy = Record<string, unknown>;

function normalizeOne(raw: RawPolicy, language: string): LegalPolicy | null {
    const id = raw.id ?? raw.policyId;
    if (typeof id !== 'string' && typeof id !== 'number') return null;
    const content = localizedText(raw.content as Localized, language);
    return {
        id: String(id),
        kind: String(raw.kind ?? ''),
        version: String(raw.version ?? ''),
        title: localizedText(raw.title as Localized, language),
        content: content || null,
        requiresAcceptance: raw.requiresAcceptance !== false,
        roles: Array.isArray(raw.roles) ? (raw.roles as unknown[]).filter((r): r is string => typeof r === 'string') : [],
        accepted: raw.accepted === true,
        acceptedAt: typeof raw.acceptedAt === 'string' ? raw.acceptedAt : null,
        publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : typeof raw.createdAt === 'string' ? raw.createdAt : null,
    };
}

/** `{ policies, pending, hasPending }` as the server sends it (or a bare list), into `LegalPolicies`. */
export function normalizePolicies(raw: unknown, language: string): LegalPolicies {
    const body = (raw ?? {}) as { policies?: unknown; items?: unknown; pending?: unknown; hasPending?: unknown };
    const list = Array.isArray(raw) ? raw : Array.isArray(body.policies) ? body.policies : Array.isArray(body.items) ? body.items : [];
    const policies = (list as RawPolicy[]).map((p) => normalizeOne(p, language)).filter((p): p is LegalPolicy => !!p);
    // `pending` is a list of versions (or just their ids): whichever it is, it points at policies already in the list when it can.
    const pendingRaw = Array.isArray(body.pending) ? (body.pending as unknown[]) : [];
    const pendingIds = new Set(pendingRaw.map((p) => (typeof p === 'object' && p ? String((p as RawPolicy).id ?? (p as RawPolicy).policyId ?? '') : String(p))));
    const byPending = policies.filter((p) => pendingIds.has(p.id));
    const pending = byPending.length > 0 ? byPending : policies.filter((p) => p.requiresAcceptance && !p.accepted);
    return { policies, pending, hasPending: body.hasPending === true || pending.length > 0 };
}

/**
 * Whether a version is for this role. The server already answers with the versions of all the roles the account has, so a person with the
 * two roles (owner and technician) gets one version per role of the same kind: the screen shows the one of the role in use, and the other
 * appears when they switch profile. Without a role, or with a version that does not say its roles, it applies.
 */
export const appliesToRole = (policy: LegalPolicy, role?: string | null): boolean => !role || policy.roles.length === 0 || policy.roles.includes(role);

/** The same answer reduced to the role in use (what is pending is worked out again on those versions). */
export function policiesForRole(res: LegalPolicies, role?: string | null): LegalPolicies {
    const policies = res.policies.filter((p) => appliesToRole(p, role));
    const pending = res.pending.filter((p) => appliesToRole(p, role));
    return { policies, pending, hasPending: pending.length > 0 };
}

/** The text of a policy split into blocks the screen draws: headings (# …), bullets (- …) and paragraphs. */
export type PolicyBlock = { kind: 'heading' | 'bullet' | 'paragraph'; text: string };

export function policyBlocks(content: string): PolicyBlock[] {
    const out: PolicyBlock[] = [];
    let paragraph: string[] = [];
    const flush = () => {
        if (paragraph.length) out.push({ kind: 'paragraph', text: paragraph.join(' ') });
        paragraph = [];
    };
    for (const raw of content.replace(/\r/g, '').split('\n')) {
        const line = raw.trim();
        if (!line) { flush(); continue; }
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        const bullet = line.match(/^[-*•]\s+(.*)$/);
        if (heading) { flush(); out.push({ kind: 'heading', text: heading[1] }); }
        else if (bullet) { flush(); out.push({ kind: 'bullet', text: bullet[1] }); }
        else paragraph.push(line);
    }
    flush();
    return out;
}
