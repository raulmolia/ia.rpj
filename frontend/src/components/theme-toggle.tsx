"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggleButton() {
    const { setTheme, resolvedTheme, theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === "system" ? resolvedTheme : theme
    const isDark = mounted ? currentTheme === "dark" : false

    const handleToggle = () => {
        setTheme(isDark ? "light" : "dark")
    }

    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleToggle}
            className="relative h-10 w-10"
            aria-label={`Cambiar a modo ${mounted && isDark ? "claro" : "oscuro"}`}
            disabled={!mounted}
        >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
            <span className="sr-only">Alternar tema</span>
        </Button>
    )
}
