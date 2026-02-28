import { jsPDF } from "jspdf"
import { saveAs } from "file-saver"

// ────────────────────────────────────────────────
// Utilidad: eliminar sección "Fuentes consultadas"
// ────────────────────────────────────────────────

/**
 * Elimina la sección "📚 Fuentes consultadas" del contenido markdown.
 * Se usa antes de exportar a PDF/Word y en modo lienzo.
 */
export function stripSourcesSection(content: string): string {
    return content
        .replace(/\n*📚\s*\*?Fuentes consultadas[:\s][\s\S]*$/gim, '')
        .replace(/\n*\*?Fuentes consultadas[:\s][\s\S]*$/gim, '')
        .trim()
}

/**
 * Extrae solo el texto de la sección "📚 Fuentes consultadas" (sin el encabezado).
 * Devuelve null si no hay fuentes.
 */
export function extractSourcesText(content: string): string | null {
    const match = content.match(/📚\s*\*?Fuentes consultadas[:\s*]+(.+)/im)
    if (!match) return null
    // Quitar asteriscos de markdown italic
    return match[1].replace(/\*+/g, '').trim() || null
}

// ────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────

interface MarkdownSection {
    type: "heading" | "bullet" | "numbered" | "code" | "blockquote" | "paragraph" | "hr"
    content: string
    level?: number
    items?: string[]
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

/** Convierte formato inline de Markdown → HTML (bold, italic, underline, code, strikethrough) */
function inlineMarkdownToHtml(text: string): string {
    return text
        .replace(/`(.+?)`/g, '<code style="font-family:\'Courier New\',monospace;background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.+?)__/g, "<u>$1</u>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/~~(.+?)~~/g, "<del>$1</del>")
}

/** Tipo de segmento inline para el renderizado PDF */
interface InlineSegment {
    text: string
    bold: boolean
    italic: boolean
    code: boolean
}

/** Parsea markdown inline a segmentos con estilo para PDF */
function parseInlineSegments(text: string): InlineSegment[] {
    const segments: InlineSegment[] = []
    // Regex que captura: code(`), bold(**), italic(*), o texto normal
    const regex = /`([^`]+)`|\*\*(.+?)\*\*|\*(.+?)\*|([^`*]+)/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
        if (match[1] !== undefined) {
            segments.push({ text: match[1], bold: false, italic: false, code: true })
        } else if (match[2] !== undefined) {
            segments.push({ text: match[2], bold: true, italic: false, code: false })
        } else if (match[3] !== undefined) {
            segments.push({ text: match[3], bold: false, italic: true, code: false })
        } else if (match[4] !== undefined) {
            segments.push({ text: match[4], bold: false, italic: false, code: false })
        }
    }

    return segments.length > 0 ? segments : [{ text, bold: false, italic: false, code: false }]
}

/** Limpia formato markdown inline (para calcular anchos en PDF) */
function stripInlineMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/~~(.+?)~~/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .trim()
}

