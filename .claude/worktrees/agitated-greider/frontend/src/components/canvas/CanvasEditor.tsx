"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import Underline from "@tiptap/extension-underline"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import { useTranslations } from "next-intl"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import SelectionPopover from "./SelectionPopover"
import CanvasToolbar from "./CanvasToolbar"
import { downloadAsPDF, downloadAsWord } from "@/lib/document-generator"


/**
 * Convert markdown text to HTML for TipTap editor.
 * Handles headings (h1-h4), lists, bold, italic, underline, and line breaks.
 */
function convertMarkdownToHtml(text: string): string {
    if (!text) return "<p></p>"
    if (text.startsWith("<")) return text // Already HTML

    // Process line by line to preserve structure
    const lines = text.split("\n")
    let html = ""
    let inUl = false
    let inOl = false

    const closeList = () => {
        if (inUl) { html += "</ul>"; inUl = false }
        if (inOl) { html += "</ol>"; inOl = false }
    }

    const processInline = (line: string): string => {
        return line
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/__(.+?)__/g, "<u>$1</u>")
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        // Empty line → close any open list, add paragraph break
        if (!trimmed) {
            closeList()
            continue
        }

        // Headings
        if (trimmed.startsWith("#### ")) {
            closeList()
            html += `<h4>${processInline(trimmed.slice(5))}</h4>`
            continue
        }
        if (trimmed.startsWith("### ")) {
            closeList()
            html += `<h3>${processInline(trimmed.slice(4))}</h3>`
            continue
        }
        if (trimmed.startsWith("## ")) {
            closeList()
            html += `<h2>${processInline(trimmed.slice(3))}</h2>`
            continue
        }
        if (trimmed.startsWith("# ")) {
            closeList()
            html += `<h1>${processInline(trimmed.slice(2))}</h1>`
            continue
        }

            // Blockquote lines
        if (trimmed.startsWith("> ")) {
            closeList()
            const bqLines = [processInline(trimmed.slice(2))]
            while (i + 1 < lines.length && lines[i + 1].trim().startsWith("> ")) {
                i++
                bqLines.push(processInline(lines[i].trim().slice(2)))
            }
            html += `<blockquote><p>${bqLines.join("<br>")}</p></blockquote>`
            continue
        }

        // Horizontal rule
        if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(trimmed)) {
            closeList()
            html += "<hr>"
            continue
        }

        // Unordered list items
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            if (inOl) { html += "</ol>"; inOl = false }
            if (!inUl) { html += "<ul>"; inUl = true }
            html += `<li>${processInline(trimmed.replace(/^[-*]\s/, ""))}</li>`
            continue
        }

        // Ordered list items
        if (/^\d+\.\s/.test(trimmed)) {
            if (inUl) { html += "</ul>"; inUl = false }
            if (!inOl) { html += "<ol>"; inOl = true }
            html += `<li>${processInline(trimmed.replace(/^\d+\.\s/, ""))}</li>`
            continue
        }

        // Regular paragraph text
        closeList()

        // Check if next line is also a non-empty non-special line (continuation)
        // Group consecutive plain text lines into one <p> with <br> between them
        let paragraphLines = [processInline(trimmed)]
        while (i + 1 < lines.length) {
            const nextTrimmed = lines[i + 1].trim()
            if (
                !nextTrimmed ||
                nextTrimmed.startsWith("#") ||
                nextTrimmed.startsWith("> ") ||
                nextTrimmed.startsWith("- ") ||
                nextTrimmed.startsWith("* ") ||
                /^(\*{3,}|-{3,}|_{3,})\s*$/.test(nextTrimmed) ||
                /^\d+\.\s/.test(nextTrimmed)
            ) {
                break
            }
            i++
            paragraphLines.push(processInline(nextTrimmed))
        }

        html += `<p>${paragraphLines.join("<br>")}</p>`
    }

    closeList()
    return html || "<p></p>"
}

export interface CanvasVersion {
    content: string
    timestamp: number
    label?: string
}

