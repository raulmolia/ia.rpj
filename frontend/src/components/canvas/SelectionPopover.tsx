"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SelectionPopoverProps {
    position: { top: number; left: number } | null
    selectedText: string
    onSubmit: (instruction: string) => void
    onClose: () => void
    isTransforming: boolean
}

export default function SelectionPopover({
    position,
    selectedText,
    onSubmit,
    onClose,
    isTransforming,
}: SelectionPopoverProps) {
    const t = useTranslations("canvas")
    const [instruction, setInstruction] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (position && inputRef.current) {
            inputRef.current.focus()
        }
    }, [position])

    useEffect(() => {
        if (!position) return
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [position, onClose])

    const handleSubmit = useCallback(() => {
        if (!instruction.trim() || isTransforming) return
        onSubmit(instruction.trim())
        setInstruction("")
    }, [instruction, isTransforming, onSubmit])

    if (!position || !selectedText) return null

    return (
        <div
            ref={popoverRef}
            className="fixed z-[100] w-80 rounded-lg border bg-popover p-3 shadow-lg"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            <p className="mb-2 text-xs text-muted-foreground">
                {t("selectionInstruction")}
            </p>
            <div className="flex gap-2">
                <Input
                    ref={inputRef}
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit()
                        }
                        if (e.key === "Escape") {
                            onClose()
                        }
                    }}
                    placeholder={t("selectionPlaceholder")}
                    className="h-8 text-sm"
                    disabled={isTransforming}
                />
                <Button
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleSubmit}
                    disabled={!instruction.trim() || isTransforming}
                >
                    <Send className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}
