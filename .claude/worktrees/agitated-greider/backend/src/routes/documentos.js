import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';
import prismaPackage from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import chromaService from '../services/chromaService.js';

const { PrismaClient } = prismaPackage;
const PrismaEnums = prismaPackage.$Enums || {};
const EstadoProcesamiento = prismaPackage.EstadoProcesamiento || PrismaEnums.EstadoProcesamiento || {
    PENDIENTE: 'PENDIENTE',
    PROCESANDO: 'PROCESANDO',
    COMPLETADO: 'COMPLETADO',
    ERROR: 'ERROR',
};

const FALLBACK_ETIQUETAS = Object.freeze({
    PROGRAMACIONES: 'PROGRAMACIONES',
    DINAMICAS: 'DINAMICAS',
    CELEBRACIONES: 'CELEBRACIONES',
    ORACIONES: 'ORACIONES',
    CONSULTA: 'CONSULTA',
    PASTORAL_GENERICO: 'PASTORAL_GENERICO',
    REVISTAS: 'REVISTAS',
    CONTENIDO_MIXTO: 'CONTENIDO_MIXTO',
    OTROS: 'OTROS',
});

const EtiquetaDocumento = PrismaEnums.EtiquetaDocumento || FALLBACK_ETIQUETAS;

const prisma = new PrismaClient();
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = process.env.DOCUMENTS_STORAGE_PATH
    ? path.resolve(process.env.DOCUMENTS_STORAGE_PATH)
    : path.resolve(__dirname, '../../storage/documentos');

const CHROMA_DOCUMENT_COLLECTION = process.env.CHROMA_COLLECTION_DOCUMENTOS || 'rpjia-documentos';
const DEFAULT_MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;
const configuredMaxFileSize = Number.parseInt(
    process.env.DOCUMENTS_MAX_SIZE || `${DEFAULT_MAX_FILE_SIZE_BYTES}`,
    10,
);
const MAX_FILE_SIZE_BYTES = Number.isFinite(configuredMaxFileSize) && configuredMaxFileSize > 0
    ? Math.max(configuredMaxFileSize, DEFAULT_MAX_FILE_SIZE_BYTES)
    : DEFAULT_MAX_FILE_SIZE_BYTES;
const ALLOWED_MIME_TYPES = new Set(['application/pdf']);
const CHROMA_DOCUMENT_CHUNK_SIZE = parseInt(process.env.CHROMA_DOCUMENT_CHUNK_SIZE || '1500', 10);
const CHROMA_DOCUMENT_CHUNK_OVERLAP = parseInt(process.env.CHROMA_DOCUMENT_CHUNK_OVERLAP || '200', 10);
const CHROMA_DOCUMENT_MAX_CHUNKS = parseInt(process.env.CHROMA_DOCUMENT_MAX_CHUNKS || '200', 10);

const ETIQUETAS_DISPONIBLES = Object.values(EtiquetaDocumento);
const ETIQUETA_LABELS = {
    PROGRAMACIONES: 'Programaciones',
    DINAMICAS: 'Dinámicas',
    CELEBRACIONES: 'Celebraciones',
    ORACIONES: 'Oraciones',
    CONSULTA: 'Consulta',
    PASTORAL_GENERICO: 'Pastoral Genérico',
    REVISTAS: 'Revistas',
    CONTENIDO_MIXTO: 'Contenido mixto',
    OTROS: 'Otros',
};

let openaiClient = null;
function getOpenAIClient() {
    if (!process.env.OPENAI_API_KEY) {
        return null;
    }

    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    return openaiClient;
}

function sanitizeFilename(originalName) {
    const extension = path.extname(originalName) || '.pdf';
    const baseName = path.basename(originalName, extension);
    const safeBase = baseName
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .replace(/\s+/g, '-');

    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1e6);

    return `${safeBase || 'documento'}-${timestamp}-${randomSuffix}${extension}`;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(STORAGE_DIR, { recursive: true }, (err) => {
            cb(err, STORAGE_DIR);
        });
    },
    filename: (req, file, cb) => {
        cb(null, sanitizeFilename(file.originalname));
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(new Error('Solo se permiten archivos PDF')); // eslint-disable-line callback-return
            return;
        }
        cb(null, true);
    },
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
    },
});

