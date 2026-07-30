import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';

export const LANGUAGE_STORAGE_KEY = 'app_language';
export type SupportedLanguage = 'en' | 'es';

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Restore the user's saved language choice on app start. Screens using
// useTranslation() re-render automatically once this resolves.
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((saved) => {
  if (saved === 'en' || saved === 'es') {
    i18next.changeLanguage(saved);
  }
});

export async function setAppLanguage(lang: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  await i18next.changeLanguage(lang);
}

export default i18next;
