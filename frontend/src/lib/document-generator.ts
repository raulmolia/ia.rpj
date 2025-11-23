import { jsPDF } from "jspdf"
import { saveAs } from "file-saver"

// Función para parsear y limpiar texto de markdown
function cleanMarkdownText(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, "$1") // Eliminar negritas
        .replace(/\*(.+?)\*/g, "$1") // Eliminar cursivas
        .replace(/`(.+?)`/g, "$1") // Eliminar código inline
        .trim()
}

// Función para parsear markdown en secciones mejorada
function parseMarkdown(markdown: string): Array<{ type: string; content: string; level?: number; items?: string[] }> {
    const lines = markdown.split("\n")
    const sections: Array<{ type: string; content: string; level?: number; items?: string[] }> = []

    let inCodeBlock = false
    let codeBlockContent = ""
    let currentList: string[] = []
    let lastListType: "bullet" | "numbered" | null = null

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Manejar bloques de código
        if (line.trim().startsWith("```")) {
            // Guardar lista acumulada si existe
            if (currentList.length > 0) {
                sections.push({ type: lastListType || "bullet", content: "", items: [...currentList] })
                currentList = []
                lastListType = null
            }

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

        // Headers
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
        if (headerMatch) {
            // Guardar lista acumulada si existe
            if (currentList.length > 0) {
                sections.push({ type: lastListType || "bullet", content: "", items: [...currentList] })
                currentList = []
                lastListType = null
            }
            sections.push({ type: "heading", content: cleanMarkdownText(headerMatch[2]), level: headerMatch[1].length })
            continue
        }

        // Bullets
        const bulletMatch = line.match(/^\s*[-*+]\s+(.+)$/)
        if (bulletMatch) {
            if (lastListType !== "bullet" && currentList.length > 0) {
                sections.push({ type: lastListType || "bullet", content: "", items: [...currentList] })
                currentList = []
            }
            currentList.push(cleanMarkdownText(bulletMatch[1]))
            lastListType = "bullet"
            continue
        }

        // Numbered list
        const numberedMatch = line.match(/^\s*\d+\.\s+(.+)$/)
        if (numberedMatch) {
            if (lastListType !== "numbered" && currentList.length > 0) {
                sections.push({ type: lastListType || "bullet", content: "", items: [...currentList] })
                currentList = []
            }
            currentList.push(cleanMarkdownText(numberedMatch[1]))
            lastListType = "numbered"
            continue
        }

        // Si hay una lista acumulada y encontramos algo que no es lista, guardarla
        if (currentList.length > 0 && line.trim()) {
            sections.push({ type: lastListType || "bullet", content: "", items: [...currentList] })
            currentList = []
            lastListType = null
        }

        // Paragraph
        if (line.trim()) {
            sections.push({ type: "paragraph", content: cleanMarkdownText(line) })
        }
    }

    // Guardar lista final si existe
    if (currentList.length > 0) {
        sections.push({ type: lastListType || "bullet", content: "", items: [...currentList] })
    }

    // Guardar código final si existe
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

// Función para generar PDF mejorada
export async function downloadAsPDF(content: string, filename: string = "respuesta-ia.pdf") {
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

    // Añadir logo centrado
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

    // Parsear el markdown
    const sections = parseMarkdown(content)

    // Añadir contenido
    doc.setFont("helvetica")

    for (const section of sections) {
        // Verificar si necesitamos una nueva página
        if (yPosition > pageHeight - margin - 20) {
            doc.addPage()
            yPosition = margin
        }

        if (section.type === "heading") {
            // Headers
            const fontSize = section.level === 1 ? 16 : section.level === 2 ? 14 : 12
            doc.setFontSize(fontSize)
            doc.setFont("helvetica", "bold")
            const lines = doc.splitTextToSize(section.content, maxWidth)
            doc.text(lines, margin, yPosition)
            yPosition += lines.length * (fontSize * 0.4) + 8
            doc.setFont("helvetica", "normal")
        } else if (section.type === "bullet" || section.type === "numbered") {
            // Listas
            doc.setFontSize(11)
            if (section.items) {
                section.items.forEach((item, index) => {
                    const bullet = section.type === "numbered" ? `${index + 1}. ` : "• "
                    const itemText = bullet + item
                    const lines = doc.splitTextToSize(itemText, maxWidth - 5)
                    
                    // Verificar espacio para el item
                    if (yPosition + lines.length * 5 > pageHeight - margin) {
                        doc.addPage()
                        yPosition = margin
                    }
                    
                    doc.text(lines, margin + 5, yPosition)
                    yPosition += lines.length * 5 + 2
                })
                yPosition += 3 // Espacio después de la lista
            }
        } else if (section.type === "code") {
            // Code blocks
            doc.setFontSize(9)
            doc.setFont("courier")
            doc.setFillColor(245, 245, 245)
            const codeLines = section.content.split("\n")
            const lineHeight = 5

            // Calcular altura del bloque
            const blockHeight = codeLines.length * lineHeight + 4

            // Verificar si cabe en la página
            if (yPosition + blockHeight > pageHeight - margin) {
                doc.addPage()
                yPosition = margin
            }

            // Dibujar fondo
            doc.rect(margin, yPosition - 2, maxWidth, blockHeight, "F")

            // Añadir texto
            for (const codeLine of codeLines) {
                doc.text(codeLine, margin + 2, yPosition + 2)
                yPosition += lineHeight
            }

            yPosition += 8
            doc.setFont("helvetica", "normal")
        } else {
            // Paragraphs
            doc.setFontSize(11)
            if (section.content) {
                const lines = doc.splitTextToSize(section.content, maxWidth)
                
                // Verificar espacio
                if (yPosition + lines.length * 5 > pageHeight - margin) {
                    doc.addPage()
                    yPosition = margin
                }
                
                doc.text(lines, margin, yPosition)
                yPosition += lines.length * 5 + 3
            }
        }
    }

    // Descargar el PDF
    doc.save(filename)
}

// Función para generar Word mejorada
export async function downloadAsWord(content: string, filename: string = "respuesta.docx"): Promise<void> {
    // Cargar el logo
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

    // Parsear el markdown
    const sections = parseMarkdown(content)

    // Crear HTML con namespace de Word y codificación correcta
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
        div.Section1 {
            page: Section1;
        }
        body {
            font-family: Calibri, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
        }
        .logo {
            text-align: center;
            margin-bottom: 20pt;
        }
        .logo img {
            max-width: 150px;
            height: auto;
        }
        h1 {
            font-size: 16pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 6pt;
            color: #000000;
        }
        h2 {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 10pt;
            margin-bottom: 5pt;
            color: #000000;
        }
        h3 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 8pt;
            margin-bottom: 4pt;
            color: #000000;
        }
        p {
            margin: 6pt 0;
            text-align: justify;
        }
        ul, ol {
            margin: 6pt 0;
            padding-left: 20pt;
        }
        li {
            margin-bottom: 3pt;
        }
        pre {
            font-family: 'Courier New', monospace;
            background-color: #f5f5f5;
            padding: 10pt;
            border: 1pt solid #dddddd;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 9pt;
            margin: 6pt 0;
        }
    </style>
</head>
<body>
<div class="Section1">
`

    // Añadir logo si existe
    if (logoBase64) {
        htmlContent += `
    <div class="logo">
        <img src="${logoBase64}" alt="Logo RPJ" width="150" height="auto" style="display:block;margin:0 auto;" />
    </div>
`
    }

    // Convertir secciones a HTML
    let inList = false
    let listType = ""

    for (const section of sections) {
        if (section.type === "heading") {
            if (inList) {
                htmlContent += `</${listType}>\n`
                inList = false
            }
            const level = section.level || 1
            htmlContent += `    <h${level}>${escapeHtml(section.content)}</h${level}>\n`
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
                section.items.forEach((item) => {
                    htmlContent += `        <li>${escapeHtml(item)}</li>\n`
                })
            }
        } else if (section.type === "code") {
            if (inList) {
                htmlContent += `    </${listType}>\n`
                inList = false
            }
            htmlContent += `    <pre>${escapeHtml(section.content)}</pre>\n`
        } else {
            if (inList) {
                htmlContent += `    </${listType}>\n`
                inList = false
            }
            if (section.content) {
                htmlContent += `    <p>${escapeHtml(section.content)}</p>\n`
            }
        }
    }

    // Cerrar lista si quedó abierta
    if (inList) {
        htmlContent += `    </${listType}>\n`
    }

    htmlContent += `
</div>
</body>
</html>`

    // Crear blob con tipo MIME correcto para Word y BOM UTF-8
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const htmlBlob = new Blob([bom, htmlContent], {
        type: "application/msword;charset=utf-8",
    })

    // Descargar con extensión .doc
    const docFilename = filename.replace(".docx", ".doc")
    saveAs(htmlBlob, docFilename)
}

// Función para escapar HTML y preservar caracteres especiales
function escapeHtml(text: string): string {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}


