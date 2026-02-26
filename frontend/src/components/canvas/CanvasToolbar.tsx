"use client"

import { useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight, Eye, EyeOff, Download, Copy, Check, X, History, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { CanvasVersion } from "./CanvasEditor"

function formatVersionTime(timestamp: number, t: ReturnType<typeof useTranslations>): string {
    const diff = Date.now() - timestamp
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t("justNow")
    if (mins < 60) return t("minsAgo", { n: mins })
    return t("hoursAgo", { n: Math.floor(mins / 60) })
}

interface CanvasToolbarProps {
    currentVersion: number
    totalVersions: number
    versions: CanvasVersion[]
    showDiff: boolean
    onPrevVersion: () => void
    onNextVersion: () => void
    onJumpToVersion: (index: number) => void
    onRestoreVersion: () => void
    onToggleDiff: () => void
    onExportPdf: () => void
    onExportWord: () => void
    onCopy: () => void
    onClose: () => void
    isCopied: boolean
}

export default function CanvasToolbar({
    currentVersion,
    totalVersions,
    versions,
    showDiff,
    onPrevVersion,
    onNextVersion,
    onJumpToVersion,
    onRestoreVersion,
    onToggleDiff,
    onExportPdf,
    onExportWord,
    onCopy,
    onClose,
    isCopied,
}: CanvasToolbarProps) {
    const t = useTranslations("canvas")
    const isLatestVersion = currentVersion >= totalVersions

    return (
        <div className="flex items-center justify-between border-b bg-background px-3 py-2">
            {/* Left: version nav */}
            <div className="flex items-center gap-1.5">

                {/* Version history dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal pr-2">
                            <History className="h-3.5 w-3.5 shrink-0" />
                            <span>{t("versionLabel", { current: currentVersion, total: totalVersions })}</span>
                            {!isLatestVersion && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] leading-none">
                                    {t("currentVersionBadge")}
                                </Badge>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {t("versionHistory")}
                        </div>
                        <DropdownMenuSeparator />
                        {[...versions].reverse().map((v, revIdx) => {
                            const originalIdx = versions.length - 1 - revIdx
                            const isCurrent = originalIdx === currentVersion - 1
                            const versionNum = originalIdx + 1
                            const label = v.label ?? t("versionN", { n: versionNum })
                            return (
                                <DropdownMenuItem
                                    key={originalIdx}
                                    onClick={() => onJumpToVersion(originalIdx)}
                                    className="flex items-start gap-2 py-2"
                                >
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold leading-none">
                                        {versionNum}
                                    </div>
                                    <div className="flex flex-1 flex-col min-w-0">
                                        <span className="truncate text-xs font-medium leading-tight">{label}</span>
                                        <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                            {formatVersionTime(v.timestamp, t)}
                                        </span>
                                    </div>
                                    {isCurrent && (
                                        <Check className="h-3.5 w-3.5 shrink-0 text-primary self-center" />
                                    )}
                                </DropdownMenuItem>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Prev / Next chevrons */}
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onPrevVersion}
                        disabled={currentVersion <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={onNextVersion}
                        disabled={currentVersion >= totalVersions}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* "Usar esta versión" — visible only when NOT on the latest version */}
                {!isLatestVersion && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={onRestoreVersion}
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    {t("useThisVersion")}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-48 text-center">
                                <p>{t("useThisVersionTooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Diff toggle */}
                {totalVersions > 1 && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={showDiff ? "secondary" : "ghost"}
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={onToggleDiff}
                                >
                                    {showDiff ? (
                                        <EyeOff className="h-3.5 w-3.5" />
                                    ) : (
                                        <Eye className="h-3.5 w-3.5" />
                                    )}
                                    {showDiff ? t("hideChanges") : t("showChanges")}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{showDiff ? t("hideChanges") : t("showChanges")}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                            <Download className="h-3.5 w-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onExportPdf}>
                            {t("exportPdf")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onExportWord}>
                            {t("exportWord")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={onCopy}
                            >
                                {isCopied ? (
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isCopied ? t("copied") : t("copy")}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
