// Rutas para manejo de archivos adjuntos (imágenes y PDFs)
import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import fileProcessorService from '../services/fileProcessorService.js';
import gemmaService from '../services/gemmaService.js';
import chromaService from '../services/chromaService.js';
import whisperService from '../services/whisperService.js';

const router = express.Router();

// Configurar multer para almacenar archivos en memoria
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se permiten imágenes (JPG, PNG) y PDFs.`));
        }
    },
});

// Configurar multer específico para audio
const audioUpload = multer({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25 MB para audio
    },
    fileFilter: (req, file, cb) => {
        const allowedAudioTypes = [
            'audio/webm',
            'audio/wav',
            'audio/mp3',
            'audio/mpeg',
            'audio/ogg',
            'audio/mp4',
            'audio/x-m4a',
        ];
        
        if (allowedAudioTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de audio no permitido: ${file.mimetype}`));
        }
    },
});
/**
 * POST /api/files/upload
 * Sube archivos, los procesa con OCR/PDF, los transcribe con Gemma
 * y los almacena en ChromaDB temporal
 */
router.post('/upload', authenticate, upload.array('files', 5), async (req, res) => {
    try {
        const { conversationId } = req.body;
        
        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'conversationId es requerido',
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se recibieron archivos',
            });
        }

        const processedFiles = [];
        const errors = [];

        console.log(`📂 Procesando ${req.files.length} archivo(s) para conversación ${conversationId}`);

        // Procesar cada archivo
        for (const file of req.files) {
            try {
                // 1. Extraer texto (OCR para imágenes, parse para PDFs)
                console.log(`⚙️ Procesando ${file.originalname}...`);
                const extracted = await fileProcessorService.processFile(
                    file.buffer,
                    file.originalname,
                    file.mimetype
                );

                if (!extracted.success) {
                    errors.push({
                        fileName: file.originalname,
                        message: extracted.error,
                    });
                    continue;
                }

                // 2. Transcribir y analizar con Gemma
                console.log(`🤖 Transcribiendo con Gemma: ${file.originalname}...`);
                const transcribed = await gemmaService.transcribeFileContent(
                    extracted.text,
                    file.originalname,
                    file.mimetype
                );

                processedFiles.push({
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    text: transcribed.transcripcion,
                    resumen: transcribed.resumen,
                    palabrasClave: transcribed.palabrasClave,
                    wordCount: extracted.wordCount,
                });

            } catch (error) {
                console.error(`❌ Error procesando ${file.originalname}:`, error.message);
                errors.push({
                    fileName: file.originalname,
                    message: error.message,
                });
            }
        }

        // 3. Guardar en ChromaDB temporal si hay archivos procesados
        if (processedFiles.length > 0) {
            console.log(`💾 Guardando ${processedFiles.length} archivo(s) en ChromaDB temporal...`);
            const saved = await chromaService.addToTemporaryCollection(
                conversationId,
                processedFiles
            );

            if (!saved) {
                console.warn('⚠️ No se pudieron guardar todos los archivos en ChromaDB');
            }
        }

        return res.json({
            success: true,
            files: processedFiles,
            errors,
            message: processedFiles.length > 0
                ? `${processedFiles.length} archivo(s) procesado(s) correctamente`
                : 'No se pudo procesar ningún archivo',
        });

    } catch (error) {
        console.error('❌ Error en /api/files/upload:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error al procesar archivos',
            error: error.message,
        });
    }
});

/**
 * GET /api/files/supported-formats
 * Retorna los formatos de archivo soportados
 */
router.get('/supported-formats', authenticate, (req, res) => {
    const formats = fileProcessorService.getSupportedFormats();
    
    res.json({
        formats,
        maxFileSize: '10 MB',
        maxFiles: 5,
        features: [
            'OCR para imágenes (español)',
            'Extracción de texto de PDFs',
            'Transcripción con IA (Gemma)',
            'Almacenamiento temporal en ChromaDB',
        ],
    });
});

/**
 * POST /api/files/transcribe
 * Transcribe audio a texto usando Whisper Large V3
 */
router.post('/transcribe', authenticate, audioUpload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de audio',
            });
        }

        console.log(`🎤 Transcribiendo audio: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);

        // Transcribir el audio
        const result = await whisperService.transcribeAudio(req.file.buffer);

        console.log(`✅ Audio transcrito: ${result.text.substring(0, 100)}...`);

        return res.json({
            success: true,
            text: result.text,
        });
    } catch (error) {
        console.error('❌ Error transcribiendo audio:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al transcribir el audio',
            message: error.message,
        });
    }
});

export default router;