/**
 * Convert TipTap editor HTML to clean Markdown.
 * Handles headings, lists, bold, italic, underline, blockquotes, code, and paragraphs.
 */
export function convertHtmlToMarkdown(html: string): string {
    if (!html) return ""

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    function processNode(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || ""
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return ""

        const el = node as HTMLElement
        const tag = el.tagName.toLowerCase()
        const childContent = Array.from(el.childNodes).map(processNode).join("")

        switch (tag) {
            case "h1":
                return `# ${childContent.trim()}\n\n`
            case "h2":
                return `## ${childContent.trim()}\n\n`
            case "h3":
                return `### ${childContent.trim()}\n\n`
            case "h4":
                return `#### ${childContent.trim()}\n\n`
            case "h5":
                return `##### ${childContent.trim()}\n\n`
            case "h6":
                return `###### ${childContent.trim()}\n\n`
            case "p":
                return childContent.trim() ? `${childContent.trim()}\n\n` : "\n"
            case "strong":
            case "b":
                return `**${childContent}**`
            case "em":
            case "i":
                return `*${childContent}*`
            case "u":
                return `__${childContent}__`
            case "s":
            case "del":
                return `~~${childContent}~~`
            case "code": {
                // Check if inside a <pre>
                if (el.parentElement?.tagName.toLowerCase() === "pre") {
                    return childContent
                }
                return `\`${childContent}\``
            }
            case "pre":
                return `\`\`\`\n${childContent.trim()}\n\`\`\`\n\n`
            case "blockquote":
                return childContent
                    .trim()
                    .split("\n")
                    .filter((l) => l.trim())
                    .map((line) => `> ${line}`)
                    .join("\n") + "\n\n"
            case "ul": {
                const items = Array.from(el.children)
                    .filter((c) => c.tagName.toLowerCase() === "li")
                    .map((li) => {
                        const liContent = Array.from(li.childNodes).map(processNode).join("").trim()
                        // Remove trailing newlines from nested paragraphs inside li
                        return `- ${liContent.replace(/\n{2,}$/g, "")}`
                    })
                    .join("\n")
                return items + "\n\n"
            }
            case "ol": {
                const items = Array.from(el.children)
                    .filter((c) => c.tagName.toLowerCase() === "li")
                    .map((li, i) => {
                        const liContent = Array.from(li.childNodes).map(processNode).join("").trim()
                        return `${i + 1}. ${liContent.replace(/\n{2,}$/g, "")}`
                    })
                    .join("\n")
                return items + "\n\n"
            }
            case "li":
                return childContent
            case "br":
                return "\n"
            case "hr":
                return "---\n\n"
            case "mark":
                return childContent // Ignore highlight marks
            case "span": {
                // Preserve color spans as inline HTML in markdown output
                const style = el.getAttribute("style") || ""
                const colorMatch = style.match(/color:\s*([^;]+)/)
                if (colorMatch) {
                    const color = colorMatch[1].trim()
                    return `<span style="color:${color}">${childContent}</span>`
                }
                return childContent
            }
            case "a": {
                const href = el.getAttribute("href") || ""
                return `[${childContent}](${href})`
            }
            default:
                return childContent
        }
    }

    const result = Array.from(doc.body.childNodes).map(processNode).join("")
    // Clean up excessive newlines (max 2 consecutive)
    return result.replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * Helper to get Markdown content from the TipTap editor.
 */
function getEditorMarkdown(editor: ReturnType<typeof useEditor>): string {
    if (!editor) return ""
    return convertHtmlToMarkdown(editor.getHTML())
}

interface CanvasEditorProps {
    initialContent: string
    onContentChange?: (content: string) => void
    onTransformRequest: (content: string, selection: string | null, instruction: string) => Promise<string>
    isTransforming: boolean
    onClose?: () => void
    /** When nonce changes, immediately add a new version with this content (used by mini-chat transforms) */
    externalVersion?: { content: string; label?: string; nonce: number }
    /** Pre-loaded version history from localStorage (restored from previous session) */
    initialVersions?: CanvasVersion[]
    /** Index of the active version in initialVersions */
    initialVersionIndex?: number
    /** localStorage key for persisting version history */
    storageKey?: string
}

export default function CanvasEditor({
    initialContent,
    onContentChange,
    onTransformRequest,
    isTransforming,
    onClose,
    externalVersion,
    initialVersions,
    initialVersionIndex: initialVersionIndexProp,
    storageKey,
}: CanvasEditorProps) {
    const t = useTranslations("canvas")
    const [versions, setVersions] = useState<CanvasVersion[]>(
        initialVersions && initialVersions.length > 0
            ? initialVersions
            : [{ content: initialContent, timestamp: Date.now(), label: t("originalVersion") }]
    )
    const [currentVersionIndex, setCurrentVersionIndex] = useState(
        initialVersionIndexProp != null && initialVersions && initialVersionIndexProp < initialVersions.length
            ? initialVersionIndexProp
            : 0
    )
    const [showDiff, setShowDiff] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null)
    const [selectedText, setSelectedText] = useState("")
    const [wordCount, setWordCount] = useState(0)
    const editorContainerRef = useRef<HTMLDivElement>(null)

    // Refs to track external content updates and prevent feedback loops
    const lastExternalContentRef = useRef(initialContent)
    const isExternalUpdateRef = useRef(false)
    const isUserEditRef = useRef(false)
    // Debounce timer for auto-versioning direct user edits
    const userEditDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Persist version history to localStorage whenever it changes
    useEffect(() => {
        if (!storageKey) return
        try {
            const latestContent = versions[versions.length - 1]?.content ?? initialContent
            localStorage.setItem(storageKey, JSON.stringify({
                versions: versions.slice(-30), // keep max 30 versions
                currentVersionIndex,
                latestContent,
                savedAt: Date.now(),
            }))
        } catch {
            // Ignore storage errors (e.g., private mode)
        }
    }, [versions, currentVersionIndex, storageKey, initialContent])

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
            }),
            Placeholder.configure({
                placeholder: t("editPlaceholder"),
            }),
            Highlight.configure({
                multicolor: true,
            }),
            Underline,
            TextStyle,
            Color,
        ],
        content: convertMarkdownToHtml(initialContent),
        editorProps: {
            attributes: {
                class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-12 sm:px-24 lg:px-40 xl:px-52 py-10 text-sm leading-7",
            },
        },
        onCreate: ({ editor }) => {
            // Update word count on initial load
            const text = editor.state.doc.textContent
            setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
        },
        onUpdate: ({ editor }) => {
            // Update word count on every change
            const text = editor.state.doc.textContent
            setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)

            // Don't report back when content was set externally (prevents loop)
            if (isExternalUpdateRef.current) {
                isExternalUpdateRef.current = false
                return
            }
            // Mark this as a user-initiated edit so the initialContent sync effect
            // doesn't reset the editor when the parent feeds the value back.
            isUserEditRef.current = true
            const markdown = getEditorMarkdown(editor)
            onContentChange?.(markdown)

            // Auto-version after 3 s of typing inactivity
            if (userEditDebounceRef.current) clearTimeout(userEditDebounceRef.current)
            userEditDebounceRef.current = setTimeout(() => {
                const snapshot = getEditorMarkdown(editor)
                setVersions((prev) => {
                    const last = prev[prev.length - 1]
                    if (last?.content === snapshot) return prev
                    const next = [...prev, { content: snapshot, timestamp: Date.now() }]
                    setCurrentVersionIndex(next.length - 1)
                    return next
                })
            }, 3000)
        },
    })

    // Sync editor when initialContent prop changes.
    // Version creation is handled separately via externalVersion + debounce.
    // This effect only keeps the editor display in sync (echo-prevention for user edits).
    useEffect(() => {
        if (!editor) return
        if (initialContent === lastExternalContentRef.current) return

        if (isUserEditRef.current) {
            // Echo of the user's own edit coming back as a prop — just update the ref.
            isUserEditRef.current = false
            lastExternalContentRef.current = initialContent
            return
        }

        // True external reset (e.g., CanvasDialog re-opened with different content).
        // Sync editor display only; do NOT add a version here.
        lastExternalContentRef.current = initialContent
        isExternalUpdateRef.current = true
        editor.commands.setContent(convertMarkdownToHtml(initialContent))
    }, [initialContent, editor])

    // Add a version for mini-chat transforms (nonce changes on each new transform).
    useEffect(() => {
        if (!externalVersion || !editor) return
        // Cancel any pending user-edit debounce snapshot
        if (userEditDebounceRef.current) clearTimeout(userEditDebounceRef.current)
        // Set editor content
        isExternalUpdateRef.current = true
        isUserEditRef.current = false
        editor.commands.setContent(convertMarkdownToHtml(externalVersion.content))
        lastExternalContentRef.current = externalVersion.content
        // Add version (always append — mini-chat always produces the new latest)
        const { content, label } = externalVersion
        setVersions((prev) => {
            const next = [...prev, { content, timestamp: Date.now(), label }]
            setCurrentVersionIndex(next.length - 1)
            return next
        })
        onContentChange?.(externalVersion.content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [externalVersion?.nonce])

    // Sync editor content when navigating between versions
    useEffect(() => {
        if (!editor) return
        const versionContent = versions[currentVersionIndex]?.content ?? ""
        const currentEditorContent = getEditorMarkdown(editor)
        if (currentEditorContent !== versionContent) {
            isExternalUpdateRef.current = true
            editor.commands.setContent(convertMarkdownToHtml(versionContent))
        }
        // NOTE: do NOT call onContentChange here — this effect fires on mount and
        // on every version addition, which would overwrite CanvasDialog's currentContent.
        // Propagation is handled explicitly in handleNavigateVersion and handleRestoreVersion.
    }, [currentVersionIndex, versions, editor])

    // Ref to the popover wrapper so we can check containment without querying the DOM
    const popoverWrapperRef = useRef<HTMLDivElement>(null)

    // Selection detection: listen for mouseup on the editor container
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
                // Center the popover under the selection (popover minWidth = 500px)
                const popoverWidth = Math.min(500, window.innerWidth - 32)
                const centeredLeft = rect.left + rect.width / 2 - popoverWidth / 2
                setPopoverPosition({
                    top: rect.bottom + 10,
                    left: Math.max(16, Math.min(centeredLeft, window.innerWidth - popoverWidth - 16)),
                })
            }, 10)
        }

        container.addEventListener("mouseup", handleMouseUp)
        return () => {
            container.removeEventListener("mouseup", handleMouseUp)
        }
    }, [])

    // Close popover when clicking inside the EDITOR container (not on the popover).
    // We use a native capture-phase listener on document so it fires before React.
    // This checks our popoverWrapperRef to avoid closing when clicking inside the popover.
    useEffect(() => {
        const handleDocumentMouseDown = (e: MouseEvent) => {
            // If popover is not visible, nothing to do
            if (!popoverPosition) return

            // If click is inside the popover wrapper, don't close
            if (popoverWrapperRef.current && popoverWrapperRef.current.contains(e.target as Node)) {
                return
            }

            // Click was outside the popover → close it
            setPopoverPosition(null)
            setSelectedText("")
        }

        // Use capture phase so it fires before any React synthetic event
        document.addEventListener("mousedown", handleDocumentMouseDown, true)
        return () => {
            document.removeEventListener("mousedown", handleDocumentMouseDown, true)
        }
    }, [popoverPosition])

    const addVersion = useCallback(
        (content: string, label?: string) => {
            const newVersion: CanvasVersion = {
                content,
                timestamp: Date.now(),
                label,
            }
            setVersions((prev) => {
                const next = [...prev.slice(0, currentVersionIndex + 1), newVersion]
                setCurrentVersionIndex(next.length - 1)
                return next
            })
        },
        [currentVersionIndex],
    )

    // Navigate to a specific version index AND immediately propagate content to CanvasDialog
    const handleNavigateVersion = useCallback(
        (newIndex: number) => {
            const bounded = Math.max(0, Math.min(versions.length - 1, newIndex))
            setCurrentVersionIndex(bounded)
            onContentChange?.(versions[bounded]?.content ?? "")
        },
        [versions, onContentChange],
    )

    const handleRestoreVersion = useCallback(() => {
        if (!editor || currentVersionIndex >= versions.length - 1) return
        const content = versions[currentVersionIndex].content
        const restoredLabel = t("versionRestored", { n: currentVersionIndex + 1 })
        isExternalUpdateRef.current = true
        editor.commands.setContent(convertMarkdownToHtml(content))
        setVersions((prev) => {
            const newVersion: CanvasVersion = { content, timestamp: Date.now(), label: restoredLabel }
            const next = [...prev, newVersion]
            setCurrentVersionIndex(next.length - 1)
            return next
        })
        onContentChange?.(content)
    }, [editor, currentVersionIndex, versions, t, onContentChange])

    const handleSelectionTransform = useCallback(
        async (instruction: string) => {
            if (!editor) return
            const fullContent = getEditorMarkdown(editor)
            try {
                const result = await onTransformRequest(fullContent, selectedText, instruction)
                isExternalUpdateRef.current = true
                editor.commands.setContent(convertMarkdownToHtml(result))
                // Update ref so initialContent useEffect doesn't try to re-sync
                lastExternalContentRef.current = result
                if (userEditDebounceRef.current) clearTimeout(userEditDebounceRef.current)
                const versionLabel = instruction.length > 40 ? instruction.slice(0, 40) + "\u2026" : instruction
                addVersion(result, versionLabel)
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
            await navigator.clipboard.writeText(getEditorMarkdown(editor))
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch {
            const textArea = document.createElement("textarea")
            textArea.value = getEditorMarkdown(editor)
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
        downloadAsPDF(getEditorMarkdown(editor), `lienzo-${Date.now()}.pdf`)
    }, [editor])

    const handleExportWord = useCallback(() => {
        if (!editor) return
        downloadAsWord(getEditorMarkdown(editor), `lienzo-${Date.now()}.docx`)
    }, [editor])

    // Diff view: previous and current version indices for side-by-side comparison
    const diffPrevIndex = currentVersionIndex > 0 ? currentVersionIndex - 1 : 0
    const diffCurrIndex = currentVersionIndex

    return (
        <div className="flex h-full flex-col">
            <CanvasToolbar
                currentVersion={currentVersionIndex + 1}
                totalVersions={versions.length}
                versions={versions}
                showDiff={showDiff}
                onPrevVersion={() => handleNavigateVersion(currentVersionIndex - 1)}
                onNextVersion={() => handleNavigateVersion(currentVersionIndex + 1)}
                onJumpToVersion={handleNavigateVersion}
                onRestoreVersion={handleRestoreVersion}
                onToggleDiff={() => setShowDiff((s) => !s)}
                onExportPdf={handleExportPdf}
                onExportWord={handleExportWord}
                onCopy={handleCopy}
                onClose={() => onClose?.()}
                isCopied={isCopied}
                wordCount={wordCount}
            />

            <div
                ref={editorContainerRef}
                className="flex-1 overflow-y-auto canvas-editor-container"
                data-canvas-editor
                style={{
                    // Ensure text selection is clearly visible
                }}
            >
                <style>{`
                    .canvas-editor-container .ProseMirror::selection,
                    .canvas-editor-container .ProseMirror *::selection {
                        background-color: rgba(141, 198, 63, 0.35) !important;
                        color: inherit !important;
                    }
                    .canvas-editor-container .ProseMirror:focus ::selection {
                        background-color: rgba(141, 198, 63, 0.45) !important;
                    }
                    /* Keep selection visible even when popover input has focus */
                    .canvas-editor-container .ProseMirror {
                        caret-color: currentColor;
                    }
                    .canvas-editor-container .ProseMirror *::selection {
                        background-color: rgba(141, 198, 63, 0.35) !important;
                    }
                    /* Headings */
                    .canvas-editor-container .ProseMirror h1 {
                        font-size: 1.6rem;
                        font-weight: 700;
                        line-height: 1.25;
                        margin-top: 1.5em;
                        margin-bottom: 0.5em;
                        letter-spacing: -0.02em;
                        border-bottom: 1px solid hsl(var(--border) / 0.5);
                        padding-bottom: 0.3em;
                    }
                    .canvas-editor-container .ProseMirror h2 {
                        font-size: 1.25rem;
                        font-weight: 650;
                        line-height: 1.3;
                        margin-top: 1.4em;
                        margin-bottom: 0.4em;
                        letter-spacing: -0.01em;
                        color: hsl(var(--foreground) / 0.92);
                    }
                    .canvas-editor-container .ProseMirror h3 {
                        font-size: 1.05rem;
                        font-weight: 620;
                        line-height: 1.35;
                        margin-top: 1.25em;
                        margin-bottom: 0.35em;
                        color: hsl(var(--foreground) / 0.9);
                    }
                    .canvas-editor-container .ProseMirror h4 {
                        font-size: 0.95rem;
                        font-weight: 610;
                        line-height: 1.4;
                        margin-top: 1.15em;
                        margin-bottom: 0.3em;
                        color: hsl(var(--foreground) / 0.85);
                    }
                    .canvas-editor-container .ProseMirror h1:first-child,
                    .canvas-editor-container .ProseMirror h2:first-child,
                    .canvas-editor-container .ProseMirror h3:first-child {
                        margin-top: 0;
                    }
                    /* Paragraphs */
                    .canvas-editor-container .ProseMirror p {
                        margin-bottom: 0.85em;
                        line-height: 1.75;
                        font-size: 0.875rem;
                        color: hsl(var(--foreground) / 0.85);
                        letter-spacing: 0.01em;
                    }
                    /* Placeholder */
                    .canvas-editor-container .ProseMirror p.is-editor-empty:first-child::before {
                        color: hsl(var(--muted-foreground) / 0.5);
                        font-style: italic;
                    }
                    /* Lists */
                    .canvas-editor-container .ProseMirror ul {
                        margin-left: 1.25em;
                        margin-bottom: 0.85em;
                        list-style-type: disc;
                    }
                    .canvas-editor-container .ProseMirror ol {
                        margin-left: 1.25em;
                        margin-bottom: 0.85em;
                        list-style-type: decimal;
                    }
                    .canvas-editor-container .ProseMirror li {
                        margin-bottom: 0.3em;
                        line-height: 1.75;
                        font-size: 0.875rem;
                        padding-left: 0.25em;
                        letter-spacing: 0.01em;
                    }
                    .canvas-editor-container .ProseMirror li p {
                        margin-bottom: 0.2em;
                    }
                    /* Strong and emphasis */
                    .canvas-editor-container .ProseMirror strong {
                        font-weight: 680;
                        color: hsl(var(--foreground));
                    }
                    .canvas-editor-container .ProseMirror em {
                        font-style: italic;
                        color: hsl(var(--foreground) / 0.88);
                    }
                    /* Blockquotes */
                    .canvas-editor-container .ProseMirror blockquote {
                        border-left: 3px solid rgba(141, 198, 63, 0.5);
                        padding-left: 1em;
                        margin-left: 0;
                        margin-bottom: 1em;
                        color: hsl(var(--foreground) / 0.75);
                        font-style: italic;
                    }
                    /* Horizontal rule */
                    .canvas-editor-container .ProseMirror hr {
                        border: none;
                        border-top: 1px solid hsl(var(--border));
                        margin: 1.5em 0;
                    }
                    /* Code */
                    .canvas-editor-container .ProseMirror code {
                        background: hsl(var(--muted));
                        padding: 0.2em 0.4em;
                        border-radius: 0.25em;
                        font-size: 0.9em;
                    }
                    .canvas-editor-container .ProseMirror pre {
                        background: hsl(var(--muted));
                        padding: 1em;
                        border-radius: 0.5em;
                        overflow-x: auto;
                        margin-bottom: 1em;
                    }
                    .canvas-editor-container .ProseMirror pre code {
                        background: none;
                        padding: 0;
                    }
                    /* Diff panel: apply canvas-like typography to ReactMarkdown rendered content */
                    .canvas-diff-panel h1 {
                        font-size: 1.6rem;
                        font-weight: 700;
                        line-height: 1.3;
                        margin-top: 1.5em;
                        margin-bottom: 0.5em;
                        letter-spacing: -0.02em;
                        border-bottom: 1px solid hsl(var(--border) / 0.5);
                        padding-bottom: 0.3em;
                    }
                    .canvas-diff-panel h2 {
                        font-size: 1.25rem;
                        font-weight: 650;
                        line-height: 1.3;
                        margin-top: 1.3em;
                        margin-bottom: 0.4em;
                        letter-spacing: -0.01em;
                    }
                    .canvas-diff-panel h3 {
                        font-size: 1.05rem;
                        font-weight: 620;
                        line-height: 1.35;
                        margin-top: 1.2em;
                        margin-bottom: 0.35em;
                    }
                    .canvas-diff-panel h4 {
                        font-size: 0.95rem;
                        font-weight: 600;
                        line-height: 1.4;
                        margin-top: 1.1em;
                        margin-bottom: 0.3em;
                    }
                    .canvas-diff-panel p {
                        margin-bottom: 0.75em;
                        line-height: 1.75;
                        font-size: 0.875rem;
                        letter-spacing: 0.01em;
                        color: hsl(var(--foreground) / 0.85);
                    }
                    .canvas-diff-panel ul, .canvas-diff-panel ol {
                        margin-left: 1.25em;
                        margin-bottom: 0.85em;
                    }
                    .canvas-diff-panel li {
                        margin-bottom: 0.25em;
                        line-height: 1.7;
                        font-size: 0.875rem;
                    }
                    .canvas-diff-panel blockquote {
                        border-left: 3px solid rgba(141, 198, 63, 0.5);
                        padding-left: 1em;
                        margin-left: 0;
                        margin-bottom: 1em;
                        color: hsl(var(--foreground) / 0.75);
                        font-style: italic;
                    }
                    .canvas-diff-panel code {
                        background: hsl(var(--muted));
                        padding: 0.2em 0.4em;
                        border-radius: 0.25em;
                        font-size: 0.9em;
                    }
                `}</style>
                {showDiff && versions.length > 1 ? (
                    <div className="flex h-full divide-x overflow-auto">
                        {/* Left panel: previous version */}
                        <div className="flex-1 overflow-y-auto px-8 py-6 min-w-0">
                            <div className="mb-4 flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-red-400 shrink-0" />
                                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                    {t("diffPreviousVersion")}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                    — {versions[diffPrevIndex]?.label ?? t("versionN", { n: diffPrevIndex + 1 })}
                                </span>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none canvas-diff-panel">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {versions[diffPrevIndex]?.content || ""}
                                </ReactMarkdown>
                            </div>
                        </div>
                        {/* Right panel: current version */}
                        <div className="flex-1 overflow-y-auto px-8 py-6 min-w-0">
                            <div className="mb-4 flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />
                                <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                                    {t("diffCurrentVersion")}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                    — {versions[diffCurrIndex]?.label ?? t("versionN", { n: diffCurrIndex + 1 })}
                                </span>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none canvas-diff-panel">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {versions[diffCurrIndex]?.content || ""}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ) : (
                    <EditorContent editor={editor} />
                )}
            </div>

            <div ref={popoverWrapperRef} data-canvas-popover>
                <SelectionPopover
                    position={popoverPosition}
                    selectedText={selectedText}
                    onSubmit={handleSelectionTransform}
                    onClose={() => {
                        setPopoverPosition(null)
                        setSelectedText("")
                    }}
                    isTransforming={isTransforming}
                    editor={editor}
                />
            </div>
        </div>
    )
}
