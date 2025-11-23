// Servicio para procesar archivos adjuntos (imágenes y PDFs)
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Tipos de archivo soportados
const supportedTypes = {
    'image/jpeg': { extension: '.jpg', description: 'Imagen JPEG', processor: 'image' },
    'image/jpg': { extension: '.jpg', description: 'Imagen JPG', processor: 'image' },
    'image/png': { extension: '.png', description: 'Imagen PNG', processor: 'image' },
    'application/pdf': { extension: '.pdf', description: 'Documento PDF', processor: 'pdf' },
};

/**
 * Procesa un archivo y extrae su contenido
 * @param {Buffer} buffer - Buffer del archivo
 * @param {string} fileName - Nombre del archivo
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {Promise<Object>} - Resultado del procesamiento
 */
async function processFile(buffer, fileName, mimeType) {
    try {
        // Validar tamaño
        if (buffer.length > MAX_FILE_SIZE) {
            throw new Error(`El archivo ${fileName} excede el tamaño máximo permitido (10 MB)`);
        }

        // Validar tipo
        if (!supportedTypes[mimeType]) {
            throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
        }

        const typeInfo = supportedTypes[mimeType];
        let extractedText = '';

        // Procesar según el tipo
        if (typeInfo.processor === 'image') {
            extractedText = await extractTextFromImage(buffer, fileName);
        } else if (typeInfo.processor === 'pdf') {
            extractedText = await extractTextFromPDF(buffer);
        }

        const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;

        return {
            success: true,
            fileName,
            mimeType,
            size: buffer.length,
            text: extractedText,
            wordCount,
        };
    } catch (error) {
        console.error(`Error procesando archivo ${fileName}:`, error.message);
        return {
            success: false,
            fileName,
            error: error.message,
        };
    }
}

/**
 * Extrae texto de una imagen usando OCR (Tesseract)
 * @param {Buffer} buffer - Buffer de la imagen
 * @param {string} fileName - Nombre del archivo
 * @returns {Promise<string>} - Texto extraído
 */
async function extractTextFromImage(buffer, fileName) {
    try {
        console.log(`📷 Procesando imagen con OCR: ${fileName}`);
        
        // Optimizar imagen con sharp antes del OCR
        const optimizedBuffer = await sharp(buffer)
            .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
            .greyscale()
            .normalize()
            .toBuffer();

        // Ejecutar OCR con Tesseract
        const { data: { text } } = await Tesseract.recognize(
            optimizedBuffer,
            'spa', // Español
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR progreso: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );

        if (!text || text.trim().length === 0) {
            return `[Imagen sin texto reconocible: ${fileName}]`;
        }

        console.log(`✅ OCR completado: ${text.length} caracteres extraídos`);
        return text.trim();
    } catch (error) {
        console.error(`Error en OCR de ${fileName}:`, error.message);
        return `[Error al procesar imagen: ${fileName}]`;
    }
}

/**
 * Extrae texto de un PDF
 * @param {Buffer} buffer - Buffer del PDF
 * @returns {Promise<string>} - Texto extraído
 */
async function extractTextFromPDF(buffer) {
    try {
        console.log('📄 Extrayendo texto de PDF');
        
        const data = await pdfParse(buffer);
        
        if (!data.text || data.text.trim().length === 0) {
            return '[PDF sin texto extraíble]';
        }

        console.log(`✅ PDF procesado: ${data.numpages} páginas, ${data.text.length} caracteres`);
        return data.text.trim();
    } catch (error) {
        console.error('Error extrayendo texto de PDF:', error.message);
        return '[Error al procesar PDF]';
    }
}

/**
 * Retorna la lista de formatos soportados
 * @returns {Array} - Lista de formatos
 */
function getSupportedFormats() {
    return Object.entries(supportedTypes).map(([mimeType, info]) => ({
        mimeType,
        extension: info.extension,
        description: info.description,
    }));
}

/**
 * Verifica si un tipo MIME es soportado
 * @param {string} mimeType - Tipo MIME a verificar
 * @returns {boolean}
 */
function isFileSupported(mimeType) {
    return mimeType in supportedTypes;
}

export default {
    processFile,
    getSupportedFormats,
    isFileSupported,
};
