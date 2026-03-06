"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { ExternalLink, Loader2, Plug, PlugZap, RefreshCw, Unplug } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buildApiUrl } from "@/lib/utils"

// ─── Tipos ───────────────────────────────────────────────────────────────────

type EstadoConector = "ACTIVO" | "INACTIVO" | "ERROR"

interface ConectorInfo {
    id: string
    tipo: "GOOGLE_DRIVE" | "GOOGLE_DOCS"
    estado: EstadoConector
    config?: {
        // Google
        googleEmail?: string
        googleName?: string
        googlePicture?: string
    } | null
    tokenExpiracion?: string | null
    fechaCreacion?: string
}

interface ConectoresPanelProps {
    token: string
}

// ─── Definición de conectores disponibles ────────────────────────────────────

const AVAILABLE_CONNECTORS = [
    {
        tipo: "GOOGLE_DRIVE" as const,
        name: "Google Drive",
        description: "Accede a tus archivos de Google Drive: lista, busca por contenido y crea carpetas desde el chat.",
        tools: ["Listar archivos", "Buscar en Drive", "Ver metadatos", "Crear carpetas"],
        logoSrc: "/google-drive-logo.svg",
        docsUrl: "https://developers.google.com/drive/api/guides/about-sdk",
        authPath: "google-drive",
    },
    {
        tipo: "GOOGLE_DOCS" as const,
        name: "Google Docs",
        description: "Lee, crea y edita documentos de Google Docs directamente desde la conversación.",
        tools: ["Listar documentos", "Leer contenido", "Crear documentos", "Añadir texto", "Reemplazar plantillas"],
        logoSrc: "/google-docs-logo.svg",
        docsUrl: "https://developers.google.com/docs/api/guides/concepts",
        authPath: "google-docs",
    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estadoBadge(estado: EstadoConector) {
    switch (estado) {
        case "ACTIVO":
            return (
                <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                    ● Conectado
                </Badge>
            )
        case "INACTIVO":
            return (
                <Badge variant="secondary">
                    ○ Pausado
                </Badge>
            )
        case "ERROR":
            return (
                <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                    ✕ Error de token
                </Badge>
            )
    }
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ConnectoresPanel({ token }: ConectoresPanelProps) {
    const [conectores, setConectores] = useState<ConectorInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const fetchConectores = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(buildApiUrl("/api/conectores"), {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error("Error cargando conectores")
            const data = await res.json()
            setConectores(data.conectores || [])
        } catch (err) {
            setError("No se pudieron cargar los conectores.")
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        fetchConectores()
    }, [fetchConectores])

    const handleConnect = async (tipo: "GOOGLE_DRIVE" | "GOOGLE_DOCS") => {
        setActionLoading(tipo)
        setError(null)
        const def = AVAILABLE_CONNECTORS.find((c) => c.tipo === tipo)
        const authPath = def?.authPath ?? tipo.toLowerCase().replace("_", "-")
        try {
            const res = await fetch(buildApiUrl(`/api/conectores/${authPath}/auth`), {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "Error iniciando conexión")
            // Abrir URL de OAuth en la misma ventana (volverá al chat con ?connector=...)
            window.location.href = data.authUrl
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error iniciando conexión")
            setActionLoading(null)
        }
    }

    const handleToggle = async (conector: ConectorInfo) => {
        setActionLoading(conector.tipo)
        setError(null)
        try {
            const newActivo = conector.estado !== "ACTIVO"
            const res = await fetch(buildApiUrl(`/api/conectores/${conector.id}`), {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ activo: newActivo }),
            })
            if (!res.ok) throw new Error("Error actualizando conector")
            await fetchConectores()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error actualizando conector")
        } finally {
            setActionLoading(null)
        }
    }

    const handleDisconnect = async (conector: ConectorInfo) => {
        setActionLoading(conector.tipo)
        setError(null)
        try {
            const res = await fetch(buildApiUrl(`/api/conectores/${conector.id}`), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error("Error eliminando conector")
            await fetchConectores()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error eliminando conector")
        } finally {
            setActionLoading(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Los conectores permiten al asistente interactuar con herramientas externas directamente desde el chat.
                    Solo disponibles para usuarios <span className="font-semibold text-foreground">Pro</span>.
                </p>
            </div>

            {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {AVAILABLE_CONNECTORS.map((def) => {
                    const conector = conectores.find((c) => c.tipo === def.tipo)
                    const isConnected = !!conector
                    const isLoading = actionLoading === def.tipo

                    return (
                        <div
                            key={def.tipo}
                            className="rounded-xl border border-border/70 bg-card p-4 space-y-3"
                        >
                            {/* Cabecera */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    {/* Logo placeholder (se carga si existe en /public) */}
                                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        {def.logoSrc ? (
                                            <Image
                                                src={def.logoSrc}
                                                alt={def.name}
                                                width={28}
                                                height={28}
                                                onError={(e) => {
                                                    // Fallback: ocultar imagen rota
                                                    ;(e.target as HTMLImageElement).style.display = "none"
                                                }}
                                                unoptimized
                                            />
                                        ) : (
                                            <Plug className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{def.name}</span>
                                            {isConnected && estadoBadge(conector!.estado)}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                                            {def.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Acción principal */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {isConnected ? (
                                        <>
                                            {/* Pausar / Reactivar */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={isLoading}
                                                onClick={() => handleToggle(conector!)}
                                                title={conector!.estado === "ACTIVO" ? "Pausar conector" : "Activar conector"}
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : conector!.estado === "ACTIVO" ? (
                                                    <PlugZap className="h-3.5 w-3.5" />
                                                ) : (
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                )}
                                                <span className="ml-1.5">
                                                    {conector!.estado === "ACTIVO" ? "Pausar" : "Activar"}
                                                </span>
                                            </Button>
                                            {/* Desconectar */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={isLoading}
                                                onClick={() => handleDisconnect(conector!)}
                                                className="text-muted-foreground hover:text-destructive"
                                                title="Desconectar y eliminar tokens"
                                            >
                                                <Unplug className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            size="sm"
                                            disabled={isLoading}
                                            onClick={() => handleConnect(def.tipo)}
                                        >
                                            {isLoading ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                            ) : (
                                                <Plug className="h-3.5 w-3.5 mr-1.5" />
                                            )}
                                            Conectar
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Info cuenta Google si está conectado */}
                            {isConnected && conector!.config?.googleEmail && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    {conector!.config.googlePicture && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={conector!.config.googlePicture}
                                            alt=""
                                            className="h-4 w-4 rounded-full"
                                        />
                                    )}
                                    Conectado como <span className="font-medium">{conector!.config.googleName || conector!.config.googleEmail}</span>
                                    {conector!.config.googleName && (
                                        <span className="text-muted-foreground/70">({conector!.config.googleEmail})</span>
                                    )}
                                </p>
                            )}

                            {/* Tools disponibles */}
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Herramientas disponibles:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {def.tools.map((tool) => (
                                        <span
                                            key={tool}
                                            className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                        >
                                            {tool}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Enlace a documentación */}
                            <a
                                href={def.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Ver documentación
                            </a>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
