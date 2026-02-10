"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import { useTranslations } from "next-intl"
import SelectionPopover from "./SelectionPopover"
import CanvasToolbar from "./CanvasToolbar"
import { downloadAsPDF, downloadAsWord } from "@/lib/document-generator"

/**
 * Convert markdown-like text to HTML for TipTap editor.
 * Pure function at module level so it can be used in useEditor initialization.
 */
function convertMarkdownToHtml(text: string): string {
    if (!text) return "<p></p>"
    if (text.startsWith("<")) return text // Already HTML
    return text
        .split("\n\n")
        .map((block) => {
            const trimmed = block.trim()
            if (!trimmed) return ""
            if (trimmed.startsWith("### ")) return `<h3>${trimmed.slice(4)}</h3>`
            if (trimmed.startsWith("## ")) return `<h2>${trimmed.slice(3)}</h2>`
            if (trimmed.startsWith("# ")) return `<h1>${trimmed.slice(2)}</h1>`
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                const items = trimmed
                    .split("\n")
                    .filter((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "))
                    .map((l) => `<li>${l.replace(/^[\s]*[-*]\s/, "")}</li>`)
                    .join("")
                return `<ul>${items}</ul>`
            }
            if (/^\d+\.\s/.test(trimmed)) {
                const items = trimmed
                    .split("\n")
                    .filter((l) => /^\s*\d+\.\s/.test(l))
                    .map((l) => `<li>${l.replace(/^\s*\d+\.\s/, "")}</li>`)
                    .join("")
                return `<ol>${items}</ol>`
            }
            let html = trimmed
                .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.+?)\*/g, "<em>$1</em>")
            return `<p>${html}</p>`
        })
        .filter(Boolean)
        .join("")
}

export interface CanvasVersion {
    content: string
    timestamp: number
    label?: string
}

interface CanvasEditorProps {
    initialContent: string
    onContentChange?: (content: string) => void
    onTransformRequest: (content: string, selection: string | null, instruction: string) => Promise<string>
    isTransforming: boolean
    onClose?: () => void
}

