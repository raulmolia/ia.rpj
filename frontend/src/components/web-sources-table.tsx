"use client"

import { useState, useMemo, useEffect } from "react"
import {
    Globe,
    Loader2,
    RefreshCw,
    Edit,
    Trash2,
    Search,
    Filter,
    ArrowUpDown,
    CheckCircle2,
    AlertCircle,
    Clock,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { buildApiUrl } from "@/lib/utils"

type TagOption = {
    id: string
    label: string
}

type FuenteWeb = {
    id: string
    url: string
    dominio: string
    titulo?: string | null
    descripcion?: string | null
    etiquetas: string[]
    tipoFuente: string
    estadoProcesamiento: string
    mensajeError?: string | null
    activa: boolean
    fechaCreacion: string
    fechaProcesamiento?: string | null
}

type WebSourcesTableProps = {
    token: string | null
    tagOptions: TagOption[]
    canEditDelete: boolean
}

const TAG_COLOR_MAP: Record<string, string> = {
    PROGRAMACIONES: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
    DINAMICAS: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    CELEBRACIONES: "border-pink-200 bg-pink-100 text-pink-800 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-200",
    ORACIONES: "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
    CONSULTA: "border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
    PASTORAL_GENERICO: "border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    REVISTAS: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    CONTENIDO_MIXTO: "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    OTROS: "border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
}

const STATUS_BADGE_MAP: Record<string, { label: string; className: string; icon: any }> = {
    PENDIENTE: { 
        label: "Pendiente", 
        className: "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
        icon: Clock
    },
    PROCESANDO: { 
        label: "Procesando", 
        className: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
        icon: Loader2
    },
    COMPLETADO: { 
        label: "Completado", 
        className: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        icon: CheckCircle2
    },
    ERROR: { 
        label: "Error", 
        className: "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
        icon: AlertCircle
    },
}

const TYPE_LABELS: Record<string, string> = {
    PAGINA: "Página",
    DOMINIO: "Dominio",
    SITEMAP: "Sitemap",
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

function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
}

export function WebSourcesTable({ token, tagOptions, canEditDelete }: WebSourcesTableProps) {
    const [sources, setSources] = useState<FuenteWeb[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [filterTags, setFilterTags] = useState<string[]>([])
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingTags, setEditingTags] = useState<string[]>([])
    const [editingDescription, setEditingDescription] = useState("")
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [updating, setUpdating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Cargar fuentes automáticamente al montar el componente
    useEffect(() => {
        fetchSources()
    }, [token])

    const fetchSources = async () => {
        if (!token) return
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(buildApiUrl("/api/fuentes-web"), {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            })

            if (!response.ok) throw new Error("Error al cargar fuentes web")

            const data = await response.json()
            if (Array.isArray(data?.fuentes)) {
                setSources(data.fuentes)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error desconocido"
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (source: FuenteWeb) => {
        setEditingId(source.id)
        setEditingTags(source.etiquetas || [])
        setEditingDescription(source.descripcion || "")
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setEditingTags([])
        setEditingDescription("")
    }

    const handleSaveEdit = async (sourceId: string) => {
        setUpdating(true)
        try {
            const response = await fetch(buildApiUrl(`/api/fuentes-web/${sourceId}`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    etiquetas: editingTags,
                    descripcion: editingDescription.trim() || null,
                }),
            })

            if (!response.ok) throw new Error("Error al actualizar fuente")

            await fetchSources()
            handleCancelEdit()
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error desconocido"
            setError(message)
        } finally {
            setUpdating(false)
        }
    }

    const handleDelete = async (sourceId: string) => {
        setUpdating(true)
        try {
            const response = await fetch(buildApiUrl(`/api/fuentes-web/${sourceId}`), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            })

            if (!response.ok) throw new Error("Error al eliminar fuente")

            await fetchSources()
            setDeletingId(null)
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error desconocido"
            setError(message)
        } finally {
            setUpdating(false)
        }
    }

    const handleReprocess = async (sourceId: string) => {
        setUpdating(true)
        try {
            const response = await fetch(buildApiUrl(`/api/fuentes-web/${sourceId}/reprocesar`), {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            })

            if (!response.ok) throw new Error("Error al reprocesar fuente")

            await fetchSources()
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error desconocido"
            setError(message)
        } finally {
            setUpdating(false)
        }
    }

    const toggleFilterTag = (tagId: string) => {
        setFilterTags((prev) =>
            prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
        )
    }

    const toggleEditTag = (tagId: string) => {
        setEditingTags((prev) =>
            prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
        )
    }

    const filteredSources = useMemo(() => {
        let filtered = [...sources]

        if (searchTerm.trim()) {
            const normalized = normalizeString(searchTerm.trim())
            filtered = filtered.filter((source) => {
                const titulo = normalizeString(source.titulo || "")
                const url = normalizeString(source.url || "")
                const descripcion = normalizeString(source.descripcion || "")
                return titulo.includes(normalized) || url.includes(normalized) || descripcion.includes(normalized)
            })
        }

        if (filterTags.length > 0) {
            filtered = filtered.filter((source) =>
                filterTags.some((tag) => source.etiquetas?.includes(tag))
            )
        }

        filtered.sort((a, b) => {
            const dateA = new Date(a.fechaCreacion).getTime()
            const dateB = new Date(b.fechaCreacion).getTime()
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA
        })

        return filtered
    }, [sources, searchTerm, filterTags, sortOrder])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Globe className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Fuentes Web
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {sources.length} {sources.length === 1 ? "fuente" : "fuentes"} registradas
                        </p>
                    </div>
                </div>
                <Button
                    onClick={fetchSources}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Actualizar
                </Button>
            </div>

            {/* Filters */}
            <div className="space-y-4">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Buscar por título, URL o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-10 pl-10"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    >
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                        {sortOrder === "asc" ? "Más antiguos" : "Más recientes"}
                    </Button>
                </div>

                {/* Tag filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Filtrar:</span>
                    {tagOptions.map((tag) => (
                        <Badge
                            key={tag.id}
                            variant="outline"
                            className={`cursor-pointer transition-colors ${
                                filterTags.includes(tag.id)
                                    ? TAG_COLOR_MAP[tag.id] || ""
                                    : "hover:border-slate-400 dark:hover:border-slate-500"
                            }`}
                            onClick={() => toggleFilterTag(tag.id)}
                        >
                            {tag.label}
                        </Badge>
                    ))}
                    {filterTags.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilterTags([])}
                            className="h-7 px-2 text-xs"
                        >
                            Limpiar filtros
                        </Button>
                    )}
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setError(null)}
                        className="ml-auto h-6 w-6 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : filteredSources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Globe className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-700" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {sources.length === 0
                                ? "No hay fuentes web registradas"
                                : "No se encontraron fuentes con los filtros aplicados"}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                                        URL / Título
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                                        Tipo
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                                        Estado
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                                        Etiquetas
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                                        Fecha
                                    </th>
                                    {canEditDelete && (
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-400">
                                            Acciones
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {filteredSources.map((source) => {
                                    const isEditing = editingId === source.id
                                    const StatusIcon = STATUS_BADGE_MAP[source.estadoProcesamiento]?.icon || Clock

                                    return (
                                        <tr key={source.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    <div className="font-medium text-slate-900 dark:text-white">
                                                        {source.titulo || source.dominio}
                                                    </div>
                                                    <a
                                                        href={source.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                                                    >
                                                        {source.url}
                                                    </a>
                                                    {isEditing ? (
                                                        <Input
                                                            value={editingDescription}
                                                            onChange={(e) => setEditingDescription(e.target.value)}
                                                            placeholder="Descripción..."
                                                            className="mt-2 h-8 text-xs"
                                                        />
                                                    ) : (
                                                        source.descripcion && (
                                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                                {source.descripcion}
                                                            </p>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="text-xs">
                                                    {TYPE_LABELS[source.tipoFuente] || source.tipoFuente}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    variant="outline"
                                                    className={`flex w-fit items-center gap-1 text-xs ${
                                                        STATUS_BADGE_MAP[source.estadoProcesamiento]?.className || ""
                                                    }`}
                                                >
                                                    <StatusIcon
                                                        className={`h-3 w-3 ${
                                                            source.estadoProcesamiento === "PROCESANDO" ? "animate-spin" : ""
                                                        }`}
                                                    />
                                                    {STATUS_BADGE_MAP[source.estadoProcesamiento]?.label || source.estadoProcesamiento}
                                                </Badge>
                                                {source.mensajeError && (
                                                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                                        {source.mensajeError}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {isEditing ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {tagOptions.map((tag) => (
                                                            <Badge
                                                                key={tag.id}
                                                                variant="outline"
                                                                className={`cursor-pointer text-xs ${
                                                                    editingTags.includes(tag.id)
                                                                        ? TAG_COLOR_MAP[tag.id] || ""
                                                                        : "hover:border-slate-400"
                                                                }`}
                                                                onClick={() => toggleEditTag(tag.id)}
                                                            >
                                                                {tag.label}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {source.etiquetas?.map((tag) => {
                                                            const tagOption = tagOptions.find((t) => t.id === tag)
                                                            return (
                                                                <Badge
                                                                    key={tag}
                                                                    variant="outline"
                                                                    className={`text-xs ${TAG_COLOR_MAP[tag] || ""}`}
                                                                >
                                                                    {tagOption?.label || tag}
                                                                </Badge>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                {formatDate(source.fechaCreacion)}
                                            </td>
                                            {canEditDelete && (
                                                <td className="px-4 py-3">
                                                    {deletingId === source.id ? (
                                                        <div className="flex flex-col gap-2">
                                                            <p className="text-xs text-muted-foreground">¿Eliminar?</p>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() => handleDelete(source.id)}
                                                                    disabled={updating}
                                                                >
                                                                    {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sí"}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => setDeletingId(null)}
                                                                    disabled={updating}
                                                                >
                                                                    No
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-1">
                                                            {isEditing ? (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleSaveEdit(source.id)}
                                                                        disabled={updating}
                                                                        className="h-7 px-2"
                                                                    >
                                                                        Guardar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={handleCancelEdit}
                                                                        disabled={updating}
                                                                        className="h-7 px-2"
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {source.estadoProcesamiento === "ERROR" && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleReprocess(source.id)}
                                                                            disabled={updating}
                                                                            title="Reprocesar"
                                                                            className="h-7 w-7 p-0"
                                                                        >
                                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleEdit(source)}
                                                                        disabled={updating || deletingId !== null}
                                                                        title="Editar"
                                                                        className="h-7 w-7 p-0"
                                                                    >
                                                                        <Edit className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => setDeletingId(source.id)}
                                                                        disabled={updating || deletingId !== null || editingId !== null}
                                                                        title="Eliminar"
                                                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
