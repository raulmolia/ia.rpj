"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Silenciar en producción; registrar solo en desarrollo
        if (process.env.NODE_ENV === "development") {
            console.error("[Error boundary]", error)
        }
    }, [error])

    const msg = error?.message ?? ""
    const name = (error as Error & { name?: string })?.name ?? ""

    // Detectar errores causados por caché de JS desactualizada tras un nuevo deploy:
    // - ChunkLoadError: el navegador tiene chunks del build anterior que ya no existen
    // - "Failed to find Server Action": ID de acción no coincide con el build actual
    // - "Loading chunk X failed": otro formato del ChunkLoadError
    const isStaleDeployment =
        name === "ChunkLoadError" ||
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Server Action") ||
        msg.includes("deployment") ||
        msg.includes("Unexpected token") ||
        msg.includes("is not a function") && msg.includes("undefined")

    useEffect(() => {
        if (!isStaleDeployment) return
        // Evitar bucle infinito: solo recargar una vez cada 10 segundos
        const RELOAD_KEY = "last_error_reload"
        const lastReload = parseInt(sessionStorage.getItem(RELOAD_KEY) ?? "0", 10)
        const now = Date.now()
        if (now - lastReload > 10_000) {
            sessionStorage.setItem(RELOAD_KEY, String(now))
            window.location.reload()
        }
    }, [isStaleDeployment])

    if (isStaleDeployment) {
        return null
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Algo ha ido mal
                </h1>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Ha ocurrido un error inesperado. Puedes intentar recargar la
                    página o volver más tarde.
                </p>
                {error?.digest && (
                    <p className="text-xs text-muted-foreground/60 font-mono">
                        Referencia: {error.digest}
                    </p>
                )}
            </div>
            <div className="flex gap-3">
                <Button onClick={reset} variant="default" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Reintentar
                </Button>
                <Button
                    onClick={() => window.location.assign("/")}
                    variant="outline"
                >
                    Ir al inicio
                </Button>
            </div>
        </div>
    )
}
