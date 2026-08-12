/**
 * Address autocomplete backed by the Google Places API (New).
 *
 * Two calls per address: `searchPlaces` for the suggestion list, then
 * `getPlaceDetails` once the user picks one. Sharing a session token across
 * both makes Google bill them as a single Autocomplete request, so callers
 * should keep one token per typing session and call `newSessionToken()` after
 * every selection.
 *
 * The API key lives in `extra.googlePlacesApiKey` (see `app.config.js`). If it
 * is missing or Google rejects the request, we fall back to Photon (the
 * geocoder this app used before) so the UI never loses autocomplete.
 */
import Constants from 'expo-constants';
import { US_STATES, normalizeStreet } from './address';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';
const PHOTON_URL = 'https://photon.komoot.io/api/';

/** Street-level results only — no businesses, parks or bare city names. */
const INCLUDED_TYPES = ['street_address', 'premise', 'subpremise', 'route'];

/** A normalized address, ready to be merged into a screen's form state. */
export interface ParsedAddress {
    street: string;
    apartment?: string;
    city: string;
    /** Two-letter code when resolvable (e.g. `FL`), otherwise the raw region. */
    state: string;
    /** Five digits, matching the `maxLength` the address forms enforce. */
    zip: string;
    locationLat?: number;
    locationLng?: number;
    /** Human-readable one-liner, used for labels and map captions. */
    formatted: string;
}

/** One row in the suggestion list. `placeId` is opaque — pass it back to `getPlaceDetails`. */
export interface PlaceSuggestion {
    placeId: string;
    mainText: string;
    secondaryText: string;
}

const getApiKey = (): string | undefined =>
    (Constants.expoConfig?.extra as { googlePlacesApiKey?: string } | undefined)
        ?.googlePlacesApiKey;

/** Warn once per session instead of on every keystroke. */
let fallbackWarned = false;
const warnFallback = (reason: string) => {
    if (fallbackWarned) return;
    fallbackWarned = true;
    console.warn(`[places] Google Places unavailable (${reason}) — falling back to Photon.`);
};

/**
 * Photon has no details endpoint, so its parsed addresses are cached here at
 * search time and read back by `getPlaceDetails`.
 */
const fallbackCache = new Map<string, ParsedAddress>();

/** Opaque per-typing-session token. Google only requires that it be unique. */
export const newSessionToken = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

const toStateCode = (region: string): string => {
    const match = US_STATES.find(
        (s) =>
            s.name.toLowerCase() === region.toLowerCase() ||
            s.code.toLowerCase() === region.toLowerCase(),
    );
    return match?.code || region;
};

interface GoogleAddressComponent {
    types?: string[];
    shortText?: string;
    longText?: string;
}

interface GooglePlaceDetails {
    addressComponents?: GoogleAddressComponent[];
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
}

const parseGoogleDetails = (place: GooglePlaceDetails): ParsedAddress => {
    const components = place.addressComponents ?? [];
    const pick = (type: string, prefer: 'short' | 'long' = 'long') => {
        const c = components.find((comp) => comp.types?.includes(type));
        if (!c) return '';
        return (prefer === 'short' ? c.shortText || c.longText : c.longText || c.shortText) || '';
    };

    const streetNumber = pick('street_number');
    // `route.shortText` already comes abbreviated from Google ("5th Ave"), so
    // normalizeStreet is a no-op there — it still covers the long form when
    // shortText is absent.
    const route = normalizeStreet(pick('route', 'short'));
    const city =
        pick('locality') ||
        pick('postal_town') ||
        pick('sublocality') ||
        pick('administrative_area_level_3') ||
        pick('administrative_area_level_2');

    return {
        street: `${streetNumber} ${route}`.trim(),
        apartment: pick('subpremise') || undefined,
        city,
        state: toStateCode(pick('administrative_area_level_1', 'short')),
        zip: pick('postal_code').slice(0, 5),
        locationLat: place.location?.latitude,
        locationLng: place.location?.longitude,
        formatted: place.formattedAddress || '',
    };
};