function handleUpload(req, res, next) {
    upload.single('archivo')(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                const limitMb = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(1);
                res.status(413).json({
                    error: 'Archivo demasiado grande',
                    message: `El archivo supera el límite permitido de ${limitMb} MB`,
                });
                return;
            }

            res.status(400).json({
                error: 'Error al subir el archivo',
                message: `Error de carga (${error.code}). Intenta de nuevo o usa otro archivo`,
            });
            return;
        }

        res.status(400).json({
            error: 'Archivo inválido',
            message: error.message || 'No se pudo procesar el archivo subido',
        });
    });
}

function parseEtiquetas(rawEtiquetas) {
    if (!rawEtiquetas) return [];

    let etiquetas = [];

    if (Array.isArray(rawEtiquetas)) {
        etiquetas = rawEtiquetas;
    } else if (typeof rawEtiquetas === 'string') {
        try {
            const parsed = JSON.parse(rawEtiquetas);
            if (Array.isArray(parsed)) {
                etiquetas = parsed;
            } else {
                etiquetas = rawEtiquetas.split(',');
            }
        } catch (error) {
            etiquetas = rawEtiquetas.split(',');
        }
    }

    const uniqueValues = Array.from(
        new Set(
            etiquetas
                .map((etiqueta) => String(etiqueta).trim().toUpperCase())
                .filter((value) => ETIQUETAS_DISPONIBLES.includes(value)),
        ),
    );

    return uniqueValues;
}

function splitIntoChunks(text, chunkSize, overlap) {
    if (!text) return [];

    const safeChunkSize = Math.max(Number.isFinite(chunkSize) ? chunkSize : 1500, 1);
    const safeOverlap = Math.min(
        Math.max(Number.isFinite(overlap) ? overlap : 0, 0),
        safeChunkSize - 1,
    );

    const chunks = [];
    const length = text.length;
    let start = 0;

    while (start < length) {
        const end = Math.min(start + safeChunkSize, length);
        const fragment = text.slice(start, end).trim();
        if (fragment) {
            chunks.push(fragment);
        }

        if (end >= length) {
            break;
        }

        start = end - safeOverlap;
        if (start < 0) {
            start = 0;
        }
    }

    return chunks;
}

function mergeChunksToLimit(chunks, maxChunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        return { mergedChunks: [], mergeFactor: 1 };
    }

    const safeLimit = Math.max(Number.isFinite(maxChunks) ? maxChunks : 0, 0);

    if (safeLimit === 0 || chunks.length <= safeLimit) {
        return { mergedChunks: chunks, mergeFactor: 1 };
    }

    const mergeFactor = Math.ceil(chunks.length / safeLimit);
    const mergedChunks = [];

    for (let index = 0; index < chunks.length; index += mergeFactor) {
        const fragment = chunks.slice(index, index + mergeFactor).join('\n\n').trim();
        if (fragment) {
            mergedChunks.push(fragment);
        }
    }

    return {
        mergedChunks,
        mergeFactor,
    };
}

function sanitizeDocument(documento) {
    const etiquetas = Array.isArray(documento.etiquetas) ? documento.etiquetas : [];
    return {
        id: documento.id,
        titulo: documento.titulo,
        nombreOriginal: documento.nombreOriginal,
        rutaArchivo: documento.rutaArchivo,
        tamanoBytes: documento.tamanoBytes,
        tipoMime: documento.tipoMime,
        etiquetas,
        descripcionGenerada: documento.descripcionGenerada,
        estadoProcesamiento: documento.estadoProcesamiento,
        fechaCreacion: documento.fechaCreacion,
        fechaProcesamiento: documento.fechaProcesamiento,
        mensajeError: documento.mensajeError,
    };
}

async function generarDescripcion(titulo, etiquetas, contenido) {
    const texto = contenido.trim();
    const etiquetasLegibles = etiquetas
        .map((etiqueta) => ETIQUETA_LABELS[etiqueta] || etiqueta.toLowerCase())
        .join(', ');

    if (!texto) {
        return `Documento ${titulo} etiquetado como ${etiquetasLegibles || 'sin clasificar'}.`;
    }

    const openai = getOpenAIClient();

    if (openai) {
        try {
            const prompt = [
                'Genera un resumen breve (máximo 3 frases) en castellano para un documento destinado a monitores juveniles.',
                `Etiquetas: ${etiquetasLegibles || 'Sin etiquetas'}.`,
                'Contenido del documento:',
                texto.slice(0, 4000),
            ].join('\n');

            const completion = await openai.responses.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                input: prompt,
                max_output_tokens: 160,
            });

            const outputText = completion?.output?.[0]?.content?.[0]?.text;
            if (outputText) {
                return outputText.trim();
            }
        } catch (error) {
            console.warn('⚠️ No se pudo generar descripción con OpenAI:', error.message);
        }
    }

    const fallback = texto
        .replace(/\s+/g, ' ')
        .split('. ')
        .slice(0, 2)
        .join('. ')
        .trim();

    return fallback || `Documento ${titulo} etiquetado como ${etiquetasLegibles || 'sin clasificar'}.`;
}

