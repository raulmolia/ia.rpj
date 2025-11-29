'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { locales, defaultLocale, localeNames, type Locale } from '@/i18n';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: readonly Locale[];
  localeNames: Record<Locale, string>;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = 'ia-rpj-locale';

interface LocaleProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize locale from localStorage on mount (client-side only)
  useEffect(() => {
    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    if (storedLocale && locales.includes(storedLocale)) {
      setLocaleState(storedLocale);
    } else if (initialLocale && locales.includes(initialLocale)) {
      setLocaleState(initialLocale);
    }
    setIsHydrated(true);
  }, [initialLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (locales.includes(newLocale)) {
      setLocaleState(newLocale);
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      // Dispatch custom event for other components that might need to react
      window.dispatchEvent(new CustomEvent('locale-change', { detail: newLocale }));
    }
  }, []);

  // Sync locale with user preference from backend if available
  const syncWithUserPreference = useCallback((userLocale: string | undefined) => {
    if (userLocale && locales.includes(userLocale as Locale)) {
      setLocale(userLocale as Locale);
    }
  }, [setLocale]);

  const value: LocaleContextType = {
    locale,
    setLocale,
    locales,
    localeNames,
  };

  // Prevent hydration mismatch by not rendering until we've loaded from localStorage
  if (!isHydrated) {
    return null;
  }

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

// Hook to sync user's language preference from auth context
export function useLocaleSync(userLanguage: string | undefined) {
  const { setLocale } = useLocale();

  useEffect(() => {
    if (userLanguage && locales.includes(userLanguage as Locale)) {
      setLocale(userLanguage as Locale);
    }
  }, [userLanguage, setLocale]);
}

// Utility function to format dates according to locale
export function formatDate(date: Date | string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };
  
  // Map locales to Intl locale codes
  const localeMap: Record<Locale, string> = {
    es: 'es-ES',
    en: 'en-GB',
    fr: 'fr-FR',
    it: 'it-IT',
    pt: 'pt-PT',
    hu: 'hu-HU',
    pl: 'pl-PL',
    ca: 'ca-ES',
    gl: 'gl-ES',
    eu: 'eu-ES',
  };

  return new Intl.DateTimeFormat(localeMap[locale], defaultOptions).format(d);
}

// Utility function to format numbers according to locale
export function formatNumber(num: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  const localeMap: Record<Locale, string> = {
    es: 'es-ES',
    en: 'en-GB',
    fr: 'fr-FR',
    it: 'it-IT',
    pt: 'pt-PT',
    hu: 'hu-HU',
    pl: 'pl-PL',
    ca: 'ca-ES',
    gl: 'gl-ES',
    eu: 'eu-ES',
  };

  return new Intl.NumberFormat(localeMap[locale], options).format(num);
}

// Utility function to format relative time
export function formatRelativeTime(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const localeMap: Record<Locale, string> = {
    es: 'es-ES',
    en: 'en-GB',
    fr: 'fr-FR',
    it: 'it-IT',
    pt: 'pt-PT',
    hu: 'hu-HU',
    pl: 'pl-PL',
    ca: 'ca-ES',
    gl: 'gl-ES',
    eu: 'eu-ES',
  };

  const rtf = new Intl.RelativeTimeFormat(localeMap[locale], { numeric: 'auto' });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
  }
}

export { locales, defaultLocale, localeNames, type Locale };
