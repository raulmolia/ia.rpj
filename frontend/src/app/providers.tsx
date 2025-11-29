"use client"

import React from "react"
import { ThemeProvider } from "next-themes"
import { NextIntlClientProvider } from "next-intl"
import { AuthProvider } from "@/lib/auth-context"
import { LocaleProvider, useLocale, defaultLocale } from "@/lib/locale-context"

// Import all locale messages
import esMessages from "@/locales/es.json"
import enMessages from "@/locales/en.json"
import frMessages from "@/locales/fr.json"
import itMessages from "@/locales/it.json"
import ptMessages from "@/locales/pt.json"
import huMessages from "@/locales/hu.json"
import plMessages from "@/locales/pl.json"
import caMessages from "@/locales/ca.json"
import glMessages from "@/locales/gl.json"
import euMessages from "@/locales/eu.json"

const messages: Record<string, typeof esMessages> = {
    es: esMessages,
    en: enMessages,
    fr: frMessages,
    it: itMessages,
    pt: ptMessages,
    hu: huMessages,
    pl: plMessages,
    ca: caMessages,
    gl: glMessages,
    eu: euMessages,
}

function IntlProviderWrapper({ children }: { children: React.ReactNode }) {
    const { locale } = useLocale()
    
    return (
        <NextIntlClientProvider 
            locale={locale} 
            messages={messages[locale] || messages[defaultLocale]}
            timeZone="Europe/Madrid"
        >
            {children}
        </NextIntlClientProvider>
    )
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <LocaleProvider>
                <IntlProviderWrapper>
                    <AuthProvider>{children}</AuthProvider>
                </IntlProviderWrapper>
            </LocaleProvider>
        </ThemeProvider>
    )
}
