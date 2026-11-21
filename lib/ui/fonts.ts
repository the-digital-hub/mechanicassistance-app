import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';

/**
 * The app's one typeface, in one place: Inter (clearer than Outfit at small sizes, with a legible "&" and numerals). Code never names a
 * family: Tailwind's `font-outfit-*` classes (the names stay; tailwind.config.js reads the same variable) and `FONT.*` for styles written by
 * hand both follow this choice. `EXPO_PUBLIC_APP_FONT=outfit` brings the old typeface back, e.g. to compare.
 */
export const USE_INTER = process.env.EXPO_PUBLIC_APP_FONT !== 'outfit';

export const FONT = USE_INTER
    ? { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' }
    : { regular: 'Outfit_400Regular', medium: 'Outfit_500Medium', semibold: 'Outfit_600SemiBold', bold: 'Outfit_700Bold' };

/** What `useFonts` has to load for the family above. */
export const FONT_ASSETS: Record<string, number> = USE_INTER
    ? { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold }
    : { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold };
