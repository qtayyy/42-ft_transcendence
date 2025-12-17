export const locales = {
  en: 'English',
  ms: 'Bahasa Melayu',
  zh: '中文',
  ko: '한국어',
  ja: '日本語',
} as const;

export type Locale = keyof typeof locales;
export const defaultLocale: Locale = 'en';
