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

    // "Failed to find Server Action" → JS cacheado antiguo → recarga forzada
    const isStaleDeployment =
        error?.message?.includes("Server Action") ||
        error?.message?.includes("deployment") ||
        (typeof window !== "undefined" &&
            document.referrer === "" &&
            navigator.onLine)

    if (isStaleDeployment) {
        if (typeof window !== "undefined") {
            // Borrar la caché del service worker y recargar
            window.location.reload()
        }
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
