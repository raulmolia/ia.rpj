"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { FOLDER_ICONS, FOLDER_COLORS } from "./carpetas-sidebar"
import type { Carpeta } from "@/hooks/use-carpetas"

type CarpetaDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    carpeta: Carpeta | null // null = crear, Carpeta = editar
    onSave: (nombre: string, icono: string, color: string) => Promise<void>
    saving?: boolean
}

export function CarpetaDialog({ open, onOpenChange, carpeta, onSave, saving }: CarpetaDialogProps) {
    const t = useTranslations()
    const [nombre, setNombre] = useState("")
    const [icono, setIcono] = useState("FolderOpen")
    const [color, setColor] = useState("#f59e0b")

    useEffect(() => {
        if (open) {
            if (carpeta) {
                setNombre(carpeta.nombre)
                setIcono(carpeta.icono)
                setColor(carpeta.color)
            } else {
                setNombre("")
                setIcono("FolderOpen")
                setColor("#f59e0b")
            }
        }
    }, [open, carpeta])

    const handleSave = async () => {
        if (!nombre.trim()) return
        await onSave(nombre.trim(), icono, color)
    }

    const isEditing = !!carpeta

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? t("folders.editFolder") : t("folders.createFolder")}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing ? t("folders.editDescription") : t("folders.createDescription")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Nombre */}
                    <div className="space-y-2">
                        <Label htmlFor="folder-name">{t("folders.name")}</Label>
                        <Input
                            id="folder-name"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder={t("folders.namePlaceholder")}
                            maxLength={100}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && nombre.trim()) {
                                    e.preventDefault()
                                    void handleSave()
                                }
                            }}
                        />
                    </div>

                    {/* Selector de icono */}
                    <div className="space-y-2">
                        <Label>{t("folders.icon")}</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(FOLDER_ICONS).map(([key, Icon]) => (
                                <button
                                    key={key}
                                    type="button"
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-lg border transition-all hover:scale-110",
                                        icono === key
                                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                                            : "border-border/60 hover:border-border"
                                    )}
                                    onClick={() => setIcono(key)}
                                    title={key}
                                >
                                    <Icon className="h-4 w-4" style={{ color: color }} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Selector de color */}
                    <div className="space-y-2">
                        <Label>{t("folders.color")}</Label>
                        <div className="flex flex-wrap gap-2">
                            {FOLDER_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className={cn(
                                        "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
                                        color === c
                                            ? "border-foreground ring-2 ring-foreground/20"
                                            : "border-transparent"
                                    )}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setColor(c)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                        {(() => {
                            const PreviewIcon = FOLDER_ICONS[icono] || FOLDER_ICONS.FolderOpen
                            return <PreviewIcon className="h-5 w-5" style={{ color }} />
                        })()}
                        <span className="text-sm font-medium" style={{ color }}>
                            {nombre || t("folders.namePlaceholder")}
                        </span>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        {t("common.cancel")}
                    </Button>
                    <Button onClick={handleSave} disabled={!nombre.trim() || saving}>
                        {saving ? t("common.loading") : (isEditing ? t("common.save") : t("folders.create"))}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
