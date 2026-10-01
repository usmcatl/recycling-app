/* eslint-disable import/no-named-as-default-member -- the default i18next instance is its documented API */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Locale } from '@/lib/types';
import en from './en';
import es from './es';

const LANGUAGE_KEY = 'recycle-connect-language';

function deviceLocale(): Locale {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'es';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: deviceLocale(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

/** Apply the language the user picked last time, if any. */
export async function restoreLanguage() {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved === 'en' || saved === 'es') await i18n.changeLanguage(saved);
  } catch {
    // keep device language
  }
}

export async function setLanguage(locale: Locale) {
  await i18n.changeLanguage(locale);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, locale);
  } catch {
    // non-critical
  }
}

export function currentLocale(): Locale {
  return i18n.language === 'en' ? 'en' : 'es';
}

export default i18n;
