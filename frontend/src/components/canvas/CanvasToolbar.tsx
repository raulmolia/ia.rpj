"use client"

import { useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight, Eye, EyeOff, Download, Copy, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface CanvasToolbarProps {
    currentVersion: number
    totalVersions: number
    showDiff: boolean
    onPrevVersion: () => void
    onNextVersion: () => void
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
    showDiff,
    onPrevVersion,
    onNextVersion,
    onToggleDiff,
    onExportPdf,
    onExportWord,
    onCopy,
    onClose,
    isCopied,
}: CanvasToolbarProps) {
    const t = useTranslations("canvas")

    return (
        <div className="flex items-center justify-between border-b bg-background px-3 py-2">
            {/* Left: version nav */}
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs font-normal">
                    {t("versionLabel", { current: currentVersion, total: totalVersions })}
                </Badge>
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