// Función para parsear markdown en secciones — PRESERVA formato inline
function parseMarkdown(markdown: string): MarkdownSection[] {
    const lines = markdown.split("\n")
    const sections: MarkdownSection[] = []

    let inCodeBlock = false
    let codeBlockContent = ""
    let currentList: string[] = []
    let lastListType: "bullet" | "numbered" | null = null

    const flushList = () => {
        if (currentList.length > 0) {
            sections.push({ type: lastListType || "bullet", content: "", items: [...currentList] })
            currentList = []
            lastListType = null
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Bloques de código
        if (line.trim().startsWith("```")) {
            flushList()
            if (inCodeBlock) {
                sections.push({ type: "code", content: codeBlockContent.trim() })
                codeBlockContent = ""
            }
            inCodeBlock = !inCodeBlock
            continue
        }
        if (inCodeBlock) {
            codeBlockContent += line + "\n"
            continue
        }

        // Línea horizontal
        if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
            flushList()
            sections.push({ type: "hr", content: "" })
            continue
        }

        // Headers (preserva contenido con formato inline)
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
        if (headerMatch) {
            flushList()
            sections.push({ type: "heading", content: headerMatch[2].trim(), level: headerMatch[1].length })
            continue
        }

        // Blockquotes
        const blockquoteMatch = line.match(/^>\s*(.*)$/)
        if (blockquoteMatch) {
            flushList()
            sections.push({ type: "blockquote", content: blockquoteMatch[1].trim() })
            continue
        }

        // Bullets (preserva formato inline en items)
        const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/)
        if (bulletMatch) {
            if (lastListType !== "bullet" && currentList.length > 0) {
                flushList()
            }
            currentList.push(bulletMatch[1].trim())
            lastListType = "bullet"
            continue
        }

        // Listas numeradas
        const numberedMatch = line.match(/^\s*\d+\.\s+(.+)$/)
        if (numberedMatch) {
            if (lastListType !== "numbered" && currentList.length > 0) {
                flushList()
            }
            currentList.push(numberedMatch[1].trim())
            lastListType = "numbered"
            continue
        }

        // Si se rompe la lista, guardarla
        if (currentList.length > 0 && line.trim()) {
            flushList()
        }

        // Párrafo
        if (line.trim()) {
            sections.push({ type: "paragraph", content: line.trim() })
        }
    }

    flushList()
    if (inCodeBlock && codeBlockContent.trim()) {
        sections.push({ type: "code", content: codeBlockContent.trim() })
    }

    return sections
}

// Función para cargar imagen
function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
    })
}

// Función para convertir blob a base64
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result)
            } else {
                reject(new Error("Failed to convert blob to base64"))
            }
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

// ────────────────────────────────────────────────
// PDF – Renderizado con formato inline
// ────────────────────────────────────────────────

/** Renderiza texto con formato inline (bold/italic/code) en jsPDF */
function renderInlineText(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
): number {
    const segments = parseInlineSegments(text)
    const lineHeight = fontSize * 0.45
    let cursorX = x
    let cursorY = y

    for (const seg of segments) {
        if (seg.code) {
            doc.setFont("courier", "normal")
            doc.setFontSize(fontSize - 1)
        } else {
            const style = seg.bold && seg.italic ? "bolditalic" : seg.bold ? "bold" : seg.italic ? "italic" : "normal"
            doc.setFont("helvetica", style)
            doc.setFontSize(fontSize)
        }

        const words = seg.text.split(/(\s+)/)
        for (const word of words) {
            if (!word) continue
            const wordWidth = doc.getTextWidth(word)

            if (cursorX + wordWidth > x + maxWidth && cursorX > x) {
                cursorX = x
                cursorY += lineHeight
            }

            doc.text(word, cursorX, cursorY)
            cursorX += wordWidth
        }

        // Restaurar fuente
        doc.setFont("helvetica", "normal")
        doc.setFontSize(fontSize)
    }

    return cursorY + lineHeight
}

/** Calcula las líneas que ocupará un texto inline para estimar altura */
function estimateInlineHeight(
    doc: jsPDF,
    text: string,
    maxWidth: number,
    fontSize: number,
): number {
    const plainText = stripInlineMarkdown(text)
    doc.setFontSize(fontSize)
    doc.setFont("helvetica", "normal")
    const lines = doc.splitTextToSize(plainText, maxWidth)
    return lines.length * fontSize * 0.45
}

