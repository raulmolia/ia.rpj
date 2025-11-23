"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
    AlertCircle,
    BookOpen,
    CheckCircle2,
    UploadCloud,
    FileText,
    Loader2,
    RefreshCw,
    Tag,
    Search,
    Filter,
    Edit,
    Trash2,
    X,
    ArrowUpDown,
    Globe,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ThemeToggleButton } from "@/components/theme-toggle"
import { WebSourcesTable } from "@/components/web-sources-table"
import { useAuth } from "@/hooks/use-auth"
import { buildApiUrl } from "@/lib/utils"
const ALLOWED_ROLES = new Set(["SUPERADMIN", "ADMINISTRADOR", "DOCUMENTADOR", "DOCUMENTADOR_JUNIOR"])
const EDIT_DELETE_ROLES = new Set(["SUPERADMIN", "ADMINISTRADOR", "DOCUMENTADOR"])

type TagOption = {
    id: string
    label: string
}

type DocumentoItem = {
    id: string
    titulo: string
    nombreOriginal: string
    tamanoBytes: number
    tipoMime: string
    etiquetas: string[]
    descripcionGenerada?: string | null
    estadoProcesamiento: string
    fechaCreacion: string
    fechaProcesamiento?: string | null
    mensajeError?: string | null
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

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
    PENDIENTE: { label: "Pendiente", className: "border-slate-200 bg-slate-100 text-slate-800" },
    PROCESANDO: { label: "Procesando", className: "border-amber-200 bg-amber-100 text-amber-800" },
    COMPLETADO: { label: "Completado", className: "border-emerald-200 bg-emerald-100 text-emerald-800" },
    ERROR: { label: "Error", className: "border-red-200 bg-red-100 text-red-700" },
}

function formatDate(value?: string | null) {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)
}

function formatSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—"
    const units = ["B", "KB", "MB", "GB"]
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const size = bytes / 1024 ** exponent
    return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export default function DocumentacionPage() {
    const router = useRouter()
    const { status, isAuthenticated, user, token } = useAuth()

    const [tagOptions, setTagOptions] = useState<TagOption[]>([])
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [documents, setDocuments] = useState<DocumentoItem[]>([])
    const [loadingDocuments, setLoadingDocuments] = useState(false)
    const [loadingTags, setLoadingTags] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [formTitle, setFormTitle] = useState("")
    const [formDescription, setFormDescription] = useState("")
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [dropping, setDropping] = useState(false)
    const [feedback, setFeedback] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [activeView, setActiveView] = useState<"upload" | "library" | "web-sources" | "add-web-source">("upload")
    
    // Estados para fuentes web
    const [webUrl, setWebUrl] = useState("")
    const [webTipoFuente, setWebTipoFuente] = useState("PAGINA")
    const [webSelectedTags, setWebSelectedTags] = useState<string[]>([])
    const [webDescripcion, setWebDescripcion] = useState("")
    const [submittingWeb, setSubmittingWeb] = useState(false)
    
    // Nuevos estados para filtrado y edición
    const [searchTerm, setSearchTerm] = useState("")
    const [filterTags, setFilterTags] = useState<string[]>([])
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
    const [editingDocId, setEditingDocId] = useState<string | null>(null)
    const [editingTags, setEditingTags] = useState<string[]>([])
    const [editingTitle, setEditingTitle] = useState("")
    const [editingDescription, setEditingDescription] = useState("")
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
    const [updatingDoc, setUpdatingDoc] = useState(false)

    const canAccess = useMemo(
        () => Boolean(isAuthenticated && user && ALLOWED_ROLES.has(user.rol ?? "")),
        [isAuthenticated, user],
    )

    const canEditDelete = useMemo(
        () => Boolean(isAuthenticated && user && EDIT_DELETE_ROLES.has(user.rol ?? "")),
        [isAuthenticated, user],
    )

    useEffect(() => {
        if (status === "loading") return
        if (!canAccess) {
            router.replace("/")
        }
    }, [canAccess, router, status])

    useEffect(() => {
        if (!feedback) return
        const timer = setTimeout(() => setFeedback(null), 3200)
        return () => clearTimeout(timer)
    }, [feedback])

    const fetchTagOptions = useCallback(async () => {
        if (!token) return
        setLoadingTags(true)
        try {
            const response = await fetch(buildApiUrl("/api/documentos/etiquetas"), {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            })

            if (!response.ok) {
                throw new Error("No se pudieron cargar las etiquetas")
            }

            const data = await response.json()
            if (Array.isArray(data?.etiquetas)) {
                setTagOptions(data.etiquetas)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudieron cargar las etiquetas"
            setError(message)
        } finally {
            setLoadingTags(false)
        }
    }, [token])

    const fetchDocuments = useCallback(async () => {
        if (!token) return
        setLoadingDocuments(true)
        try {
            const response = await fetch(buildApiUrl("/api/documentos"), {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
            })

            if (!response.ok) {
                throw new Error("No se pudo cargar la biblioteca documental")
            }

            const data = await response.json()
            if (Array.isArray(data?.documentos)) {
                setDocuments(data.documentos)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo cargar la biblioteca documental"
            setError(message)
        } finally {
            setLoadingDocuments(false)
        }
    }, [token])

    useEffect(() => {
        if (!canAccess || !token) return
        fetchTagOptions()
        fetchDocuments()
    }, [canAccess, fetchDocuments, fetchTagOptions, token])

    const handleTagToggle = (tagId: string) => {
        setSelectedTags((prev) => {
            if (prev.includes(tagId)) {
                return prev.filter((value) => value !== tagId)
            }
            return [...prev, tagId]
        })
    }

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type === "application/pdf") {
            setSelectedFile(file)
            setError(null)
        } else if (file) {
            setError("Solo se admiten archivos PDF")
            setSelectedFile(null)
        }
    }

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.stopPropagation()
        if (!dropping) {
            setDropping(true)
        }
    }

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.stopPropagation()
        setDropping(false)
    }

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.stopPropagation()
        setDropping(false)

        const file = event.dataTransfer.files?.[0]
        if (file && file.type === "application/pdf") {
            setSelectedFile(file)
            setError(null)
        } else if (file) {
            setError("Solo se admiten archivos PDF")
            setSelectedFile(null)
        }
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!token) return

        if (!selectedFile) {
            setError("Debes seleccionar un archivo PDF")
            return
        }

        if (selectedTags.length === 0) {
            setError("Selecciona al menos una etiqueta")
            return
        }

        setUploading(true)
        setError(null)

        const formData = new FormData()
        formData.append("archivo", selectedFile)
        formData.append("titulo", formTitle.trim())
        if (formDescription.trim()) {
            formData.append("descripcion", formDescription.trim())
        }
        formData.append("etiquetas", JSON.stringify(selectedTags))

        try {
            const response = await fetch(buildApiUrl("/api/documentos"), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            })

            const body = await response.json().catch(() => ({}))

            if (!response.ok) {
                const message = body?.message || "No se pudo subir el documento"
                throw new Error(message)
            }

            setFeedback("Documento subido correctamente")
            setFormTitle("")
            setFormDescription("")
            setSelectedFile(null)
            setSelectedTags([])
            fetchDocuments()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo subir el documento"
            setError(message)
        } finally {
            setUploading(false)
        }
    }

    // Función para normalizar texto (sin acentos, minúsculas)
    const normalizeText = (text: string) => {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
    }

    // Filtrado y ordenamiento de documentos
    const filteredAndSortedDocuments = useMemo(() => {
        let filtered = documents

        // Filtrar por término de búsqueda
        if (searchTerm.trim()) {
            const normalizedSearch = normalizeText(searchTerm)
            filtered = filtered.filter((doc) => {
                const titulo = normalizeText(doc.titulo || "")
                const nombreOriginal = normalizeText(doc.nombreOriginal || "")
                const descripcion = normalizeText(doc.descripcionGenerada || "")
                return (
                    titulo.includes(normalizedSearch) ||
                    nombreOriginal.includes(normalizedSearch) ||
                    descripcion.includes(normalizedSearch)
                )
            })
        }

        // Filtrar por etiquetas seleccionadas
        if (filterTags.length > 0) {
            filtered = filtered.filter((doc) =>
                filterTags.some((tag) => doc.etiquetas.includes(tag))
            )
        }

        // Ordenar por fecha
        const sorted = [...filtered].sort((a, b) => {
            const dateA = new Date(a.fechaCreacion).getTime()
            const dateB = new Date(b.fechaCreacion).getTime()
            return sortOrder === "desc" ? dateB - dateA : dateA - dateB
        })

        return sorted
    }, [documents, searchTerm, filterTags, sortOrder])

    // Manejar toggle de etiqueta en filtro
    const handleFilterTagToggle = (tagId: string) => {
        setFilterTags((prev) => {
            if (prev.includes(tagId)) {
                return prev.filter((t) => t !== tagId)
            }
            return [...prev, tagId]
        })
    }

    // Iniciar edición de documento
    const startEditTags = (doc: DocumentoItem) => {
        setEditingDocId(doc.id)
        setEditingTags([...doc.etiquetas])
        setEditingTitle(doc.titulo)
        setEditingDescription(doc.descripcionGenerada || "")
    }

    // Cancelar edición
    const cancelEditTags = () => {
        setEditingDocId(null)
        setEditingTags([])
        setEditingTitle("")
        setEditingDescription("")
    }

    // Guardar cambios del documento
    const saveEditedTags = async (docId: string) => {
        if (!token) return
        if (editingTags.length === 0) {
            setError("Debe haber al menos una etiqueta")
            return
        }
        if (!editingTitle.trim()) {
            setError("El título no puede estar vacío")
            return
        }

        setUpdatingDoc(true)
        try {
            const response = await fetch(buildApiUrl(`/api/documentos/${docId}`), {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                    etiquetas: editingTags,
                    titulo: editingTitle.trim(),
                    descripcion: editingDescription.trim() || null,
                }),
            })

            if (!response.ok) {
                const body = await response.json().catch(() => ({}))
                throw new Error(body?.message || "No se pudo actualizar el documento")
            }

            setFeedback("Documento actualizado correctamente")
            setEditingDocId(null)
            setEditingTags([])
            setEditingTitle("")
            setEditingDescription("")
            fetchDocuments()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo actualizar"
            setError(message)
        } finally {
            setUpdatingDoc(false)
        }
    }

    // Manejar toggle de etiqueta en edición
    const handleEditTagToggle = (tagId: string) => {
        setEditingTags((prev) => {
            if (prev.includes(tagId)) {
                return prev.filter((t) => t !== tagId)
            }
            return [...prev, tagId]
        })
    }

    // Eliminar documento
    const deleteDocument = async (docId: string) => {
        if (!token) return

        setUpdatingDoc(true)
        try {
            const response = await fetch(buildApiUrl(`/api/documentos/${docId}`), {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            if (!response.ok) {
                const body = await response.json().catch(() => ({}))
                throw new Error(body?.message || "No se pudo eliminar el documento")
            }

            setFeedback("Documento eliminado correctamente")
            setDeletingDocId(null)
            fetchDocuments()
        } catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo eliminar"
            setError(message)
        } finally {
            setUpdatingDoc(false)
        }
    }

    if (status === "loading") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
                <BookOpen className="h-8 w-8 animate-pulse text-primary" />
                <p className="text-sm text-muted-foreground">Cargando documentación…</p>
            </div>
        )
    }

    if (!canAccess) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
                <div className="space-y-2">
                    <h1 className="text-xl font-semibold">Acceso restringido</h1>
                    <p className="text-sm text-muted-foreground">
                        Esta sección está disponible para usuarios con rol de documentación o administración.
                    </p>
                </div>
                <Button onClick={() => router.replace("/")}>Volver al panel principal</Button>
            </div>
        )
    }

    return (
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                        Gestión documental
                    </div>
                    <h1 className="text-3xl font-semibold leading-tight">Repositorio de recursos</h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        Sube documentos PDF y etiquétalos para que la IA pueda analizarlos y usarlos como contexto en futuras actividades.
                    </p>
                    {feedback && <p className="text-sm text-primary" role="status">{feedback}</p>}
                    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                </div>
                <ThemeToggleButton />
            </header>

            <nav className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant={activeView === "upload" ? "default" : "outline"}
                        onClick={() => setActiveView("upload")}
                        aria-pressed={activeView === "upload"}
                    >
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Subir documentos
                    </Button>
                    <Button
                        type="button"
                        variant={activeView === "library" ? "default" : "outline"}
                        onClick={() => setActiveView("library")}
                        aria-pressed={activeView === "library"}
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        Biblioteca documental
                    </Button>
                    <Button
                        type="button"
                        variant={activeView === "add-web-source" ? "default" : "outline"}
                        onClick={() => setActiveView("add-web-source")}
                        aria-pressed={activeView === "add-web-source"}
                    >
                        <Globe className="mr-2 h-4 w-4" />
                        Agregar fuente web
                    </Button>
                    <Button
                        type="button"
                        variant={activeView === "web-sources" ? "default" : "outline"}
                        onClick={() => setActiveView("web-sources")}
                        aria-pressed={activeView === "web-sources"}
                    >
                        <Globe className="mr-2 h-4 w-4" />
                        Ver fuentes web
                    </Button>
                </div>
                <Button variant="ghost" onClick={() => router.push("/")}>Volver al chat</Button>
            </nav>

            {activeView === "add-web-source" && (
                <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                    <header className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-foreground" aria-hidden="true" />
                        <h2 className="text-lg font-semibold">Agregar fuente web</h2>
                    </header>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Proporciona una URL para scrapear su contenido. El sistema procesará el texto y lo añadirá a la base vectorial.
                    </p>

                    <form className="mt-6 space-y-6" onSubmit={async (e) => {
                        e.preventDefault()
                        
                        if (!token) {
                            setError("No tienes autorización")
                            return
                        }

                        if (!webUrl || webSelectedTags.length === 0) {
                            setError("URL y al menos una etiqueta son obligatorios")
                            return
                        }

                        setSubmittingWeb(true)
                        setError(null)
                        setFeedback(null)

                        try {
                            const response = await fetch(buildApiUrl("/api/fuentes-web"), {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                    url: webUrl,
                                    tipoFuente: webTipoFuente,
                                    etiquetas: webSelectedTags,
                                    descripcion: webDescripcion || undefined,
                                }),
                            })

                            if (!response.ok) {
                                const errorData = await response.json()
                                throw new Error(errorData.error || "Error al agregar la fuente web")
                            }

                            setFeedback("Fuente web agregada correctamente. Procesando...")
                            setWebUrl("")
                            setWebTipoFuente("PAGINA")
                            setWebSelectedTags([])
                            setWebDescripcion("")
                            
                            // Cambiar a la vista de fuentes web después de 1.5 segundos
                            setTimeout(() => {
                                setActiveView("web-sources")
                                setFeedback(null)
                            }, 1500)
                        } catch (err) {
                            const message = err instanceof Error ? err.message : "Error al agregar la fuente web"
                            setError(message)
                        } finally {
                            setSubmittingWeb(false)
                        }
                    }}>
                        <div className="space-y-2">
                            <Label htmlFor="web-url" className="text-sm font-medium">
                                URL <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="web-url"
                                type="url"
                                placeholder="https://ejemplo.com/pagina"
                                required
                                value={webUrl}
                                onChange={(e) => setWebUrl(e.target.value)}
                                disabled={submittingWeb}
                                className="h-11"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">
                                Tipo de fuente <span className="text-destructive">*</span>
                            </Label>
                            <div className="grid gap-3">
                                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition hover:border-foreground/50 ${webTipoFuente === "PAGINA" ? "border-foreground bg-muted/50" : ""}`}>
                                    <input 
                                        type="radio" 
                                        name="tipoFuente" 
                                        value="PAGINA" 
                                        checked={webTipoFuente === "PAGINA"}
                                        onChange={(e) => setWebTipoFuente(e.target.value)}
                                        disabled={submittingWeb}
                                        className="mt-1 accent-foreground" 
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">Página individual</div>
                                        <div className="text-sm text-muted-foreground">Scraping de una URL específica</div>
                                    </div>
                                </label>
                                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition hover:border-foreground/50 ${webTipoFuente === "DOMINIO" ? "border-foreground bg-muted/50" : ""}`}>
                                    <input 
                                        type="radio" 
                                        name="tipoFuente" 
                                        value="DOMINIO" 
                                        checked={webTipoFuente === "DOMINIO"}
                                        onChange={(e) => setWebTipoFuente(e.target.value)}
                                        disabled={submittingWeb}
                                        className="mt-1 accent-foreground" 
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">Dominio completo</div>
                                        <div className="text-sm text-muted-foreground">Crawling del dominio (máx. 50 páginas)</div>
                                    </div>
                                </label>
                                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition hover:border-foreground/50 ${webTipoFuente === "SITEMAP" ? "border-foreground bg-muted/50" : ""}`}>
                                    <input 
                                        type="radio" 
                                        name="tipoFuente" 
                                        value="SITEMAP" 
                                        checked={webTipoFuente === "SITEMAP"}
                                        onChange={(e) => setWebTipoFuente(e.target.value)}
                                        disabled={submittingWeb}
                                        className="mt-1 accent-foreground" 
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">Sitemap XML</div>
                                        <div className="text-sm text-muted-foreground">Procesar todas las URLs del sitemap</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">
                                Etiquetas <span className="text-destructive">*</span>
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {tagOptions.map((tag) => {
                                    const isSelected = webSelectedTags.includes(tag.id)
                                    return (
                                        <Badge
                                            key={tag.id}
                                            variant="outline"
                                            className={`cursor-pointer px-3 py-1.5 transition-colors ${
                                                isSelected
                                                    ? "border-foreground bg-foreground text-background"
                                                    : "border-border bg-background text-foreground hover:border-foreground/50"
                                            }`}
                                            onClick={() => {
                                                if (!submittingWeb) {
                                                    setWebSelectedTags(prev =>
                                                        isSelected
                                                            ? prev.filter(t => t !== tag.id)
                                                            : [...prev, tag.id]
                                                    )
                                                }
                                            }}
                                        >
                                            {tag.label}
                                        </Badge>
                                    )
                                })}
                            </div>
                            {webSelectedTags.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    Selecciona al menos una etiqueta
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="web-descripcion" className="text-sm font-medium">
                                Descripción (opcional)
                            </Label>
                            <Input
                                id="web-descripcion"
                                placeholder="Añade una descripción o nota sobre esta fuente"
                                value={webDescripcion}
                                onChange={(e) => setWebDescripcion(e.target.value)}
                                disabled={submittingWeb}
                                className="h-11"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="submit" className="min-w-32" disabled={submittingWeb || webSelectedTags.length === 0}>
                                {submittingWeb ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Agregando...
                                    </>
                                ) : (
                                    "Agregar fuente"
                                )}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setActiveView("web-sources")} disabled={submittingWeb}>
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </section>
            )}

            {activeView === "upload" && (
                <form
                    className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <header className="flex items-center gap-3">
                        <UploadCloud className="h-5 w-5 text-primary" aria-hidden="true" />
                        <h2 className="text-lg font-semibold">Subir archivos</h2>
                    </header>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Arrastra un PDF o haz clic para seleccionarlo. Asigna etiquetas antes de enviarlo. El sistema extraerá el texto, generará una descripción breve y lo añadirá a la base vectorial.
                    </p>

                    <div
                        className={`mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${dropping ? "border-primary bg-primary/5" : "border-border/80"
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                const input = document.getElementById("input-archivo-documentacion") as HTMLInputElement | null
                                input?.click()
                            }
                        }}
                    >
                        <UploadCloud className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                        <p className="mt-3 text-sm font-medium text-muted-foreground">
                            Arrastra un archivo PDF aquí o haz clic para seleccionar
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Tamaño máximo 20 MB · Formato PDF</p>
                        <Input
                            id="input-archivo-documentacion"
                            type="file"
                            accept="application/pdf"
                            className="sr-only"
                            onChange={handleFileChange}
                        />
                        {selectedFile && (
                            <div className="mt-4 text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Archivo seleccionado:</span>{" "}
                                {selectedFile.name} · {formatSize(selectedFile.size)}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="titulo-documento">Título del documento</Label>
                            <Input
                                id="titulo-documento"
                                placeholder="Título de referencia"
                                value={formTitle}
                                onChange={(event) => setFormTitle(event.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Si lo dejas vacío se usará el nombre del archivo.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="descripcion-documento">Descripción (opcional)</Label>
                            <textarea
                                id="descripcion-documento"
                                placeholder="Descripción personalizada del documento"
                                value={formDescription}
                                onChange={(event) => setFormDescription(event.target.value)}
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <p className="text-xs text-muted-foreground">Si lo dejas vacío se generará automáticamente con IA.</p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Tag className="h-4 w-4 text-primary" aria-hidden="true" />
                                Etiquetas del documento
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {loadingTags && (
                                    <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" aria-hidden="true" />
                                        Cargando etiquetas…
                                    </Badge>
                                )}
                                {tagOptions.map((tag) => {
                                    const active = selectedTags.includes(tag.id)
                                    return (
                                        <Button
                                            key={tag.id}
                                            type="button"
                                            variant={active ? "default" : "outline"}
                                            className={`h-8 px-3 text-xs ${active ? "bg-primary text-primary-foreground" : ""}`}
                                            onClick={() => handleTagToggle(tag.id)}
                                            aria-pressed={active}
                                        >
                                            {tag.label}
                                        </Button>
                                    )
                                })}
                            </div>
                            {selectedTags.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Etiquetas seleccionadas: {selectedTags.length}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button type="submit" disabled={uploading}>
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    Procesando…
                                </>
                            ) : (
                                "Añadir a la biblioteca"
                            )}
                        </Button>
                    </div>
                    <div className="mt-6 flex justify-end lg:hidden">
                        <Button variant="ghost" onClick={() => setActiveView("library")}>Ir a la biblioteca</Button>
                    </div>
                </form>
            )}

            {activeView === "library" && (
                <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                    <header className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                                <h2 className="text-lg font-semibold">Biblioteca documental</h2>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Consulta, filtra y gestiona los documentos de la biblioteca.
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={fetchDocuments} disabled={loadingDocuments}>
                            {loadingDocuments ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    Actualizando…
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Actualizar
                                </>
                            )}
                        </Button>
                    </header>

                    {/* Filtros y búsqueda */}
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar documentos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="relative w-full sm:w-48">
                            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" />
                            <Select
                                value=""
                                onValueChange={(value) => {
                                    if (value) handleFilterTagToggle(value)
                                }}
                            >
                                <SelectTrigger className="pl-9">
                                    <SelectValue placeholder="Filtrar por etiqueta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tagOptions.map((tag) => (
                                        <SelectItem key={tag.id} value={tag.id}>
                                            {tag.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Tags de filtro activos */}
                    {filterTags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {filterTags.map((tagId) => {
                                const tagLabel = tagOptions.find((t) => t.id === tagId)?.label || tagId
                                return (
                                    <Badge
                                        key={tagId}
                                        className={`cursor-pointer ${TAG_COLOR_MAP[tagId] || "border-slate-200 bg-slate-100 text-slate-700"}`}
                                        onClick={() => handleFilterTagToggle(tagId)}
                                    >
                                        {tagLabel}
                                        <X className="ml-1 h-3 w-3" />
                                    </Badge>
                                )
                            })}
                        </div>
                    )}

                    <div className="mt-5 overflow-x-auto">
                        <table className="min-w-full divide-y divide-border/80 text-sm">
                            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Título</th>
                                    <th className="px-4 py-3 text-left font-medium">Descripción generada</th>
                                    <th className="px-4 py-3 text-left font-medium">Etiquetas</th>
                                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        <button
                                            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                                            className="flex items-center gap-1 hover:text-foreground"
                                        >
                                            Subida
                                            <ArrowUpDown className="h-3 w-3" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 text-sm">
                                {filteredAndSortedDocuments.length === 0 && !loadingDocuments && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                                            {searchTerm || filterTags.length > 0
                                                ? "No se encontraron documentos con los filtros aplicados."
                                                : "No hay documentos registrados todavía."}
                                        </td>
                                    </tr>
                                )}

                                {loadingDocuments && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                                            <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" aria-hidden="true" />
                                            Cargando biblioteca…
                                        </td>
                                    </tr>
                                )}

                                {filteredAndSortedDocuments.map((documento) => {
                                    const estado = STATUS_BADGE_MAP[documento.estadoProcesamiento] || STATUS_BADGE_MAP.PENDIENTE
                                    const isEditing = editingDocId === documento.id
                                    const isDeleting = deletingDocId === documento.id

                                    return (
                                        <tr key={documento.id} className="align-top">
                                            <td className="px-4 py-4">
                                                {isEditing ? (
                                                    <div className="space-y-2">
                                                        <div>
                                                            <Label htmlFor={`edit-titulo-${documento.id}`} className="text-xs">Título</Label>
                                                            <Input
                                                                id={`edit-titulo-${documento.id}`}
                                                                value={editingTitle}
                                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {documento.nombreOriginal} · {formatSize(documento.tamanoBytes)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="font-medium text-foreground">{documento.titulo}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {documento.nombreOriginal} · {formatSize(documento.tamanoBytes)}
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                {isEditing ? (
                                                    <div>
                                                        <Label htmlFor={`edit-descripcion-${documento.id}`} className="text-xs">Descripción</Label>
                                                        <textarea
                                                            id={`edit-descripcion-${documento.id}`}
                                                            value={editingDescription}
                                                            onChange={(e) => setEditingDescription(e.target.value)}
                                                            className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        {documento.estadoProcesamiento === "ERROR" && documento.mensajeError ? (
                                                            <div className="flex items-start gap-2 text-sm text-destructive">
                                                                <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                                                                <span>{documento.mensajeError}</span>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground">
                                                                {documento.descripcionGenerada || "En espera de procesamiento"}
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                {isEditing ? (
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Etiquetas</Label>
                                                        <div className="flex flex-wrap gap-1">
                                                            {tagOptions.map((tag) => {
                                                                const active = editingTags.includes(tag.id)
                                                                return (
                                                                    <Button
                                                                        key={tag.id}
                                                                        type="button"
                                                                        variant={active ? "default" : "outline"}
                                                                        size="sm"
                                                                        className="h-6 px-2 text-xs"
                                                                        onClick={() => handleEditTagToggle(tag.id)}
                                                                    >
                                                                        {tag.label}
                                                                    </Button>
                                                                )
                                                            })}
                                                        </div>
                                                        <div className="flex gap-2 pt-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => saveEditedTags(documento.id)}
                                                                disabled={updatingDoc || editingTags.length === 0 || !editingTitle.trim()}
                                                            >
                                                                {updatingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={cancelEditTags}
                                                                disabled={updatingDoc}
                                                            >
                                                                Cancelar
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {documento.etiquetas?.map((tag) => (
                                                            <Badge
                                                                key={`${documento.id}-${tag}`}
                                                                className={TAG_COLOR_MAP[tag] || "border-slate-200 bg-slate-100 text-slate-700"}
                                                            >
                                                                {tagOptions.find((option) => option.id === tag)?.label || tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <Badge className={estado.className}>{estado.label}</Badge>
                                                {documento.estadoProcesamiento === "COMPLETADO" && (
                                                    <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                                                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                                        {formatDate(documento.fechaProcesamiento)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(documento.fechaCreacion)}</td>
                                            <td className="px-4 py-4">
                                                {isDeleting ? (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-xs text-muted-foreground">¿Eliminar?</p>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => deleteDocument(documento.id)}
                                                                disabled={updatingDoc}
                                                            >
                                                                {updatingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sí"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setDeletingDocId(null)}
                                                                disabled={updatingDoc}
                                                            >
                                                                No
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-2">
                                                        {canEditDelete && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => startEditTags(documento)}
                                                                    disabled={isEditing || editingDocId !== null}
                                                                    title="Editar etiquetas"
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => setDeletingDocId(documento.id)}
                                                                    disabled={deletingDocId !== null || editingDocId !== null}
                                                                    title="Eliminar documento"
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {!canEditDelete && (
                                                            <span className="text-xs text-muted-foreground">Sin permisos</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end lg:hidden">
                        <Button variant="ghost" onClick={() => setActiveView("upload")}>Subir un nuevo documento</Button>
                    </div>
                </section>
            )}

            {activeView === "web-sources" && (
                <WebSourcesTable
                    token={token}
                    tagOptions={tagOptions}
                    canEditDelete={canEditDelete}
                />
            )}

            <section className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-6 text-sm text-muted-foreground">
                <p>
                    Los documentos y fuentes web se almacenan en el servidor y su contenido se replica en la base vectorial para poder consultarlo desde la IA. Mantén actualizado este espacio con materiales útiles para monitores y animadores.
                </p>
            </section>
        </div>
    )
}
