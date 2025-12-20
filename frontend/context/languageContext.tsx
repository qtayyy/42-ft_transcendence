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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Initialize with default language ('en'), then load user's saved preference if it exists
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // Load user's saved language preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale;
      if (savedLocale && translations[savedLocale]) {
        setLocaleState(savedLocale);
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
      // Update HTML lang attribute
      document.documentElement.lang = newLocale;
    }
  };

  // Ensure we always have a valid translation object, fallback to default
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
