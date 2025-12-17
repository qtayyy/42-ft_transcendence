"use client";

import { useLanguage } from '@/context/languageContext';

export function useTranslation() {
  const { t, locale } = useLanguage();
  return { t, locale };
}
