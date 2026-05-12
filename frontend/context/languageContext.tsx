"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/lib/i18n/translations';
import { type Locale, defaultLocale } from '@/lib/i18n/locales';

type TranslationKeys = typeof translations['en'];

// Locale represents the current language/region setting (e.g., 'en' for English, 'zh' for Chinese)
type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  // initialLocale comes from the server (cookie) so server and client start in sync
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // On first mount, sync from localStorage for backward compatibility
  // (handles users who set a locale before the cookie was introduced)
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && translations[savedLocale]) {
      setLocaleState(savedLocale);
      document.cookie = `locale=${savedLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = savedLocale;
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    // Write to cookie so the server can render the correct locale on next request
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = newLocale;
  };

  const t = (translations[locale] || translations[defaultLocale]) as TranslationKeys;

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
