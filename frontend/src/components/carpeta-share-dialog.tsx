"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import { Search, X, Users, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { Carpeta, UsuarioPro } from "@/hooks/use-carpetas"

type CarpetaShareDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    carpeta: Carpeta | null
    onShare: (email: string, permisos: "lectura" | "escritura") => Promise<boolean>
    onUnshare: (userId: string) => Promise<boolean>
    onSearchUsers: (query: string) => Promise<UsuarioPro[]>
}

export function CarpetaShareDialog({
    open,
    onOpenChange,
    carpeta,
    onShare,
    onUnshare,
    onSearchUsers,
}: CarpetaShareDialogProps) {
    const t = useTranslations()
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<UsuarioPro[]>([])
    const [searching, setSearching] = useState(false)
    const [permisos, setPermisos] = useState<"lectura" | "escritura">("lectura")
    const [sharing, setSharing] = useState(false)
    const [feedback, setFeedback] = useState<string | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Reset on open
    useEffect(() => {
        if (open) {
            setSearchQuery("")
            setSearchResults([])
            setFeedback(null)
            setPermisos("lectura")
        }
    }, [open])

    // Debounced search
    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query)
        setFeedback(null)

        if (debounceRef.current) clearTimeout(debounceRef.current)

        if (query.trim().length < 2) {
            setSearchResults([])
            return
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true)
            const results = await onSearchUsers(query)
            setSearchResults(results)
            setSearching(false)
        }, 300)
    }, [onSearchUsers])

    const handleShareUser = async (email: string) => {
        setSharing(true)
        setFeedback(null)
        const success = await onShare(email, permisos)
        if (success) {
            setFeedback(t("folders.shareSuccess"))
            setSearchQuery("")
            setSearchResults([])
        } else {
            setFeedback(t("folders.shareError"))
        }
        setSharing(false)
    }

    const handleUnshareUser = async (userId: string) => {
        await onUnshare(userId)
    }

    if (!carpeta) return null

    const compartidas = carpeta.compartidas ?? []

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {t("folders.shareTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("folders.shareDescription", { name: carpeta.nombre })}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Buscar usuario */}
                    <div className="space-y-2">
                        <Label>{t("folders.searchUser")}</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    placeholder={t("folders.searchUserPlaceholder")}
                                    className="pl-9"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                                        onClick={() => { setSearchQuery(""); setSearchResults([]) }}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <Select value={permisos} onValueChange={(v) => setPermisos(v as "lectura" | "escritura")}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="lectura">{t("folders.readOnly")}</SelectItem>
                                    <SelectItem value="escritura">{t("folders.readWrite")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Resultados de búsqueda */}
                        {searchResults.length > 0 && (
                            <div className="max-h-40 overflow-auto rounded-lg border border-border/60 bg-background">
                                {searchResults.map((user) => {
                                    const alreadyShared = compartidas.some(c => c.usuarioId === user.id)
                                    return (
                                        <button
                                            key={user.id}
                                            type="button"
                                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                                            onClick={() => !alreadyShared && handleShareUser(user.email)}
                                            disabled={alreadyShared || sharing}
                                        >
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate font-medium text-xs">{user.nombre || user.email}</span>
                                                <span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
                                            </div>
                                            {alreadyShared ? (
                                                <Badge variant="secondary" className="text-[9px]">{t("folders.alreadyShared")}</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[9px] cursor-pointer">{t("folders.addUser")}</Badge>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {searching && (
                            <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
                        )}

                        {feedback && (
                            <p className="text-xs text-primary">{feedback}</p>
                        )}
                    </div>

                    {/* Usuarios compartidos */}
                    {compartidas.length > 0 && (
                        <div className="space-y-2">
                            <Label>{t("folders.sharedWith")}</Label>
                            <div className="space-y-1">
                                {compartidas.map((share) => (
                                    <div
                                        key={share.id}
                                        className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate text-xs font-medium">{share.usuario.nombre || share.usuario.email}</span>
                                            <span className="truncate text-[10px] text-muted-foreground">{share.usuario.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[9px]">
                                                {share.permisos === "escritura" ? t("folders.readWrite") : t("folders.readOnly")}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                onClick={() => handleUnshareUser(share.usuarioId)}
                                                title={t("folders.removeUser")}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t("common.close")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
