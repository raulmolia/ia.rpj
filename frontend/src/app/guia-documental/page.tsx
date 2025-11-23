"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookOpenCheck, Loader2, Info as InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { useAuth } from "@/hooks/use-auth"
import { buildApiUrl } from "@/lib/utils"

type Document = {
    id: string
    titulo: string
    nombreOriginal: string
    tamanoBytes: number
    descripcionGenerada: string | null
    etiquetas: string[]
}

const TAG_COLOR_MAP: Record<string, string> = {
    PROGRAMACIONES: "border-blue-200 bg-blue-100 text-blue-800",
    DINAMICAS: "border-emerald-200 bg-emerald-100 text-emerald-800",
    CELEBRACIONES: "border-pink-200 bg-pink-100 text-pink-800",
    ORACIONES: "border-violet-200 bg-violet-100 text-violet-800",
    CONSULTA: "border-cyan-200 bg-cyan-100 text-cyan-800",
    PASTORAL_GENERICO: "border-indigo-200 bg-indigo-100 text-indigo-800",
    REVISTAS: "border-amber-200 bg-amber-100 text-amber-800",
    CONTENIDO_MIXTO: "border-slate-200 bg-slate-100 text-slate-800",
    OTROS: "border-gray-200 bg-gray-100 text-gray-800",
}

const TAG_LABELS: Record<string, string> = {
    PROGRAMACIONES: "Programaciones",
    DINAMICAS: "Dinámicas",
    CELEBRACIONES: "Celebraciones",
    ORACIONES: "Oraciones",
    CONSULTA: "Consulta",
    PASTORAL_GENERICO: "Pastoral Genérico",
    REVISTAS: "Revistas",
    CONTENIDO_MIXTO: "Contenido Mixto",
    OTROS: "Otros",
}

function formatSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—"
    const units = ["B", "KB", "MB", "GB"]
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const size = bytes / 1024 ** exponent
    return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export default function GuiaDocumentalPage() {
    const router = useRouter()
    const { token, isAuthenticated, user, status } = useAuth()
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(false)
    const [activeView, setActiveView] = useState<"info" | "repository">("info")
    const [error, setError] = useState<string | null>(null)

    const hasAccess = isAuthenticated && user && ["SUPERADMIN", "ADMINISTRADOR", "DOCUMENTADOR", "DOCUMENTADOR_JUNIOR"].includes(user.rol || "")

    const loadDocuments = useCallback(async () => {
        if (!token) {
            setError("Debes iniciar sesión para ver el repositorio")
            return
        }
        
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(buildApiUrl("/api/documentos"), {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            if (response.ok) {
                const data = await response.json()
                setDocuments(data.documentos || [])
            } else if (response.status === 403) {
                setError("No tienes permisos para ver el repositorio documental")
            } else {
                setError("Error al cargar los documentos")
            }
        } catch (error) {
            console.error("Error cargando documentos:", error)
            setError("Error de conexión al cargar los documentos")
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        if (activeView === "repository" && documents.length === 0 && !error && token) {
            loadDocuments()
        }
    }, [activeView, documents.length, error, token, loadDocuments])

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="container mx-auto flex items-center justify-between px-6 py-4">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Volver al chat
                        </Button>
                    </Link>
                    <ThemeToggleButton />
                </div>
            </header>

            <main className="container mx-auto max-w-5xl px-6 py-12">
                <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-border bg-card shadow-sm">
                        <InfoIcon className="h-8 w-8 text-foreground" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">Guía Documental</h1>
                        <p className="mt-1 text-lg text-muted-foreground">
                            Consulta el repositorio de conocimiento del asistente
                        </p>
                    </div>
                </div>

                <div className="mb-6 flex gap-2">
                    <Button
                        onClick={() => setActiveView("info")}
                        variant={activeView === "info" ? "default" : "outline"}
                        className="gap-2"
                    >
                        <InfoIcon className="h-4 w-4" />
                        Información
                    </Button>
                    <Button
                        onClick={() => setActiveView("repository")}
                        variant={activeView === "repository" ? "default" : "outline"}
                        disabled={loading}
                        className="gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando...
                            </>
                        ) : (
                            <>
                                <BookOpenCheck className="h-4 w-4" />
                                Repositorio
                            </>
                        )}
                    </Button>
                </div>

                {activeView === "info" && (
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        <section className="mb-12">
                            <h2 className="text-2xl font-semibold mb-4">¿Qué es el repositorio documental?</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                El repositorio documental es una base de conocimiento vectorial que contiene documentación relevante 
                                para la pastoral juvenil. Estos documentos se han procesado y almacenado en forma de vectores semánticos 
                                que el asistente utiliza para enriquecer sus respuestas con contenido específico de la organización.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                Los documentos están indexados en la base vectorial y no se pueden descargar ni abrir directamente desde 
                                esta interfaz, pero puedes consultar qué contenido está disponible y cómo está categorizado.
                            </p>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-2xl font-semibold mb-4">Etiquetas de clasificación</h2>
                            <p className="text-muted-foreground leading-relaxed mb-4">
                                Los documentos están organizados mediante etiquetas temáticas:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li><strong>Programaciones:</strong> Planificaciones de actividades, campamentos, encuentros</li>
                                <li><strong>Dinámicas:</strong> Juegos, actividades grupales, icebreakers</li>
                                <li><strong>Celebraciones:</strong> Liturgias, eucaristías, celebraciones especiales</li>
                                <li><strong>Oraciones:</strong> Reflexiones, momentos de oración, textos espirituales</li>
                                <li><strong>Consulta:</strong> Material de referencia general</li>
                                <li><strong>Pastoral Genérico:</strong> Contenido pastoral sin categoría específica</li>
                                <li><strong>Revistas:</strong> Publicaciones periódicas, boletines</li>
                                <li><strong>Contenido Mixto:</strong> Documentos con varios tipos de contenido</li>
                                <li><strong>Otros:</strong> Cualquier otro tipo de documento</li>
                            </ul>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-2xl font-semibold mb-4">Cómo usa la IA los documentos</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Cuando realizas una consulta en el chat, el asistente busca automáticamente en los documentos 
                                relevantes según la intención detectada (dinámicas, oraciones, programaciones, etc.). Los fragmentos 
                                más pertinentes se incluyen como contexto para generar respuestas más precisas y personalizadas a tu 
                                organización.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                La búsqueda se realiza mediante similitud vectorial, lo que permite encontrar contenido relevante 
                                incluso cuando no coinciden exactamente las palabras utilizadas en tu pregunta.
                            </p>
                        </section>
                    </div>
                )}

                {activeView === "repository" && (
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : error ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
                                <p className="text-amber-800 dark:text-amber-200">{error}</p>
                                {!isAuthenticated && (
                                    <Link href="/auth/login" className="mt-4 inline-block">
                                        <Button size="sm">Iniciar sesión</Button>
                                    </Link>
                                )}
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                No hay documentos disponibles en el repositorio
                            </div>
                        ) : (
                            <>
                                <table className="min-w-full divide-y divide-border/80 text-sm">
                                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">Título</th>
                                            <th className="px-4 py-3 text-left font-medium">Descripción generada</th>
                                            <th className="px-4 py-3 text-left font-medium">Etiquetas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60 text-sm">
                                        {documents.map((doc) => (
                                            <tr key={doc.id} className="align-top">
                                                <td className="px-4 py-4">
                                                    <div className="font-medium text-foreground">{doc.titulo}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {doc.nombreOriginal} · {formatSize(doc.tamanoBytes)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        {doc.descripcionGenerada || "Sin descripción"}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {doc.etiquetas.map((tag) => (
                                                            <Badge
                                                                key={`${doc.id}-${tag}`}
                                                                className={TAG_COLOR_MAP[tag] || TAG_COLOR_MAP.OTROS}
                                                            >
                                                                {TAG_LABELS[tag] || tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-sm text-muted-foreground mt-4">
                                    Los documentos mostrados están almacenados en la base vectorial y son utilizados por el asistente 
                                    para proporcionar respuestas contextualizadas.
                                </p>
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
