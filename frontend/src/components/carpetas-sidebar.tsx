"use client"

import { useState, useCallback } from "react"
import {
    FolderOpen, FolderClosed, ChevronRight, ChevronDown, MoreHorizontal,
    Plus, PenLine, Share2, Trash2, MessageSquare, Bell, BellOff,
    FolderHeart, FolderKanban, FolderGit2, FolderKey, FolderSearch,
    FolderSync, FolderCheck, FolderClock, FolderDot, FolderInput,
    Bookmark, Heart, Star, Flame, Sparkles, Cross, Church,
    Users, Music, BookOpen, Calendar, Target, Lightbulb
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Carpeta, CarpetaConversacion } from "@/hooks/use-carpetas"

// ── Mapa de iconos disponibles ──
export const FOLDER_ICONS: Record<string, LucideIcon> = {
    FolderOpen, FolderClosed, FolderHeart, FolderKanban, FolderGit2,
    FolderKey, FolderSearch, FolderSync, FolderCheck, FolderClock,
    FolderDot, FolderInput, Bookmark, Heart, Star, Flame, Sparkles,
    Cross, Church, Users, Music, BookOpen, Calendar, Target, Lightbulb,
}

// ── Colores disponibles ──
export const FOLDER_COLORS = [
    "#000000", // black
    "#f59e0b", // amber
    "#ef4444", // red
    "#3b82f6", // blue
    "#10b981", // emerald
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#f97316", // orange
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#6366f1", // indigo
]

function getIconComponent(iconName: string): LucideIcon {
    return FOLDER_ICONS[iconName] || FolderOpen
}

// ── Props ──
type CarpetasSidebarProps = {
    carpetas: Carpeta[]
    activeChatConversationId: string | null
    onSelectChat: (conversationId: string) => void
    onCreateFolder: () => void
    onEditFolder: (carpeta: Carpeta) => void
    onShareFolder: (carpeta: Carpeta) => void
    onDeleteFolder: (carpetaId: string) => void
    onRemoveConversation: (carpetaId: string, convId: string) => void
    onMarkNotificationsRead: (carpetaId: string) => void
    userId: string
}

export function CarpetasSidebar({
    carpetas,
    activeChatConversationId,
    onSelectChat,
    onCreateFolder,
    onEditFolder,
    onShareFolder,
    onDeleteFolder,
    onRemoveConversation,
    onMarkNotificationsRead,
    userId,
}: CarpetasSidebarProps) {
    const t = useTranslations()
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(false)

    const toggleFolder = useCallback((id: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    if (carpetas.length === 0 && !isFoldersCollapsed) {
        return (
            <div className="space-y-1 px-2">
                {/* Título Carpetas */}
                <div className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[11px] font-medium text-foreground">
                    <div className="flex items-center gap-3">
                        <FolderOpen className="h-4 w-4" aria-hidden="true" />
                        <span>{t("folders.title")}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-muted"
                        onClick={onCreateFolder}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                </div>
                <div className="rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-4 text-center text-[10px] text-muted-foreground">
                    {t("folders.empty")}
                </div>
                <div className="py-2">
                    <div className="border-t border-border/40" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-1 px-2">
            {/* Título Carpetas de trabajo */}
            <button
                onClick={() => setIsFoldersCollapsed(!isFoldersCollapsed)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
                <div className="flex items-center gap-3">
                    <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    <span>{t("folders.title")}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        role="button"
                        tabIndex={0}
                        className="rounded p-0.5 hover:bg-muted-foreground/20"
                        onClick={(e) => { e.stopPropagation(); onCreateFolder() }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onCreateFolder() } }}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </span>
                    {isFoldersCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </div>
            </button>

            {/* Lista de carpetas */}
            {!isFoldersCollapsed && (
                <div className="space-y-0.5">
                    {carpetas.map((carpeta) => {
                        const Icon = getIconComponent(carpeta.icono)
                        const isExpanded = expandedFolders.has(carpeta.id)
                        const notifCount = carpeta._count?.notificaciones ?? 0
                        const isOwner = carpeta.usuarioId === userId
                        const convs = carpeta.conversaciones ?? []

                        return (
                            <div key={carpeta.id}>
                                {/* Fila de carpeta */}
                                <div
                                    className="group relative flex cursor-pointer items-center justify-between gap-1 rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/50"
                                    onClick={() => toggleFolder(carpeta.id)}
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        {isExpanded ? (
                                            <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                        )}
                                        <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: carpeta.color }} />
                                        <span className="truncate text-[11px] leading-tight" style={{ color: carpeta.color }}>
                                            {carpeta.nombre}
                                        </span>
                                        {carpeta.esCompartida && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Share2 className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="text-xs">
                                                    {t("folders.sharedBy", { name: carpeta.usuario?.nombre || carpeta.usuario?.email || "" })}
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {notifCount > 0 && (
                                            <Badge
                                                variant="destructive"
                                                className="h-4 min-w-[16px] px-1 text-[9px] font-normal"
                                            >
                                                {notifCount}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Menú contextual */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 flex-shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-muted"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreHorizontal className="h-3 w-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onSelect={() => onEditFolder(carpeta)}>
                                                <PenLine className="mr-2 h-4 w-4" /> {t("folders.edit")}
                                            </DropdownMenuItem>
                                            {isOwner && (
                                                <DropdownMenuItem onSelect={() => onShareFolder(carpeta)}>
                                                    <Share2 className="mr-2 h-4 w-4" /> {t("folders.share")}
                                                </DropdownMenuItem>
                                            )}
                                            {notifCount > 0 && (
                                                <DropdownMenuItem onSelect={() => onMarkNotificationsRead(carpeta.id)}>
                                                    <BellOff className="mr-2 h-4 w-4" /> {t("folders.markRead")}
                                                </DropdownMenuItem>
                                            )}
                                            {isOwner && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onSelect={() => onDeleteFolder(carpeta.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> {t("folders.delete")}
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Conversaciones dentro de la carpeta (expandido) */}
                                {isExpanded && (
                                    <div className="ml-5 space-y-0.5 py-0.5">
                                        {convs.length === 0 ? (
                                            <div className="px-3 py-1.5 text-[10px] text-muted-foreground italic">
                                                {t("folders.noChats")}
                                            </div>
                                        ) : (
                                            convs.map((conv) => (
                                                <div
                                                    key={conv.id}
                                                    className={cn(
                                                        "group/conv relative flex cursor-pointer items-center justify-between gap-1 rounded-md px-2 py-1 transition-colors",
                                                        activeChatConversationId === conv.id
                                                            ? "bg-primary/10"
                                                            : "hover:bg-muted/40"
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onSelectChat(conv.id)
                                                    }}
                                                >
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        <MessageSquare className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                                                        <span className="truncate text-[10px] leading-tight">
                                                            {conv.titulo || "Chat"}
                                                        </span>
                                                    </div>
                                                    {(isOwner || carpeta.permisos === "escritura") && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-4 w-4 flex-shrink-0 opacity-0 group-hover/conv:opacity-100 hover:bg-muted"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                onRemoveConversation(carpeta.id, conv.id)
                                                            }}
                                                            title={t("folders.removeChat")}
                                                        >
                                                            <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Separador inferior */}
            <div className="py-2">
                <div className="border-t border-border/40" />
            </div>
        </div>
    )
}
