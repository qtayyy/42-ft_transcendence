import type { Locale } from './locales';

// Dynamic dictionary loader - loads JSON files at runtime
const dictionaries: Record<Locale, () => Promise<any>> = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  ms: () => import('./dictionaries/ms.json').then((module) => module.default),
  zh: () => import('./dictionaries/zh.json').then((module) => module.default),
  ko: () => import('./dictionaries/ko.json').then((module) => module.default),
  ja: () => import('./dictionaries/ja.json').then((module) => module.default),
};

// Load translations dynamically based on locale
export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};

// For synchronous access (preloaded translations)
// Import all dictionaries statically for use in client components
import enDict from './dictionaries/en.json';
import msDict from './dictionaries/ms.json';
import zhDict from './dictionaries/zh.json';
import koDict from './dictionaries/ko.json';
import jaDict from './dictionaries/ja.json';

export const translations = {
  en: enDict,
  ms: msDict,
  zh: zhDict,
  ko: koDict,
  ja: jaDict,
} as const;

export type TranslationKeys = typeof translations.en;