// Función para generar PDF mejorada con formato inline
export async function downloadAsPDF(rawContent: string, filename: string = "respuesta-ia.pdf") {
    // Eliminar sección "Fuentes consultadas" antes de exportar
    const content = stripSourcesSection(rawContent)

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - 2 * margin
    let yPosition = margin

    const checkNewPage = (needed: number) => {
        if (yPosition + needed > pageHeight - margin) {
            doc.addPage()
            yPosition = margin
        }
    }

    // ── Logo centrado ──
    try {
        const logoImg = await loadImage("/Logotipo RPJ.jpg")
        const logoWidth = 50
        const logoHeight = (logoImg.height * logoWidth) / logoImg.width
        const logoX = (pageWidth - logoWidth) / 2
        doc.addImage(logoImg.src, "JPEG", logoX, yPosition, logoWidth, logoHeight)
        yPosition += logoHeight + 15
    } catch (error) {
        console.warn("No se pudo cargar el logo:", error)
    }

    // ── Parsear markdown ──
    const sections = parseMarkdown(content)
    doc.setFont("helvetica")

    // Colores para headings
    const headingColors: Record<number, [number, number, number]> = {
        1: [30, 41, 59],    // slate-800
        2: [51, 65, 85],    // slate-700
        3: [71, 85, 105],   // slate-600
        4: [100, 116, 139], // slate-500
    }

    for (const section of sections) {
        switch (section.type) {
            case "heading": {
                const level = section.level || 1
                const fontSize = level === 1 ? 18 : level === 2 ? 15 : level === 3 ? 13 : 11.5
                const spacing = level === 1 ? 10 : level === 2 ? 8 : 6
                const estHeight = estimateInlineHeight(doc, section.content, maxWidth, fontSize) + spacing
                checkNewPage(estHeight)

                const color = headingColors[level] || headingColors[4]
                doc.setTextColor(color[0], color[1], color[2])

                // Línea decorativa bajo H1
                if (level === 1) {
                    yPosition = renderInlineText(doc, section.content, margin, yPosition, maxWidth, fontSize)
                    doc.setDrawColor(200, 200, 200)
                    doc.setLineWidth(0.3)
                    doc.line(margin, yPosition - 1, margin + maxWidth, yPosition - 1)
                    yPosition += 4
                } else {
                    yPosition = renderInlineText(doc, section.content, margin, yPosition, maxWidth, fontSize)
                    yPosition += spacing - 4
                }

                doc.setTextColor(0, 0, 0)
                doc.setFont("helvetica", "normal")
                break
            }

            case "bullet":
            case "numbered": {
                if (section.items) {
                    const fontSize = 11
                    for (let idx = 0; idx < section.items.length; idx++) {
                        const item = section.items[idx]
                        const estH = estimateInlineHeight(doc, item, maxWidth - 10, fontSize)
                        checkNewPage(estH + 2)

                        const bullet = section.type === "numbered" ? `${idx + 1}.` : "•"
                        doc.setFont("helvetica", "normal")
                        doc.setFontSize(fontSize)
                        doc.text(bullet, margin + 3, yPosition)

                        const bulletOffset = section.type === "numbered" ? 8 : 6
                        yPosition = renderInlineText(doc, item, margin + bulletOffset, yPosition, maxWidth - bulletOffset, fontSize)
                        yPosition += 1
                    }
                    yPosition += 3
                }
                break
            }

            case "blockquote": {
                const fontSize = 11
                const estH = estimateInlineHeight(doc, section.content, maxWidth - 12, fontSize)
                checkNewPage(estH + 4)

                // Barra lateral azul
                doc.setDrawColor(99, 102, 241) // indigo-500
                doc.setLineWidth(0.8)
                doc.line(margin + 2, yPosition - 3, margin + 2, yPosition + estH)

                // Fondo sutil
                doc.setFillColor(248, 250, 252) // slate-50
                doc.rect(margin + 4, yPosition - 3, maxWidth - 4, estH + 3, "F")

                doc.setTextColor(71, 85, 105) // slate-600
                doc.setFont("helvetica", "italic")
                yPosition = renderInlineText(doc, section.content, margin + 8, yPosition, maxWidth - 12, fontSize)
                yPosition += 4
                doc.setTextColor(0, 0, 0)
                doc.setFont("helvetica", "normal")
                break
            }

            case "code": {
                doc.setFontSize(9)
                doc.setFont("courier", "normal")
                const codeLines = section.content.split("\n")
                const lineHeight = 4.5
                const blockHeight = codeLines.length * lineHeight + 6
                checkNewPage(blockHeight)

                // Fondo con borde
                doc.setFillColor(243, 244, 246) // gray-100
                doc.setDrawColor(209, 213, 219) // gray-300
                doc.setLineWidth(0.2)
                doc.roundedRect(margin, yPosition - 3, maxWidth, blockHeight, 1.5, 1.5, "FD")

                doc.setTextColor(55, 65, 81) // gray-700
                for (const codeLine of codeLines) {
                    doc.text(codeLine || " ", margin + 4, yPosition + 2)
                    yPosition += lineHeight
                }

                yPosition += 8
                doc.setFont("helvetica", "normal")
                doc.setTextColor(0, 0, 0)
                break
            }

            case "hr": {
                checkNewPage(8)
                doc.setDrawColor(200, 200, 200)
                doc.setLineWidth(0.3)
                const hrY = yPosition + 2
                doc.line(margin, hrY, margin + maxWidth, hrY)
                yPosition += 8
                break
            }

            default: {
                // Párrafo
                if (section.content) {
                    const fontSize = 11
                    const estH = estimateInlineHeight(doc, section.content, maxWidth, fontSize)
                    checkNewPage(estH + 3)
                    doc.setTextColor(30, 41, 59) // slate-800
                    yPosition = renderInlineText(doc, section.content, margin, yPosition, maxWidth, fontSize)
                    yPosition += 3
                    doc.setTextColor(0, 0, 0)
                }
            }
        }
    }

    doc.save(filename)
}

