"use client"

import { useRef, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Send, Bold, Italic, Underline } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Editor } from "@tiptap/react"

interface SelectionPopoverProps {
    position: { top: number; left: number } | null
    selectedText: string
    onSubmit: (instruction: string) => void
    onClose: () => void
    isTransforming: boolean
    editor: Editor | null
}

export default function SelectionPopover({
    position,
    selectedText,
    onSubmit,
    onClose,
    isTransforming,
    editor,
}: SelectionPopoverProps) {
    const t = useTranslations("canvas")
    const [instruction, setInstruction] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    // NOTE: We intentionally do NOT auto-focus the input on open.
    // Keeping focus on the editor preserves the visible text selection (green highlight)
    // so the user can immediately click formatting buttons on the selected text.

    const handleSubmit = useCallback(() => {
        if (!instruction.trim() || isTransforming) return
        onSubmit(instruction.trim())
        setInstruction("")
    }, [instruction, isTransforming, onSubmit])

    const applyFormat = useCallback(
        (format: "bold" | "italic" | "underline" | "h1" | "h2" | "h3" | "h4") => {
            if (!editor) return
            switch (format) {
                case "bold":
                    editor.chain().focus().toggleBold().run()
                    break
                case "italic":
                    editor.chain().focus().toggleItalic().run()
                    break
                case "underline":
                    editor.chain().focus().toggleUnderline().run()
                    break
                case "h1":
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                    break
                case "h2":
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                    break
                case "h3":
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                    break
                case "h4":
                    editor.chain().focus().toggleHeading({ level: 4 }).run()
                    break
            }
        },
        [editor],
    )

    // Prevents the button mousedown from stealing focus away from the TipTap editor.
    // e.preventDefault() keeps focus on the editor so the selection is preserved.
    const preventFocusLoss = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
    }, [])

    if (!position || !selectedText) return null

    return (
        <div
            ref={popoverRef}
            className="fixed z-[100] rounded-lg border bg-popover p-3 shadow-lg"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            {/* Formatting buttons — shown first so the user can act on the visible selection */}
            <div className="mb-2 flex items-center gap-1">
                <Button
                    variant={editor?.isActive("bold") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={preventFocusLoss}
                    onClick={() => applyFormat("bold")}
                    title="Negrita"
                >
                    <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={editor?.isActive("italic") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={preventFocusLoss}
                    onClick={() => applyFormat("italic")}
                    title="Cursiva"
                >
                    <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={editor?.isActive("underline") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={preventFocusLoss}
                    onClick={() => applyFormat("underline")}
                    title="Subrayado"
                >
                    <Underline className="h-3.5 w-3.5" />
                </Button>

                <div className="mx-1 h-5 w-px bg-border" />

                {([1, 2, 3, 4] as const).map((level) => (
                    <Button
                        key={level}
                        variant={editor?.isActive("heading", { level }) ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-1.5 text-xs font-bold"
                        onMouseDown={preventFocusLoss}
                        onClick={() => applyFormat(`h${level}` as "h1" | "h2" | "h3" | "h4")}
                        title={`Encabezado ${level}`}
                    >
                        H{level}
                    </Button>
                ))}
            </div>

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
