"use client";

import * as React from "react";
import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/context/languageContext";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/locales";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentLocaleLabel = locales[isMounted ? locale : defaultLocale];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" suppressHydrationWarning>
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline" suppressHydrationWarning>{currentLocaleLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(locales) as Locale[]).map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLocale(lang)}
            className="flex items-center gap-2"
          >
            {locale === lang && <Check className="h-4 w-4" />}
            {locale !== lang && <span className="w-4" />}
            {locales[lang]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
