'use client'

import { useCallback, useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    FileText,
    FolderOpen,
    Search,
    Table2,
    Presentation,
    File,
    Check,
    X,
    AlertTriangle,
} from 'lucide-react'
import { buildApiUrl } from '@/lib/utils'

/** Icono del logo de Google Drive (SVG inline) */
function GoogleDriveIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 87.3 78" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.55z" fill="#ea4335" />
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
            <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
        </svg>
    )
}

interface DriveFile {
    id: string
    name: string
    mimeType: string
    webViewLink?: string
    modifiedTime?: string
    size?: string
}

interface GoogleDrivePickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    token: string
    onFilesSelected: (files: Array<{
        fileName: string
        mimeType: string
        size: number
        text: string
        wordCount: number
        fromDrive: boolean
        driveFileId: string
    }>) => void
}

const MIME_TYPE_ICONS: Record<string, typeof FileText> = {
    'application/vnd.google-apps.document': FileText,
    'application/vnd.google-apps.spreadsheet': Table2,
    'application/vnd.google-apps.presentation': Presentation,
    'application/vnd.google-apps.folder': FolderOpen,
    'text/plain': FileText,
    'text/csv': Table2,
    'application/json': FileText,
}

const MIME_TYPE_LABELS: Record<string, string> = {
    'application/vnd.google-apps.document': 'Documento',
    'application/vnd.google-apps.spreadsheet': 'Hoja de cálculo',
    'application/vnd.google-apps.presentation': 'Presentación',
    'application/vnd.google-apps.folder': 'Carpeta',
    'text/plain': 'Texto',
    'text/csv': 'CSV',
    'application/json': 'JSON',
}

// Tipos de archivo que podemos adjuntar como texto
const ATTACHABLE_TYPES = new Set([
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'text/plain',
    'text/csv',
    'text/html',
    'text/markdown',
    'application/json',
])

export function GoogleDrivePicker({ open, onOpenChange, token, onFilesSelected }: GoogleDrivePickerProps) {
    const [files, setFiles] = useState<DriveFile[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
    const [downloading, setDownloading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchFiles = useCallback(async (query?: string) => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({ pageSize: '30' })
            if (query) params.set('query', query)

            const res = await fetch(buildApiUrl(`/api/conectores/google-drive/files?${params}`), {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || `Error ${res.status}`)
            }
            const data = await res.json()
            setFiles(data.files || [])
        } catch (err: any) {
            setError(err.message)
            setFiles([])
        } finally {
            setLoading(false)
        }
    }, [token])

    // Cargar archivos al abrir el diálogo
    useEffect(() => {
        if (open) {
            setSelectedFiles(new Set())
            setSearchQuery('')
            fetchFiles()
        }
    }, [open, fetchFiles])

    const handleSearch = useCallback(() => {
        fetchFiles(searchQuery || undefined)
    }, [searchQuery, fetchFiles])

    const toggleFile = useCallback((fileId: string, mimeType: string) => {
        // No permitir seleccionar carpetas ni tipos no soportados
        if (!ATTACHABLE_TYPES.has(mimeType)) return

        setSelectedFiles(prev => {
            const next = new Set(prev)
            if (next.has(fileId)) {
                next.delete(fileId)
            } else {
                if (next.size >= 5) return prev // máximo 5
                next.add(fileId)
            }
            return next
        })
    }, [])

    const handleAttach = useCallback(async () => {
        if (selectedFiles.size === 0) return

        setDownloading(true)
        setError(null)

        try {
            const results = await Promise.all(
                Array.from(selectedFiles).map(async (fileId) => {
                    const res = await fetch(
                        buildApiUrl(`/api/conectores/google-drive/files/${fileId}/content`),
                        { headers: { Authorization: `Bearer ${token}` } }
                    )
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}))
                        throw new Error(data.error || `Error descargando ${fileId}`)
                    }
                    return res.json()
                })
            )

            onFilesSelected(results.map(r => ({
                fileName: r.fileName,
                mimeType: r.mimeType,
                size: r.size,
                text: r.text,
                wordCount: r.wordCount,
                fromDrive: true,
                driveFileId: r.fileId,
            })))

            onOpenChange(false)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setDownloading(false)
        }
    }, [selectedFiles, token, onFilesSelected, onOpenChange])

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GoogleDriveIcon className="h-5 w-5" />
                        Google Drive
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona archivos de tu Drive para adjuntarlos al chat
                    </DialogDescription>
                </DialogHeader>

                {/* Barra de búsqueda */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Buscar en Drive..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-1"
                    />
                    <Button variant="outline" size="icon" onClick={handleSearch} disabled={loading}>
                        <Search className="h-4 w-4" />
                    </Button>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="truncate">{error}</span>
                    </div>
                )}

                {/* Lista de archivos */}
                <ScrollArea className="flex-1 min-h-0 max-h-[400px] pr-2">
                    {loading ? (
                        <div className="space-y-2 p-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full rounded-md" />
                            ))}
                        </div>
                    ) : files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <FolderOpen className="h-10 w-10 mb-2 opacity-40" />
                            <p className="text-sm">No se encontraron archivos</p>
                        </div>
                    ) : (
                        <div className="space-y-1 p-1">
                            {files.map((file) => {
                                const isAttachable = ATTACHABLE_TYPES.has(file.mimeType)
                                const isSelected = selectedFiles.has(file.id)
                                const IconComponent = MIME_TYPE_ICONS[file.mimeType] || File
                                const typeLabel = MIME_TYPE_LABELS[file.mimeType] || file.mimeType.split('/').pop()

                                return (
                                    <button
                                        key={file.id}
                                        type="button"
                                        disabled={!isAttachable}
                                        onClick={() => toggleFile(file.id, file.mimeType)}
                                        className={`
                                            w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors
                                            ${isSelected
                                                ? 'bg-primary/10 border border-primary/30'
                                                : isAttachable
                                                    ? 'hover:bg-muted/60 border border-transparent'
                                                    : 'opacity-40 cursor-not-allowed border border-transparent'
                                            }
                                        `}
                                    >
                                        <div className={`shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                            {isSelected ? (
                                                <Check className="h-5 w-5" />
                                            ) : (
                                                <IconComponent className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                                                    {typeLabel}
                                                </Badge>
                                                {file.modifiedTime && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {formatDate(file.modifiedTime)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>

                {/* Footer con selección y botón adjuntar */}
                <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                        {selectedFiles.size > 0
                            ? `${selectedFiles.size} archivo${selectedFiles.size > 1 ? 's' : ''} seleccionado${selectedFiles.size > 1 ? 's' : ''}`
                            : 'Selecciona archivos de texto, documentos u hojas'
                        }
                    </span>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            disabled={selectedFiles.size === 0 || downloading}
                            onClick={handleAttach}
                        >
                            {downloading ? 'Descargando...' : 'Adjuntar'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
