import { assistanceTypeDAO } from '@/lib/dao/AssistanceTypeDAO';
import type { AssistanceTypeCatalogItem } from '@/lib/dao/interfaces';
import { getLanguageId } from '@/lib/i18n/catalogTranslations';
import { Calendar, Clock, HelpCircle, ShieldCheck, Truck, Video, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Shared by every screen that renders the assistance type catalog: the type picker
 * (a list) and the owner dashboard (a grid of buttons). Both read the same endpoint,
 * so they must resolve codes, icons and routes the same way.
 */

/**
 * Shown while the catalog request is in flight and kept if it fails, so the screen is
 * never empty. Mirrors FALLBACK_CATALOG in issue-selection.tsx. The display columns are
 * null on purpose: that is exactly the shape the API returns before the admin fills
 * them in, so both paths exercise the same fallbacks below.
 */
export const FALLBACK_TYPES: AssistanceTypeCatalogItem[] = [
    { id: 'immediate', code: 'immediate', name: 'Immediate Assistance', sortOrder: 1 },
    { id: 'scheduled', code: 'scheduled', name: 'Scheduled Assistance', sortOrder: 2 },
    { id: 'videocall', code: 'videocall', name: 'Video Call Assistance', sortOrder: 3 },
    { id: 'witness', code: 'witness', name: 'Accident', sortOrder: 4 },
];

// `icon` is a free-form key set in the admin — there is no fixed catalog, so unknown
// keys must degrade to the default instead of breaking the card.
const ICONS_BY_KEY: Record<string, typeof Zap> = {
    bolt: Zap,
    zap: Zap,
    calendar: Calendar,
    clock: Clock,
    video: Video,
    truck: Truck,
    tow: Truck,
    shield: ShieldCheck,
    accident: ShieldCheck,
};

// Second fallback, by code: the `icon` column is still null in production, so without
// this every card would render the generic placeholder.
const ICONS_BY_CODE: Record<string, typeof Zap> = {
    immediate: Zap,
    scheduled: Calendar,
    videocall: Video,
    witness: ShieldCheck,
    towing: Truck,
};

/**
 * Bundled copy for the types the app has always shipped, used when the catalog has no
 * translation for the active language (or no description at all). The key names do not
 * match the codes: `videocall` lives under `videoCall` and `witness` under `accident`.
 */
const I18N_BY_CODE: Record<string, string> = {
    immediate: 'immediate',
    scheduled: 'scheduled',
    videocall: 'videoCall',
    witness: 'accident',
};

/**
 * Bridge for the current state of the data: `code` is still null on every row, and
 * without it there is no navigation param, no icon and no bundled copy — the whole
 * screen would render disabled. Matching on the name is deliberately a fallback, and
 * it stops being used the moment the admin fills the column in. Both spellings of
 * "immediate" are listed because the catalog currently holds a typo.
 */
const CODE_BY_NAME: Record<string, string> = {
    'inmediate assistance': 'immediate',
    'immediate assistance': 'immediate',
    'scheduled assistance': 'scheduled',
    'video call assistance': 'videocall',
    towing: 'towing',
    accident: 'witness',
};

export const codeFor = (item: AssistanceTypeCatalogItem): string | undefined =>
    item.code ?? CODE_BY_NAME[item.name.trim().toLowerCase()];

export const iconFor = (item: AssistanceTypeCatalogItem) => {
    const code = codeFor(item);
    return (
        (item.icon ? ICONS_BY_KEY[item.icon.toLowerCase()] : undefined) ??
        (code ? ICONS_BY_CODE[code] : undefined) ??
        HelpCircle
    );
};

/** Bundled i18n key for a type, or undefined for a type the app has never heard of. */
export const i18nKeyFor = (item: AssistanceTypeCatalogItem): string | undefined => {
    const code = codeFor(item);
    return code ? I18N_BY_CODE[code] : undefined;
};

/**
 * Where a type's card navigates. A type with no resolvable code cannot be navigated:
 * the param drives every later step and ends up in assistance_requests.type, so the
 * caller renders it disabled.
 */
export const assistanceTypeRoute = (item: AssistanceTypeCatalogItem) => {
    const code = codeFor(item);
    return code
        ? {
              pathname: (item.path ?? '/request-assistance/select-vehicle') as never,
              params: { type: code },
          }
        : undefined;
};

/**
 * The catalog plus the language id its translations are keyed by. Starts from
 * FALLBACK_TYPES and keeps it if the request fails.
 */
export function useAssistanceTypeCatalog() {
    const { i18n } = useTranslation();
    const language = i18n.language;

    const [types, setTypes] = useState<AssistanceTypeCatalogItem[]>(FALLBACK_TYPES);
    const [loading, setLoading] = useState(true);
    const [languageId, setLanguageId] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await assistanceTypeDAO.getCatalog();
                if (mounted && Array.isArray(data) && data.length > 0) setTypes(data);
            } catch (err) {
                console.warn('Could not load the assistance type catalog; using fallback list', err);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        getLanguageId(language).then(id => {
            if (mounted) setLanguageId(id);
        });
        return () => {
            mounted = false;
        };
    }, [language]);

    return { types, loading, languageId };
}
