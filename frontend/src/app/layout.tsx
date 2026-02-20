import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter, DM_Sans, Lora, Lexend } from 'next/font/google'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ 
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--font-sans',
})

const dmSans = DM_Sans({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--font-dm-sans',
})

const lora = Lora({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-lora',
})

const lexend = Lexend({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--font-lexend',
})

export const metadata: Metadata = {
    title: 'Asistente IA para Actividades Juveniles',
    description: 'Generador inteligente de actividades, dinámicas y programaciones para grupos de jóvenes',
    keywords: ['juventud', 'actividades', 'dinámicas', 'IA', 'educación', 'monitores'],
    authors: [{ name: 'Desarrollador Asistente IA' }],
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <head />
            <body className={`${inter.variable} ${dmSans.variable} ${lora.variable} ${lexend.variable} bg-background font-sans antialiased`}>
                <Providers>
                    {children}
                    <Toaster />
                </Providers>
            </body>
        </html>
    )
}