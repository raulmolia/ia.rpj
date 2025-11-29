import { getRequestConfig } from 'next-intl/server';

export const locales = ['es', 'en', 'fr', 'it', 'pt', 'hu', 'pl', 'ca', 'gl', 'eu'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export const localeNames: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
  hu: 'Magyar',
  pl: 'Polski',
  ca: 'Català',
  gl: 'Galego',
  eu: 'Euskara',
};

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming locale is valid
  const validLocale = locale && locales.includes(locale as Locale) ? locale : defaultLocale;
  
  return {
    locale: validLocale,
    messages: (await import(`./locales/${validLocale}.json`)).default,
    timeZone: 'Europe/Madrid',
    now: new Date(),
  };
});
