"use client"

import { useTranslations } from "next-intl"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Languages } from "lucide-react"
import { useLocale, type Locale } from "@/lib/locale-context"
import { useAuth } from "@/hooks/use-auth"
import { buildApiUrl } from "@/lib/utils"

const languages = [
  { code: "es" as Locale, name: "Español" },
  { code: "en" as Locale, name: "English" },
  { code: "fr" as Locale, name: "Français" },
  { code: "it" as Locale, name: "Italiano" },
  { code: "pt" as Locale, name: "Português" },
  { code: "hu" as Locale, name: "Magyar" },
  { code: "pl" as Locale, name: "Polski" },
  { code: "ca" as Locale, name: "Català" },
  { code: "gl" as Locale, name: "Galego" },
  { code: "eu" as Locale, name: "Euskara" },
]

export function LanguageSelector() {
  const t = useTranslations("settings")
  const { locale, setLocale } = useLocale()
  const { isAuthenticated, token, updateProfile } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageChange = async (newLocale: Locale) => {
    // Update local state first (this saves to localStorage)
    setLocale(newLocale)
    
    // Save to backend if user is authenticated
    if (isAuthenticated && token && updateProfile) {
      try {
        await updateProfile({ idioma: newLocale })
      } catch (error) {
        console.error("Error saving language preference:", error)
      }
    }
    
    // Reload the page to apply the new locale
    window.location.reload()
  }

  const currentLanguage = languages.find((lang) => lang.code === locale)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-10 w-10"
          aria-label={t("language")}
        >
          <Languages className="h-4 w-4" />
          <span className="sr-only">{t("language")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={locale === lang.code ? "bg-accent" : ""}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