export default function CanvasEditor({
    initialContent,
    onContentChange,
    onTransformRequest,
    isTransforming,
    onClose,
}: CanvasEditorProps) {
    const t = useTranslations("canvas")
    const [versions, setVersions] = useState<CanvasVersion[]>([
        { content: initialContent, timestamp: Date.now(), label: t("originalVersion") },
    ])
    const [currentVersionIndex, setCurrentVersionIndex] = useState(0)
    const [showDiff, setShowDiff] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null)
    const [selectedText, setSelectedText] = useState("")
    const editorContainerRef = useRef<HTMLDivElement>(null)

    // Refs to track external content updates and prevent feedback loops
    const lastExternalContentRef = useRef(initialContent)
    const isExternalUpdateRef = useRef(false)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder: t("editPlaceholder"),
            }),
            Highlight.configure({
                multicolor: true,
            }),
        ],
        content: convertMarkdownToHtml(initialContent), // FIX Bug 1: convert markdown to HTML
        editorProps: {
            attributes: {
                class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-6 py-4",
            },
        },
        onUpdate: ({ editor }) => {
            // FIX Bug 3: don't report back when content was set externally (prevents loop)
            if (isExternalUpdateRef.current) {
                isExternalUpdateRef.current = false
                return
            }
            onContentChange?.(editor.getText())
        },
    })

    // FIX Bug 3: Sync editor when initialContent prop changes (from transform API result)
    useEffect(() => {
        if (!editor) return
        if (initialContent === lastExternalContentRef.current) return
        lastExternalContentRef.current = initialContent

        // Set content in editor, suppressing the onUpdate callback
        isExternalUpdateRef.current = true
        editor.commands.setContent(convertMarkdownToHtml(initialContent))

        // Add as new version
        const newVersion: CanvasVersion = { content: initialContent, timestamp: Date.now() }
        setVersions((prev) => {
            const next = [...prev, newVersion]
            setCurrentVersionIndex(next.length - 1)
            return next
        })
    }, [initialContent, editor])

    // Sync editor content when navigating between versions
    useEffect(() => {
        if (!editor) return
        const versionContent = versions[currentVersionIndex]?.content ?? ""
        const currentEditorContent = editor.getText()
        if (currentEditorContent !== versionContent) {
            isExternalUpdateRef.current = true
            editor.commands.setContent(convertMarkdownToHtml(versionContent))
        }
    }, [currentVersionIndex, versions, editor])

    // FIX Bug 2: Use mouseup on container for reliable selection detection
    useEffect(() => {
        const container = editorContainerRef.current
        if (!container) return

        const handleMouseUp = () => {
            // Small delay for selection to finalize in the browser
            setTimeout(() => {
                const sel = window.getSelection()
                if (!sel || sel.isCollapsed || !sel.toString().trim()) return

                const text = sel.toString().trim()
                if (text.length < 3) return

                const range = sel.getRangeAt(0)
                if (!container.contains(range.commonAncestorContainer)) return

                const rect = range.getBoundingClientRect()
                setSelectedText(text)
                setPopoverPosition({
                    top: rect.bottom + 8,
                    left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)),
                })
            }, 10)
        }

        // Dismiss popover when clicking outside (but not on the popover itself)
        const handleMouseDown = (e: MouseEvent) => {
            const popover = document.querySelector("[data-canvas-popover]")
            if (popover && popover.contains(e.target as Node)) return
            setPopoverPosition(null)
            setSelectedText("")
        }

        container.addEventListener("mouseup", handleMouseUp)
        document.addEventListener("mousedown", handleMouseDown)
        return () => {
            container.removeEventListener("mouseup", handleMouseUp)
            document.removeEventListener("mousedown", handleMouseDown)
        }
    }, [])

    const addVersion = useCallback(
        (content: string) => {
            const newVersion: CanvasVersion = {
                content,
                timestamp: Date.now(),
            }
            setVersions((prev) => {
                const next = [...prev.slice(0, currentVersionIndex + 1), newVersion]
                setCurrentVersionIndex(next.length - 1)
                return next
            })
        },
        [currentVersionIndex],
    )

    const handleSelectionTransform = useCallback(
        async (instruction: string) => {
            if (!editor) return
            const fullContent = editor.getText()
            try {
                const result = await onTransformRequest(fullContent, selectedText, instruction)
                isExternalUpdateRef.current = true
                editor.commands.setContent(convertMarkdownToHtml(result))
                addVersion(result)
                setPopoverPosition(null)
                setSelectedText("")
            } catch {
                // Error handled by parent
            }
        },
        [editor, selectedText, onTransformRequest, addVersion],
    )

    const handleCopy = useCallback(async () => {
        if (!editor) return
        try {
            await navigator.clipboard.writeText(editor.getText())
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch {
            const textArea = document.createElement("textarea")
            textArea.value = editor.getText()
            document.body.appendChild(textArea)
            textArea.select()
            document.execCommand("copy")
            document.body.removeChild(textArea)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        }
    }, [editor])

    const handleExportPdf = useCallback(() => {
        if (!editor) return
        downloadAsPDF(editor.getText(), `lienzo-${Date.now()}.pdf`)
    }, [editor])

    const handleExportWord = useCallback(() => {
        if (!editor) return
        downloadAsWord(editor.getText(), `lienzo-${Date.now()}.docx`)
    }, [editor])

    // Diff view rendering (dynamic import to avoid SSR regex crash)
    const [diffHtml, setDiffHtml] = useState<string | null>(null)
    useEffect(() => {
        if (!showDiff || versions.length < 2 || currentVersionIndex === 0) {
            setDiffHtml(null)
            return
        }
        const prev = versions[currentVersionIndex - 1].content
        const curr = versions[currentVersionIndex].content
        import("diff").then(({ diffWords }) => {
            const changes = diffWords(prev, curr)
            const html = changes
                .map((part) => {
                    if (part.added) {
                        return `<span class="bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-200">${part.value}</span>`
                    }
                    if (part.removed) {
                        return `<span class="bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-200 line-through">${part.value}</span>`
                    }
                    return part.value
                })
                .join("")
            setDiffHtml(html)
        })
    }, [showDiff, versions, currentVersionIndex])

    return (
        <div className="flex h-full flex-col">
            <CanvasToolbar
                currentVersion={currentVersionIndex + 1}
                totalVersions={versions.length}
                showDiff={showDiff}
                onPrevVersion={() => setCurrentVersionIndex((i) => Math.max(0, i - 1))}
                onNextVersion={() => setCurrentVersionIndex((i) => Math.min(versions.length - 1, i + 1))}
                onToggleDiff={() => setShowDiff((s) => !s)}
                onExportPdf={handleExportPdf}
                onExportWord={handleExportWord}
                onCopy={handleCopy}
                onClose={() => onClose?.()}
                isCopied={isCopied}
            />

            <div
                ref={editorContainerRef}
                className="flex-1 overflow-y-auto"
                data-canvas-editor
            >
                {showDiff && diffHtml ? (
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none px-6 py-4 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: diffHtml }}
                    />
                ) : (
                    <EditorContent editor={editor} />
                )}
            </div>

            <div data-canvas-popover>
                <SelectionPopover
                    position={popoverPosition}
                    selectedText={selectedText}
                    onSubmit={handleSelectionTransform}
                    onClose={() => {
                        setPopoverPosition(null)
                        setSelectedText("")
                    }}
                    isTransforming={isTransforming}
                />
            </div>
        </div>
    )
}
