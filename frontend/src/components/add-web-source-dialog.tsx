"use client"

import { useState, type FormEvent } from "react"
import { Globe, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { buildApiUrl } from "@/lib/utils"

type TagOption = {
    id: string
    label: string
}

type AddWebSourceDialogProps = {
    isOpen: boolean
    onClose: () => void
    token: string | null
    tagOptions: TagOption[]
    onSuccess: () => void
}

const SOURCE_TYPES = [
    { value: "PAGINA", label: "Página individual", description: "Scraping de una URL específica" },
    { value: "DOMINIO", label: "Dominio completo", description: "Crawling del dominio (máx. 50 páginas)" },
    { value: "SITEMAP", label: "Sitemap XML", description: "Procesar todas las URLs del sitemap" },
]

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

export function AddWebSourceDialog({ isOpen, onClose, token, tagOptions, onSuccess }: AddWebSourceDialogProps) {
    const [url, setUrl] = useState("")
    const [descripcion, setDescripcion] = useState("")
    const [tipoFuente, setTipoFuente] = useState("PAGINA")
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const resetForm = () => {
        setUrl("")
        setDescripcion("")
        setTipoFuente("PAGINA")
        setSelectedTags([])
        setError(null)
        setSuccess(false)
    }

    const handleClose = () => {
        if (!submitting) {
            resetForm()
            onClose()
        }
    }

    const toggleTag = (tagId: string) => {
        setSelectedTags((prev) =>
            prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
        )
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        
        if (!url.trim()) {
            setError("Debes proporcionar una URL")
            return
        }

        if (selectedTags.length === 0) {
            setError("Debes seleccionar al menos una etiqueta")
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            const response = await fetch(buildApiUrl("/api/fuentes-web"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    url: url.trim(),
                    descripcion: descripcion.trim() || undefined,
                    tipoFuente,
                    etiquetas: selectedTags,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Error al agregar la fuente web")
            }

            setSuccess(true)
            setTimeout(() => {
                onSuccess()
                handleClose()
            }, 1500)
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error desconocido"
            setError(message)
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {/* Header */}
                <div className="flex items-center justify-between border-b p-6 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                Agregar Fuente Web
                            </h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                El contenido se procesará y vectorizará automáticamente
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClose}
                        disabled={submitting}
                        className="h-8 w-8 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="space-y-6 p-6">
                    {/* URL */}
                    <div className="space-y-2">
                        <Label htmlFor="url" className="text-sm font-medium">
                            URL <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="url"
                            type="url"
                            placeholder="https://ejemplo.com/pagina"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={submitting}
                            required
                            className="h-11"
                        />
                    </div>

                    {/* Tipo de fuente */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">
                            Tipo de fuente <span className="text-red-500">*</span>
                        </Label>
                        <div className="grid gap-3">
                            {SOURCE_TYPES.map((type) => (
                                <label
                                    key={type.value}
                                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                                        tipoFuente === type.value
                                            ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950"
                                            : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="tipoFuente"
                                        value={type.value}
                                        checked={tipoFuente === type.value}
                                        onChange={(e) => setTipoFuente(e.target.value)}
                                        disabled={submitting}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-900 dark:text-white">
                                            {type.label}
                                        </div>
                                        <div className="text-sm text-slate-600 dark:text-slate-400">
                                            {type.description}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Etiquetas */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">
                            Etiquetas <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex flex-wrap gap-2">
                            {tagOptions.map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant="outline"
                                    className={`cursor-pointer px-3 py-1.5 transition-colors ${
                                        selectedTags.includes(tag.id)
                                            ? TAG_COLOR_MAP[tag.id] || ""
                                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                                    }`}
                                    onClick={() => !submitting && toggleTag(tag.id)}
                                >
                                    {tag.label}
                                </Badge>
                            ))}
                        </div>
                        {selectedTags.length === 0 && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Selecciona al menos una etiqueta
                            </p>
                        )}
                    </div>

                    {/* Descripción */}
                    <div className="space-y-2">
                        <Label htmlFor="descripcion" className="text-sm font-medium">
                            Descripción (opcional)
                        </Label>
                        <Input
                            id="descripcion"
                            type="text"
                            placeholder="Breve descripción de la fuente"
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            disabled={submitting}
                            className="h-11"
                        />
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                            <span>Fuente web agregada correctamente. Procesando...</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting || success}>
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Agregando...
                                </>
                            ) : (
                                <>
                                    <Globe className="mr-2 h-4 w-4" />
                                    Agregar Fuente
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
