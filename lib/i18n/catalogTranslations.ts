import AsyncStorage from '@react-native-async-storage/async-storage';
import { pricingDAO } from '../dao/PricingDAO';
import type { VehicleIssueTranslation } from '../dao/interfaces';

/**
 * Client-side resolution of the catalog's translations.
 *
 * The pricing API is language-agnostic: it returns each row's base `name` plus
 * the full `translations[]`, and the app renders the one matching the language
 * i18next detected. This module is the bridge between the two — it turns a
 * locale code into the `languageId` those rows are keyed by, and picks the name.
 *
 * i18next itself only covers the app's own static strings; catalog rows come
 * from the DB and are not in the locale JSONs.
 */

const LANGUAGE_IDS_CACHE_KEY = 'catalog_language_ids';

/** code → languageId, e.g. `{ en: 1, es: 2 }`. */
type LanguageIdMap = Record<string, number>;

// Populated on first use and reused for the rest of the session, so a screen
// re-render never re-hits the network.
let cache: LanguageIdMap | null = null;
let inFlight: Promise<LanguageIdMap> | null = null;

async function loadFromStorage(): Promise<LanguageIdMap | null> {
    try {
        const raw = await AsyncStorage.getItem(LANGUAGE_IDS_CACHE_KEY);
        return raw ? (JSON.parse(raw) as LanguageIdMap) : null;
    } catch {
        return null;
    }
}

async function fetchMap(): Promise<LanguageIdMap> {
    const languages = await pricingDAO.getLanguages();
    const map: LanguageIdMap = {};
    languages.forEach(language => {
        map[language.code.toLowerCase()] = language.id;
    });
    // Persist so the first render after a cold start can resolve names without
    // waiting on the network.
    AsyncStorage.setItem(LANGUAGE_IDS_CACHE_KEY, JSON.stringify(map)).catch(() => { });
    return map;
}

/**
 * Resolves a locale code (`'es'`) to the `languageId` used inside
 * `translations[]`.
 *
 * Returns `null` when the language is unknown or the lookup fails — callers
 * then fall back to the base `name`, which is the intended behaviour. This
 * never throws: an untranslated catalog beats a broken screen.
 */
export async function getLanguageId(code: string): Promise<number | null> {
    const key = code?.split('-')[0]?.toLowerCase();
    if (!key) return null;

    if (!cache) {
        cache = await loadFromStorage();
    }
    if (cache?.[key] !== undefined) return cache[key];

    try {
        // Share one request between concurrent callers, otherwise every screen
        // mounting at the same time would fire its own.
        inFlight = inFlight ?? fetchMap();
        cache = await inFlight;
        return cache[key] ?? null;
    } catch {
        return null;
    } finally {
        inFlight = null;
    }
}

/** Anything from the catalog: a base name plus the translations the API embedded. */
interface Translatable {
    name: string;
    translations?: VehicleIssueTranslation[];
}

/**
 * Picks the name for `languageId`, falling back to the entity's base `name`
 * when there is no row for that language (or the language is unresolved).
 */
export function translatedName(
    entity: Translatable,
    languageId: number | null,
): string {
    if (languageId === null || !entity.translations?.length) return entity.name;
    const match = entity.translations.find(t => t.languageId === languageId);
    return match?.name ?? entity.name;
}