async function procesarDocumento({ documento, titulo, etiquetas, filePath, fileBuffer, descripcionPersonalizada }) {
    const metadataBase = {
        tipo: 'documento',
        etiquetas: etiquetas.join(',') || null,
        etiquetas_json: JSON.stringify(etiquetas),
        titulo,
        fechaRegistro: new Date().toISOString(),
        documentoId: documento.id,
        nombreOriginal: documento.nombreOriginal,
        tamanoBytes: documento.tamanoBytes,
        tipoMime: documento.tipoMime,
    };

    let contenidoExtraido = '';

    try {
        const buffer = fileBuffer || (await fs.promises.readFile(filePath));
        const parsed = await pdfParse(buffer);
        contenidoExtraido = parsed.text || '';
    } catch (error) {
        throw new Error(`No se pudo extraer el contenido del PDF: ${error.message}`);
    }

    const contenidoNormalizado = contenidoExtraido
        .replace(/\u0000/g, '')
        .replace(/\r\n/g, '\n')
        .trim();

    if (!contenidoNormalizado) {
        throw new Error('El PDF no contiene texto legible para ser vectorizado');
    }
    
    // Usar descripción personalizada si se proporciona, sino generar una
    const descripcionGenerada = descripcionPersonalizada 
        ? descripcionPersonalizada.trim()
        : await generarDescripcion(titulo, etiquetas, contenidoNormalizado.slice(0, 8000));

    let vectorOk = false;
    let totalChunks = 0;
    let mergeFactor = 1;
    let originalChunkCount = 0;

    let chunks = splitIntoChunks(
        contenidoNormalizado,
        CHROMA_DOCUMENT_CHUNK_SIZE,
        CHROMA_DOCUMENT_CHUNK_OVERLAP,
    );

    originalChunkCount = chunks.length;

    if (chunks.length === 0) {
        throw new Error('No se pudieron generar fragmentos para el documento');
    }

    if (Number.isFinite(CHROMA_DOCUMENT_MAX_CHUNKS) && CHROMA_DOCUMENT_MAX_CHUNKS > 0 && chunks.length > CHROMA_DOCUMENT_MAX_CHUNKS) {
        const result = mergeChunksToLimit(chunks, CHROMA_DOCUMENT_MAX_CHUNKS);
        if (result.mergedChunks.length === 0) {
            throw new Error('No se pudieron compactar los fragmentos del documento');
        }

        console.warn(
            `⚠️ Documento ${documento.id} generó ${chunks.length} fragmentos. `
            + `Agrupando en ${result.mergedChunks.length} fragmentos (factor ${result.mergeFactor}).`,
        );

        chunks = result.mergedChunks;
        mergeFactor = result.mergeFactor;
    }

    totalChunks = chunks.length;

    const entries = chunks.map((chunk, index) => ({
        id: `${documento.id}#${index}`,
        document: chunk,
        metadata: {
            ...metadataBase,
            resumen: descripcionGenerada,
            chunkIndex: index,
            totalChunks,
            chunksOriginales: originalChunkCount || totalChunks,
            factorAgrupacion: mergeFactor,
            longitudCaracteres: chunk.length,
        },
    }));

    vectorOk = await chromaService.addDocuments(entries, CHROMA_DOCUMENT_COLLECTION);

    if (!vectorOk) {
        throw new Error('No se pudo vectorizar el documento en ChromaDB');
    }

    const actualizado = await prisma.documento.update({
        where: { id: documento.id },
        data: {
            descripcionGenerada,
            estadoProcesamiento: EstadoProcesamiento.COMPLETADO,
            mensajeError: null,
            fechaProcesamiento: new Date(),
            contenidoExtraido: contenidoNormalizado,
            vectorDocumentoId: vectorOk ? documento.id : null,
            coleccionVectorial: vectorOk ? CHROMA_DOCUMENT_COLLECTION : null,
        },
    });

    return actualizado;
}

