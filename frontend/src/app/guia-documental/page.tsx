"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookOpenCheck, Loader2, Info as InfoIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { useAuth } from "@/hooks/use-auth"
import { buildApiUrl } from "@/lib/utils"
import { useTranslations } from "next-intl"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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
    const t = useTranslations("guide")
    const tc = useTranslations("categories")
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(false)
    const [activeView, setActiveView] = useState<"info" | "repository">("info")
    const [error, setError] = useState<string | null>(null)
    
    // Paginación
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(25)

    const hasAccess = isAuthenticated && user && ["SUPERADMIN", "ADMINISTRADOR", "DOCUMENTADOR", "DOCUMENTADOR_JUNIOR"].includes(user.rol || "")

    // Cálculos de paginación
    const totalPages = useMemo(() => Math.ceil(documents.length / itemsPerPage), [documents.length, itemsPerPage])
    const paginatedDocuments = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return documents.slice(startIndex, startIndex + itemsPerPage)
    }, [documents, currentPage, itemsPerPage])

    // Reset página al cambiar items por página
    useEffect(() => {
        setCurrentPage(1)
    }, [itemsPerPage])

    const loadDocuments = useCallback(async () => {
        if (!token) {
            setError(t("loginRequired"))
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
                setError(t("noPermission"))
            } else {
                setError(t("loadError"))
            }
        } catch (error) {
            console.error("Error cargando documentos:", error)
            setError(t("connectionError"))
        } finally {
            setLoading(false)
        }
    }, [token, t])

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
                            {t("backToChat")}
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
                        <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
                        <p className="mt-1 text-lg text-muted-foreground">
                            {t("subtitle")}
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
                        {t("infoTab")}
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
                                {t("loading")}
                            </>
                        ) : (
                            <>
                                <BookOpenCheck className="h-4 w-4" />
                                {t("repositoryTab")}
                            </>
                        )}
                    </Button>
                </div>

                {activeView === "info" && (
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        <section className="mb-12">
                            <h2 className="text-2xl font-semibold mb-4">{t("whatIsRepository")}</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                {t("whatIsRepositoryDesc1")}
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                {t("whatIsRepositoryDesc2")}
                            </p>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-2xl font-semibold mb-4">{t("tagsTitle")}</h2>
                            <p className="text-muted-foreground leading-relaxed mb-4">
                                {t("tagsDesc")}
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li><strong>{t("tagProgramaciones")}</strong> {t("tagProgramacionesDesc")}</li>
                                <li><strong>{t("tagDinamicas")}</strong> {t("tagDinamicasDesc")}</li>
                                <li><strong>{t("tagCelebraciones")}</strong> {t("tagCelebracionesDesc")}</li>
                                <li><strong>{t("tagOraciones")}</strong> {t("tagOracionesDesc")}</li>
                                <li><strong>{t("tagConsulta")}</strong> {t("tagConsultaDesc")}</li>
                                <li><strong>{t("tagPastoralGenerico")}</strong> {t("tagPastoralGenericoDesc")}</li>
                                <li><strong>{t("tagRevistas")}</strong> {t("tagRevistasDesc")}</li>
                                <li><strong>{t("tagContenidoMixto")}</strong> {t("tagContenidoMixtoDesc")}</li>
                                <li><strong>{t("tagOtros")}</strong> {t("tagOtrosDesc")}</li>
                            </ul>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-2xl font-semibold mb-4">{t("howAIUsesTitle")}</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                {t("howAIUsesDesc")}
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
                                        <Button size="sm">{t("loginButton")}</Button>
                                    </Link>
                                )}
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                {t("noDocuments")}
                            </div>
                        ) : (
                            <>
                                <table className="min-w-full divide-y divide-border/80 text-sm">
                                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">{t("tableTitle")}</th>
                                            <th className="px-4 py-3 text-left font-medium">{t("tableDescription")}</th>
                                            <th className="px-4 py-3 text-left font-medium">{t("tableTags")}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60 text-sm">
                                        {paginatedDocuments.map((doc) => (
                                            <tr key={doc.id} className="align-top">
                                                <td className="px-4 py-4">
                                                    <div className="font-medium text-foreground">{doc.titulo}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {doc.nombreOriginal} · {formatSize(doc.tamanoBytes)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        {doc.descripcionGenerada || t("noDescription")}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {doc.etiquetas.map((tag) => (
                                                            <Badge
                                                                key={`${doc.id}-${tag}`}
                                                                className={TAG_COLOR_MAP[tag] || TAG_COLOR_MAP.OTROS}
                                                            >
                                                                {tc(tag.toLowerCase()) || tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                
                                {/* Controles de paginación */}
                                <div className="flex items-center justify-between border-t border-border/60 px-4 py-4 mt-4">
                                    {/* Selector de items por página */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">{t("show")}</span>
                                        <Select
                                            value={itemsPerPage.toString()}
                                            onValueChange={(value) => setItemsPerPage(Number(value))}
                                        >
                                            <SelectTrigger className="w-[80px] h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <span className="text-sm text-muted-foreground">
                                            {t("ofDocuments", { count: documents.length })}
                                        </span>
                                    </div>
                                    
                                    {/* Navegación de páginas */}
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronsLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        
                                        <span className="px-3 text-sm text-muted-foreground">
                                            {t("page", { current: currentPage, total: totalPages })}
                                        </span>
                                        
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                        >
                                            <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                
                                <p className="text-sm text-muted-foreground mt-4">
                                    {t("repositoryNote")}
                                </p>
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
