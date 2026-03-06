import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '../i18n';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming locale is valid
  const validLocale = locale && locales.includes(locale as Locale) ? locale : defaultLocale;
  
  return {
    locale: validLocale,
    messages: (await import(`../locales/${validLocale}.json`)).default,
    timeZone: 'Europe/Madrid',
    now: new Date(),
  };
});