// ────────────────────────────────────────────────
// Word – Exportación con formato inline rico
// ────────────────────────────────────────────────

export async function downloadAsWord(rawContent: string, filename: string = "respuesta.docx"): Promise<void> {
    // Eliminar sección "Fuentes consultadas" antes de exportar
    const content = stripSourcesSection(rawContent)

    // Cargar logo
    const logoUrl = `/Logotipo RPJ.jpg?v=${Date.now()}`
    let logoBase64 = ""

    try {
        const response = await fetch(logoUrl)
        if (response.ok) {
            const logoBlob = await response.blob()
            logoBase64 = await blobToBase64(logoBlob)
        }
    } catch (error) {
        console.warn("No se pudo cargar el logo:", error)
    }

    const sections = parseMarkdown(content)

    let htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word">
    <meta name="Originator" content="Microsoft Word">
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page Section1 {
            size: 8.5in 11.0in;
            margin: 1.0in 1.0in 1.0in 1.0in;
            mso-header-margin: 0.5in;
            mso-footer-margin: 0.5in;
            mso-paper-source: 0;
        }
        div.Section1 { page: Section1; }
        body {
            font-family: 'Segoe UI', Calibri, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1e293b;
        }
        .logo {
            text-align: center;
            margin-bottom: 24pt;
        }
        .logo img {
            max-width: 150px;
            height: auto;
        }
        h1 {
            font-size: 18pt;
            font-weight: bold;
            margin-top: 16pt;
            margin-bottom: 8pt;
            color: #1e293b;
            border-bottom: 1pt solid #e2e8f0;
            padding-bottom: 6pt;
        }
        h2 {
            font-size: 15pt;
            font-weight: bold;
            margin-top: 14pt;
            margin-bottom: 6pt;
            color: #334155;
        }
        h3 {
            font-size: 13pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 5pt;
            color: #475569;
        }
        h4 {
            font-size: 11.5pt;
            font-weight: bold;
            margin-top: 10pt;
            margin-bottom: 4pt;
            color: #64748b;
        }
        h5 {
            font-size: 11pt;
            font-weight: bold;
            font-style: italic;
            margin-top: 8pt;
            margin-bottom: 4pt;
            color: #64748b;
        }
        h6 {
            font-size: 10.5pt;
            font-weight: bold;
            margin-top: 8pt;
            margin-bottom: 3pt;
            color: #94a3b8;
        }
        p {
            margin: 6pt 0;
            text-align: justify;
            color: #1e293b;
        }
        strong { font-weight: bold; }
        em { font-style: italic; }
        u { text-decoration: underline; }
        del { text-decoration: line-through; color: #94a3b8; }
        ul, ol {
            margin: 6pt 0;
            padding-left: 22pt;
        }
        li {
            margin-bottom: 4pt;
            line-height: 1.5;
        }
        pre {
            font-family: 'Courier New', monospace;
            background-color: #f3f4f6;
            padding: 12pt;
            border: 1pt solid #d1d5db;
            border-radius: 4pt;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 9pt;
            color: #374151;
            margin: 8pt 0;
        }
        code {
            font-family: 'Courier New', monospace;
            background-color: #f0f0f0;
            padding: 1pt 3pt;
            border-radius: 2pt;
            font-size: 0.9em;
        }
        blockquote {
            margin: 8pt 0;
            padding: 8pt 12pt;
            border-left: 3pt solid #6366f1;
            background-color: #f8fafc;
            color: #475569;
            font-style: italic;
        }
        hr {
            border: none;
            border-top: 1pt solid #e2e8f0;
            margin: 12pt 0;
        }
    </style>
</head>
<body>
<div class="Section1">
`

    // Logo
    if (logoBase64) {
        htmlContent += `    <div class="logo">
        <img src="${logoBase64}" alt="Logo RPJ" width="150" style="display:block;margin:0 auto;" />
    </div>\n`
    }

    // Convertir secciones a HTML con formato inline preservado
    let inList = false
    let listType = ""

    for (const section of sections) {
        if (section.type === "heading") {
            if (inList) { htmlContent += `    </${listType}>\n`; inList = false }
            const level = Math.min(section.level || 1, 6)
            htmlContent += `    <h${level}>${inlineMarkdownToHtml(escapeHtml(section.content))}</h${level}>\n`
        } else if (section.type === "bullet" || section.type === "numbered") {
            const newListType = section.type === "numbered" ? "ol" : "ul"
            if (!inList) {
                htmlContent += `    <${newListType}>\n`
                inList = true
                listType = newListType
            } else if (listType !== newListType) {
                htmlContent += `    </${listType}>\n    <${newListType}>\n`
                listType = newListType
            }
            if (section.items) {
                for (const item of section.items) {
                    htmlContent += `        <li>${inlineMarkdownToHtml(escapeHtml(item))}</li>\n`
                }
            }
        } else if (section.type === "code") {
            if (inList) { htmlContent += `    </${listType}>\n`; inList = false }
            htmlContent += `    <pre>${escapeHtml(section.content)}</pre>\n`
        } else if (section.type === "blockquote") {
            if (inList) { htmlContent += `    </${listType}>\n`; inList = false }
            htmlContent += `    <blockquote><p>${inlineMarkdownToHtml(escapeHtml(section.content))}</p></blockquote>\n`
        } else if (section.type === "hr") {
            if (inList) { htmlContent += `    </${listType}>\n`; inList = false }
            htmlContent += `    <hr />\n`
        } else {
            if (inList) { htmlContent += `    </${listType}>\n`; inList = false }
            if (section.content) {
                htmlContent += `    <p>${inlineMarkdownToHtml(escapeHtml(section.content))}</p>\n`
            }
        }
    }

    if (inList) {
        htmlContent += `    </${listType}>\n`
    }

    htmlContent += `</div>\n</body>\n</html>`

    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const htmlBlob = new Blob([bom, htmlContent], {
        type: "application/msword;charset=utf-8",
    })

    const docFilename = filename.replace(".docx", ".doc")
    saveAs(htmlBlob, docFilename)
}

// Función para escapar HTML preservando caracteres especiales
function escapeHtml(text: string): string {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}