router.get(
    '/etiquetas',
    authenticate,
    authorize(['DOCUMENTADOR', 'DOCUMENTADOR_JUNIOR']),
    async (req, res) => {
        const etiquetas = ETIQUETAS_DISPONIBLES.map((valor) => ({
            id: valor,
            label: ETIQUETA_LABELS[valor] || valor,
        }));

        return res.json({ etiquetas });
    },
);

router.get(
    '/',
    authenticate,
    authorize(['DOCUMENTADOR', 'DOCUMENTADOR_JUNIOR']),
    async (req, res) => {
        try {
            const documentos = await prisma.documento.findMany({
                orderBy: {
                    fechaCreacion: 'desc',
                },
            });

            return res.json({ documentos: documentos.map(sanitizeDocument) });
        } catch (error) {
            return res.status(500).json({
                error: 'Error listando documentos',
                message: error.message,
            });
        }
    },
);

router.post(
    '/',
    authenticate,
    authorize(['DOCUMENTADOR', 'DOCUMENTADOR_JUNIOR']),
    handleUpload,
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                error: 'Archivo requerido',
                message: 'Debes adjuntar un archivo PDF',
            });
        }

        const etiquetas = parseEtiquetas(req.body.etiquetas);
        if (etiquetas.length === 0) {
            return res.status(400).json({
                error: 'Etiquetas requeridas',
                message: 'Debes seleccionar al menos una etiqueta valida',
            });
        }

        const tituloOriginal = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : '';
        const tituloDocumento = tituloOriginal || path.basename(req.file.originalname, path.extname(req.file.originalname));
        const descripcionPersonalizada = typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : null;

        try {
            const documento = await prisma.documento.create({
                data: {
                    usuarioId: req.user.id,
                    titulo: tituloDocumento,
                    nombreOriginal: req.file.originalname,
                    rutaArchivo: path.resolve(req.file.path),
                    tamanoBytes: req.file.size,
                    tipoMime: req.file.mimetype,
                    estadoProcesamiento: EstadoProcesamiento.PROCESANDO,
                    etiquetas,
                },
            });

            try {
                const actualizado = await procesarDocumento({
                    documento,
                    titulo: tituloDocumento,
                    etiquetas,
                    filePath: req.file.path,
                    descripcionPersonalizada,
                });

                return res.status(201).json({
                    documento: sanitizeDocument(actualizado),
                });
            } catch (processingError) {
                const mensaje = processingError instanceof Error ? processingError.message : 'Error procesando el documento';

                await prisma.documento.update({
                    where: { id: documento.id },
                    data: {
                        estadoProcesamiento: EstadoProcesamiento.ERROR,
                        mensajeError: mensaje,
                        fechaProcesamiento: new Date(),
                    },
                });

                return res.status(500).json({
                    error: 'Error procesando documento',
                    message: mensaje,
                });
            }
        } catch (error) {
            return res.status(500).json({
                error: 'Error creando registro de documento',
                message: error.message,
            });
        }
    },
);

