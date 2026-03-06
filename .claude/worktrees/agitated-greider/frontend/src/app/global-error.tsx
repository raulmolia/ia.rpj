"use client"

import { useEffect } from "react"

export default function GlobalError({
    error,
    reset,
}: {
    error: (Error & { digest?: string }) | null | unknown
    reset: () => void
}) {
    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            console.error("[GlobalError boundary]", error)
        }

        const msg = error instanceof Error ? error.message : String(error ?? "")
        const name = error instanceof Error ? (error.name ?? "") : ""

        const isStale =
            name === "ChunkLoadError" ||
            msg.includes("ChunkLoadError") ||
            msg.includes("Loading chunk") ||
            msg.includes("Failed to fetch dynamically imported module") ||
            msg.includes("Server Action") ||
            msg.includes("deployment") ||
            msg.includes("Minified React error")

        // TypeError causado por respuesta null de Server Action (header origin
        // eliminado por proxy Plesk). También recargamos en este caso.
        const isNullServerActionCrash =
            error instanceof TypeError &&
            msg.includes("null") &&
            msg.includes("'message'")

        if (isStale || isNullServerActionCrash) {
            // Evitar bucle infinito: solo recargar una vez cada 10 segundos
            const RELOAD_KEY = "last_global_error_reload"
            const lastReload = parseInt(sessionStorage.getItem(RELOAD_KEY) ?? "0", 10)
            const now = Date.now()
            if (now - lastReload > 10_000) {
                sessionStorage.setItem(RELOAD_KEY, String(now))
                window.location.reload()
            }
        }
    }, [error])

    return (
        <html lang="es">
            <body
                style={{
                    margin: 0,
                    display: "flex",
                    minHeight: "100vh",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: "1.5rem",
                    padding: "2rem",
                    fontFamily: "system-ui, sans-serif",
                    textAlign: "center",
                    background: "#fff",
                    color: "#111",
                }}
            >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                        Error de la aplicación
                    </h1>
                    <p style={{ color: "#6b7280", maxWidth: "24rem", margin: "0 auto" }}>
                        Si el problema persiste después de recargar, prueba a limpiar el caché
                        del navegador (Ctrl + Shift + R).
                    </p>
                </div>
                <button
                    onClick={reset}
                    style={{
                        padding: "0.5rem 1.5rem",
                        background: "#111",
                        color: "#fff",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                    }}
                >
                    Recargar
                </button>
            </body>
        </html>
    )
}
