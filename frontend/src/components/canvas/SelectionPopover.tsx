"use client"

import { useRef, useState, useCallback, useEffect } from "react"
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
    const [isHighlighted, setIsHighlighted] = useState(false)

    // When the input receives focus, apply a highlight mark to the selected text
    // so it stays visually marked even when editor loses browser focus
    const applySelectionHighlight = useCallback(() => {
        if (!editor || isHighlighted) return
        const { from, to } = editor.state.selection
        if (from === to) return
        editor.chain().setMark("highlight", { color: "rgba(141, 198, 63, 0.35)" }).run()
        setIsHighlighted(true)
    }, [editor, isHighlighted])

    // Remove highlight when popover closes or submits
    const removeSelectionHighlight = useCallback(() => {
        if (!editor || !isHighlighted) return
        editor.chain().focus().unsetHighlight().run()
        setIsHighlighted(false)
    }, [editor, isHighlighted])

    // Cleanup highlight on unmount or when popover hides
    useEffect(() => {
        if (!position && isHighlighted && editor) {
            editor.chain().focus().unsetHighlight().run()
            setIsHighlighted(false)
        }
    }, [position, isHighlighted, editor])

    const handleSubmit = useCallback(() => {
        if (!instruction.trim() || isTransforming) return
        removeSelectionHighlight()
        onSubmit(instruction.trim())
        setInstruction("")
    }, [instruction, isTransforming, onSubmit, removeSelectionHighlight])

    const applyFormat = useCallback(
        (format: "bold" | "italic" | "underline" | "h1" | "h2" | "h3" | "h4", e: React.MouseEvent) => {
            // Prevent focus loss from the editor so the selection stays
            e.preventDefault()
            e.stopPropagation()
            if (!editor) return
            
            // For headings, we need to ensure the editor selection is restored first
            // then apply the heading toggle on the selected block(s)
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
    const preventFocusLoss = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
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
                    onMouseDown={(e) => applyFormat("bold", e)}
                    title="Negrita"
                >
                    <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={editor?.isActive("italic") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={(e) => applyFormat("italic", e)}
                    title="Cursiva"
                >
                    <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={editor?.isActive("underline") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={(e) => applyFormat("underline", e)}
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
                        onMouseDown={(e) => applyFormat(`h${level}` as "h1" | "h2" | "h3" | "h4", e)}
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
                    onFocus={applySelectionHighlight}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit()
                        }
                        if (e.key === "Escape") {
                            removeSelectionHighlight()
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