// PATCH /api/documentos/:id - Actualizar etiquetas, título y descripción de un documento
router.patch(
    '/:id',
    authenticate,
    authorize(['DOCUMENTADOR']),
    async (req, res) => {
        const { id } = req.params;
        const { etiquetas, titulo, descripcion } = req.body;

        // Validar que al menos se envíe un campo para actualizar
        if (!etiquetas && !titulo && descripcion === undefined) {
            return res.status(400).json({
                error: 'Datos inválidos',
                message: 'Debes proporcionar al menos un campo para actualizar (etiquetas, titulo o descripcion)',
            });
        }

        // Validar etiquetas si se envían
        let etiquetasValidas = null;
        if (etiquetas) {
            if (!Array.isArray(etiquetas) || etiquetas.length === 0) {
                return res.status(400).json({
                    error: 'Etiquetas inválidas',
                    message: 'Las etiquetas deben ser un array con al menos un elemento',
                });
            }
            
            etiquetasValidas = etiquetas.filter((tag) => ETIQUETAS_DISPONIBLES.includes(tag));
            if (etiquetasValidas.length === 0) {
                return res.status(400).json({
                    error: 'Etiquetas inválidas',
                    message: 'Ninguna de las etiquetas proporcionadas es válida',
                });
            }
        }

        // Validar título si se envía
        if (titulo !== undefined && typeof titulo !== 'string') {
            return res.status(400).json({
                error: 'Título inválido',
                message: 'El título debe ser una cadena de texto',
            });
        }

        if (titulo !== undefined && titulo.trim().length === 0) {
            return res.status(400).json({
                error: 'Título inválido',
                message: 'El título no puede estar vacío',
            });
        }

        try {
            const documento = await prisma.documento.findUnique({
                where: { id },
            });

            if (!documento) {
                return res.status(404).json({
                    error: 'Documento no encontrado',
                    message: 'El documento solicitado no existe',
                });
            }

            // Preparar datos para actualizar
            const dataToUpdate = {};
            if (etiquetasValidas) {
                dataToUpdate.etiquetas = etiquetasValidas;
            }
            if (titulo !== undefined) {
                dataToUpdate.titulo = titulo.trim();
            }
            if (descripcion !== undefined) {
                dataToUpdate.descripcionGenerada = descripcion ? descripcion.trim() : null;
            }

            const documentoActualizado = await prisma.documento.update({
                where: { id },
                data: dataToUpdate,
            });

            // Si el documento está completado, actualizar también en ChromaDB
            if (documento.estadoProcesamiento === EstadoProcesamiento.COMPLETADO) {
                try {
                    const collection = await chromaService.getOrCreateCollection(CHROMA_DOCUMENT_COLLECTION);
                    const chunks = await collection.get({
                        where: { document_id: id },
                    });

                    if (chunks?.ids?.length > 0) {
                        // Actualizar metadatos de todos los chunks
                        const updatedMetadatas = chunks.ids.map((_, index) => {
                            const currentMetadata = { ...chunks.metadatas[index] };
                            
                            if (etiquetasValidas) {
                                currentMetadata.etiquetas = etiquetasValidas;
                            }
                            if (titulo !== undefined) {
                                currentMetadata.titulo = titulo.trim();
                            }
                            if (descripcion !== undefined) {
                                currentMetadata.descripcion = descripcion ? descripcion.trim() : null;
                            }
                            
                            return currentMetadata;
                        });

                        await collection.update({
                            ids: chunks.ids,
                            metadatas: updatedMetadatas,
                        });
                    }
                } catch (chromaError) {
                    console.error('Error actualizando metadatos en ChromaDB:', chromaError);
                    // No fallar la petición si ChromaDB falla
                }
            }

            return res.json({
                documento: sanitizeDocument(documentoActualizado),
            });
        } catch (error) {
            console.error('Error actualizando documento:', error);
            return res.status(500).json({
                error: 'Error actualizando documento',
                message: error.message,
            });
        }
    },
);

// DELETE /api/documentos/:id - Eliminar un documento
router.delete(
    '/:id',
    authenticate,
    authorize(['DOCUMENTADOR']),
    async (req, res) => {
        const { id } = req.params;

        try {
            const documento = await prisma.documento.findUnique({
                where: { id },
            });

            if (!documento) {
                return res.status(404).json({
                    error: 'Documento no encontrado',
                    message: 'El documento solicitado no existe',
                });
            }

            // Eliminar de ChromaDB si está procesado
            if (documento.estadoProcesamiento === EstadoProcesamiento.COMPLETADO) {
                try {
                    const collection = await chromaService.getOrCreateCollection(CHROMA_DOCUMENT_COLLECTION);
                    const chunks = await collection.get({
                        where: { document_id: id },
                    });

                    if (chunks?.ids?.length > 0) {
                        await collection.delete({
                            ids: chunks.ids,
                        });
                    }
                } catch (chromaError) {
                    console.error('Error eliminando de ChromaDB:', chromaError);
                    // Continuar con la eliminación aunque ChromaDB falle
                }
            }

            // Eliminar archivo físico
            if (documento.rutaArchivo && fs.existsSync(documento.rutaArchivo)) {
                try {
                    fs.unlinkSync(documento.rutaArchivo);
                } catch (fsError) {
                    console.error('Error eliminando archivo físico:', fsError);
                    // Continuar con la eliminación del registro
                }
            }

            // Eliminar de la base de datos
            await prisma.documento.delete({
                where: { id },
            });

            return res.json({
                message: 'Documento eliminado correctamente',
            });
        } catch (error) {
            console.error('Error eliminando documento:', error);
            return res.status(500).json({
                error: 'Error eliminando documento',
                message: error.message,
            });
        }
    },
);

export { procesarDocumento };

export default router;