interface PhotonFeature {
    properties?: {
        housenumber?: string;
        street?: string;
        name?: string;
        city?: string;
        state?: string;
        postcode?: string;
    };
    geometry?: { coordinates?: [number, number] };
}

const parsePhotonFeature = (feature: PhotonFeature): ParsedAddress => {
    const p = feature.properties ?? {};
    const street = `${p.housenumber || ''} ${normalizeStreet(p.street || p.name || '')}`.trim();
    const city = p.city || '';
    const state = toStateCode(p.state || '');
    const zip = (p.postcode || '').slice(0, 5);
    // Photon returns GeoJSON order: [lon, lat].
    const [lon, lat] = feature.geometry?.coordinates ?? [undefined, undefined];

    return {
        street,
        city,
        state,
        zip,
        locationLat: lat,
        locationLng: lon,
        formatted: [street, city, `${state} ${zip}`.trim()].filter(Boolean).join(', '),
    };
};

const searchPlacesFallback = async (query: string): Promise<PlaceSuggestion[]> => {
    const response = await fetch(`${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=5&lang=en`);
    const data = await response.json();

    return ((data.features ?? []) as PhotonFeature[]).map((feature, index) => {
        const parsed = parsePhotonFeature(feature);
        // Photon has no stable id — key by position within this result set.
        const placeId = `photon:${index}:${parsed.formatted}`;
        fallbackCache.set(placeId, parsed);

        return {
            placeId,
            mainText: parsed.street || feature.properties?.name || parsed.formatted,
            secondaryText: [parsed.city, `${parsed.state} ${parsed.zip}`.trim()]
                .filter(Boolean)
                .join(', '),
        };
    });
};

interface GooglePlacePrediction {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
    };
}

/**
 * Suggestions for a partial address. No country or region restriction — results
 * are worldwide. Returns `[]` rather than throwing when both providers fail, so
 * a network blip can never break typing.
 */
export const searchPlaces = async (
    query: string,
    sessionToken: string,
): Promise<PlaceSuggestion[]> => {
    const apiKey = getApiKey();

    if (!apiKey) {
        warnFallback('no API key in extra.googlePlacesApiKey');
        return searchPlacesFallback(query).catch(() => []);
    }

    try {
        const response = await fetch(AUTOCOMPLETE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
            body: JSON.stringify({
                input: query,
                sessionToken,
                includedPrimaryTypes: INCLUDED_TYPES,
            }),
        });

        if (!response.ok) {
            const body = await response.text();
            warnFallback(`HTTP ${response.status}: ${body.slice(0, 200)}`);
            return searchPlacesFallback(query).catch(() => []);
        }

        const data = await response.json();

        return ((data.suggestions ?? []) as { placePrediction?: GooglePlacePrediction }[])
            .map((s) => s.placePrediction)
            .filter((p): p is GooglePlacePrediction => Boolean(p?.placeId))
            .map((p) => ({
                placeId: p.placeId as string,
                mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
                secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
            }));
    } catch (error) {
        warnFallback(String(error));
        return searchPlacesFallback(query).catch(() => []);
    }
};

/**
 * Full address for a suggestion the user picked. Throws when the place cannot
 * be resolved — callers should surface that instead of silently saving a
 * partial address.
 *
 * `sessionToken` must be the same one passed to the `searchPlaces` call that
 * produced this `placeId`, so Google bills both as one request.
 */
export const getPlaceDetails = async (
    placeId: string,
    sessionToken: string,
): Promise<ParsedAddress> => {
    const cached = fallbackCache.get(placeId);
    if (cached) return cached;

    const apiKey = getApiKey();
    if (!apiKey) throw new Error('[places] cannot fetch place details without an API key');

    const url = `${DETAILS_URL}/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
    const response = await fetch(url, {
        headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'addressComponents,location,formattedAddress',
        },
    });

    if (!response.ok) {
        throw new Error(`[places] details request failed: HTTP ${response.status}`);
    }

    return parseGoogleDetails(await response.json());
};
