"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import Underline from "@tiptap/extension-underline"
import { useTranslations } from "next-intl"
import SelectionPopover from "./SelectionPopover"
import CanvasToolbar from "./CanvasToolbar"
import { downloadAsPDF, downloadAsWord } from "@/lib/document-generator"

/**
 * Simple word-level diff without external dependencies.
 * Uses the Hunt-McIlroy LCS on words to produce added/removed/equal spans.
 */
function simpleWordDiff(oldText: string, newText: string): Array<{ value: string; added?: boolean; removed?: boolean }> {
    const oldWords = oldText.split(/(\s+)/)
    const newWords = newText.split(/(\s+)/)

    // LCS (Longest Common Subsequence) via dynamic programming
    const m = oldWords.length
    const n = newWords.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = oldWords[i - 1] === newWords[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1])
        }
    }

    // Backtrack to build result
    const result: Array<{ value: string; added?: boolean; removed?: boolean }> = []
    let i = m, j = n
    const stack: Array<{ value: string; added?: boolean; removed?: boolean }> = []
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
            stack.push({ value: oldWords[i - 1] })
            i--; j--
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            stack.push({ value: newWords[j - 1], added: true })
            j--
        } else {
            stack.push({ value: oldWords[i - 1], removed: true })
            i--
        }
    }
    stack.reverse()

    // Merge consecutive spans of same type
    for (const item of stack) {
        const last = result[result.length - 1]
        if (last && last.added === item.added && last.removed === item.removed) {
            last.value += item.value
        } else {
            result.push({ ...item })
        }
    }
    return result
}

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
                nextTrimmed.startsWith("- ") ||
                nextTrimmed.startsWith("* ") ||
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
    const isUserEditRef = useRef(false)

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
        ],
        content: convertMarkdownToHtml(initialContent), // FIX Bug 1: convert markdown to HTML
        editorProps: {
            attributes: {
                class: "prose prose-base dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-8 sm:px-16 lg:px-24 py-10",
            },
        },
        onUpdate: ({ editor }) => {
            // Don't report back when content was set externally (prevents loop)
            if (isExternalUpdateRef.current) {
                isExternalUpdateRef.current = false
                return
            }
            // Mark this as a user-initiated edit so the initialContent sync effect
            // doesn't reset the editor when the parent feeds the value back.
            isUserEditRef.current = true
            onContentChange?.(getEditorMarkdown(editor))
        },
    })

    // Sync editor when initialContent prop changes (from transform API result)
    useEffect(() => {
        if (!editor) return
        if (initialContent === lastExternalContentRef.current) return

        // If this change came from the user editing the editor (onUpdate → parent → back here),
        // just update the ref without resetting the editor content or adding a version.
        if (isUserEditRef.current) {
            isUserEditRef.current = false
            lastExternalContentRef.current = initialContent
            return
        }

        lastExternalContentRef.current = initialContent

        // Set content in editor, suppressing the onUpdate callback
        isExternalUpdateRef.current = true
        editor.commands.setContent(convertMarkdownToHtml(initialContent))

        // Add as new version (only for real external changes like transform results)
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
                setPopoverPosition({
                    top: rect.bottom + 8,
                    left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)),
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

    // Diff view rendering using inline word-diff (no external dependency)
    const [diffHtml, setDiffHtml] = useState<string | null>(null)
    useEffect(() => {
        if (!showDiff || versions.length < 2 || currentVersionIndex === 0) {
            setDiffHtml(null)
            return
        }
        try {
            const prev = versions[currentVersionIndex - 1].content
            const curr = versions[currentVersionIndex].content
            const changes = simpleWordDiff(prev, curr)
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
        } catch {
            // Fallback if diff fails
            setDiffHtml(`<p>${versions[currentVersionIndex].content}</p>`)
        }
    }, [showDiff, versions, currentVersionIndex])

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
                        font-size: 2rem;
                        font-weight: 800;
                        line-height: 1.2;
                        margin-top: 1.5em;
                        margin-bottom: 0.6em;
                        letter-spacing: -0.02em;
                        border-bottom: 2px solid rgba(141, 198, 63, 0.3);
                        padding-bottom: 0.3em;
                    }
                    .canvas-editor-container .ProseMirror h2 {
                        font-size: 1.55rem;
                        font-weight: 700;
                        line-height: 1.25;
                        margin-top: 1.4em;
                        margin-bottom: 0.5em;
                        letter-spacing: -0.01em;
                        color: hsl(var(--foreground) / 0.9);
                    }
                    .canvas-editor-container .ProseMirror h3 {
                        font-size: 1.25rem;
                        font-weight: 650;
                        line-height: 1.3;
                        margin-top: 1.3em;
                        margin-bottom: 0.45em;
                    }
                    .canvas-editor-container .ProseMirror h4 {
                        font-size: 1.05rem;
                        font-weight: 600;
                        line-height: 1.35;
                        margin-top: 1.25em;
                        margin-bottom: 0.4em;
                        color: hsl(var(--foreground) / 0.8);
                    }
                    .canvas-editor-container .ProseMirror h1:first-child {
                        margin-top: 0;
                    }
                    /* Paragraphs */
                    .canvas-editor-container .ProseMirror p {
                        margin-bottom: 0.85em;
                        line-height: 1.75;
                        color: hsl(var(--foreground) / 0.88);
                    }
                    /* Lists */
                    .canvas-editor-container .ProseMirror ul {
                        margin-left: 1.25em;
                        margin-bottom: 1em;
                        list-style-type: disc;
                    }
                    .canvas-editor-container .ProseMirror ol {
                        margin-left: 1.25em;
                        margin-bottom: 1em;
                        list-style-type: decimal;
                    }
                    .canvas-editor-container .ProseMirror li {
                        margin-bottom: 0.35em;
                        line-height: 1.7;
                        padding-left: 0.25em;
                    }
                    .canvas-editor-container .ProseMirror li p {
                        margin-bottom: 0.2em;
                    }
                    /* Strong and emphasis */
                    .canvas-editor-container .ProseMirror strong {
                        font-weight: 650;
                        color: hsl(var(--foreground));
                    }
                    .canvas-editor-container .ProseMirror em {
                        font-style: italic;
                        color: hsl(var(--foreground) / 0.85);
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
                `}</style>
                {showDiff && diffHtml ? (
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none px-6 py-4 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: diffHtml }}
                    />
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
