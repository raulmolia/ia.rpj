"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Send, Bold, Italic, Underline, List, ListOrdered, X } from "lucide-react"
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

const PRESET_COLORS = [
    { label: "Negro", value: "#000000" },
    { label: "Gris", value: "#6b7280" },
    { label: "Rojo", value: "#dc2626" },
    { label: "Naranja", value: "#ea580c" },
    { label: "Amarillo", value: "#ca8a04" },
    { label: "Verde", value: "#16a34a" },
    { label: "Azul", value: "#2563eb" },
    { label: "Morado", value: "#9333ea" },
    { label: "Rosa", value: "#db2777" },
]

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
        (format: "bold" | "italic" | "underline" | "h1" | "h2" | "h3" | "h4" | "bulletList" | "orderedList", e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
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
                case "bulletList":
                    editor.chain().focus().toggleBulletList().run()
                    break
                case "orderedList":
                    editor.chain().focus().toggleOrderedList().run()
                    break
            }
        },
        [editor],
    )

    const applyColor = useCallback(
        (color: string, e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            if (!editor) return
            editor.chain().focus().setColor(color).run()
        },
        [editor],
    )

    const removeColor = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            if (!editor) return
            editor.chain().focus().unsetColor().run()
        },
        [editor],
    )

    // Prevents the button mousedown from stealing focus away from the TipTap editor.
    const preventFocusLoss = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    const handlePresetClick = useCallback((preset: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setInstruction(preset)
        setTimeout(() => inputRef.current?.focus(), 0)
    }, [])

    if (!position || !selectedText) return null

    const quickPresets = [
        t("quickPresets.formal"),
        t("quickPresets.concise"),
        t("quickPresets.expand"),
        t("quickPresets.improve"),
    ]

    // Detect currently active color (if any) to show it selected
    const activeColor = editor?.getAttributes("textStyle")?.color as string | undefined

    return (
        <div
            ref={popoverRef}
            className="fixed z-[100] overflow-hidden rounded-xl border bg-popover shadow-2xl"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                minWidth: "500px",
                maxWidth: "calc(100vw - 32px)",
            }}
        >
            {/* Formatting section — subtle header with muted background */}
            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-3 py-2">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("formatLabel")}
                </span>

                {/* Inline format buttons */}
                <Button
                    variant={editor?.isActive("bold") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={(e) => applyFormat("bold", e)}
                    title="Negrita (Ctrl+B)"
                >
                    <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={editor?.isActive("italic") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={(e) => applyFormat("italic", e)}
                    title="Cursiva (Ctrl+I)"
                >
                    <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={editor?.isActive("underline") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={(e) => applyFormat("underline", e)}
                    title="Subrayado (Ctrl+U)"
                >
                    <Underline className="h-3.5 w-3.5" />
                </Button>

                <div className="mx-1.5 h-4 w-px bg-border" />

                {/* Heading buttons */}
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

                <div className="mx-1.5 h-4 w-px bg-border" />

                {/* List buttons */}
                <Button
                    variant={editor?.isActive("bulletList") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={(e) => applyFormat("bulletList", e)}
                    title={t("listBullet")}
                >
                    <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                    variant={editor?.isActive("orderedList") ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onMouseDown={(e) => applyFormat("orderedList", e)}
                    title={t("listOrdered")}
                >
                    <ListOrdered className="h-3.5 w-3.5" />
                </Button>

                <div className="mx-1.5 h-4 w-px bg-border" />

                {/* Color swatches */}
                <div className="flex items-center gap-0.5" onMouseDown={preventFocusLoss}>
                    {PRESET_COLORS.map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            title={c.label}
                            className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
                            style={{
                                backgroundColor: c.value,
                                borderColor: activeColor === c.value ? "hsl(var(--primary))" : "transparent",
                                boxShadow: activeColor === c.value ? "0 0 0 1px hsl(var(--primary))" : undefined,
                            }}
                            onMouseDown={(e) => applyColor(c.value, e)}
                        />
                    ))}
                    {/* Remove color */}
                    <button
                        type="button"
                        title={t("removeColor")}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-accent"
                        onMouseDown={removeColor}
                    >
                        <X className="h-2.5 w-2.5" />
                    </button>
                </div>
            </div>

            {/* AI transformation section */}
            <div className="p-3">
                {/* Label */}
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {t("selectionInstruction")}
                </p>

                {/* Quick preset chips */}
                <div className="mb-2.5 flex flex-wrap gap-1.5" onMouseDown={preventFocusLoss}>
                    {quickPresets.map((preset) => (
                        <button
                            key={preset}
                            className="rounded-full border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                            onMouseDown={(e) => handlePresetClick(preset, e)}
                            disabled={isTransforming}
                            type="button"
                        >
                            {preset}
                        </button>
                    ))}
                </div>

                {/* Instruction input + send */}
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
                        className="h-9 text-sm"
                        disabled={isTransforming}
                    />
                    <Button
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={handleSubmit}
                        disabled={!instruction.trim() || isTransforming}
                    >
                        <Send className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
