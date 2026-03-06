// Rutas para gestión de fuentes web
// Permite agregar, listar, procesar y eliminar URLs web como fuentes de información

import express from 'express';
import prismaPackage from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import webScraperService from '../services/webScraperService.js';
import chromaService from '../services/chromaService.js';

const { PrismaClient } = prismaPackage;
const PrismaEnums = prismaPackage.$Enums || {};

const EstadoProcesamiento = PrismaEnums.EstadoProcesamiento || {
    PENDIENTE: 'PENDIENTE',
    PROCESANDO: 'PROCESANDO',
    COMPLETADO: 'COMPLETADO',
    ERROR: 'ERROR',
};

const TipoFuenteWeb = PrismaEnums.TipoFuenteWeb || {
    PAGINA: 'PAGINA',
    DOMINIO: 'DOMINIO',
    SITEMAP: 'SITEMAP',
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

const router = express.Router();
const prisma = new PrismaClient();

const CHROMA_WEB_COLLECTION = process.env.CHROMA_COLLECTION_WEB || 'rpjia-fuentes-web';
const WEB_CHUNK_SIZE = parseInt(process.env.WEB_CHUNK_SIZE || '1500', 10);
const WEB_CHUNK_OVERLAP = parseInt(process.env.WEB_CHUNK_OVERLAP || '200', 10);
const WEB_MAX_CHUNKS = parseInt(process.env.WEB_MAX_CHUNKS || '200', 10);

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

function sanitizeFuenteWeb(fuente) {
    const etiquetas = Array.isArray(fuente.etiquetas) ? fuente.etiquetas : [];

    return {
        id: fuente.id,
        url: fuente.url,
        dominio: fuente.dominio,
        titulo: fuente.titulo,
        descripcion: fuente.descripcion,
        etiquetas: etiquetas,
        tipoFuente: fuente.tipoFuente,
        estadoProcesamiento: fuente.estadoProcesamiento,
        mensajeError: fuente.mensajeError,
        activa: fuente.activa,
        fechaCreacion: fuente.fechaCreacion,
        fechaProcesamiento: fuente.fechaProcesamiento,
    };
}

function parseEtiquetas(rawEtiquetas) {
    if (!rawEtiquetas) return [];

    let etiquetasArray = [];

    if (typeof rawEtiquetas === 'string') {
        try {
            etiquetasArray = JSON.parse(rawEtiquetas);
        } catch {
            etiquetasArray = rawEtiquetas
                .split(',')
                .map((tag) => tag.trim().toUpperCase())
                .filter((tag) => tag.length > 0);
        }
    } else if (Array.isArray(rawEtiquetas)) {
        etiquetasArray = rawEtiquetas;
    }

    return etiquetasArray
        .map((tag) => String(tag).trim().toUpperCase())
        .filter((tag) => ETIQUETAS_DISPONIBLES.includes(tag));
}

function splitIntoChunks(text, chunkSize, overlap) {
    const chunks = [];
    const length = text.length;
    const safeChunkSize = Math.max(Number.isFinite(chunkSize) ? chunkSize : WEB_CHUNK_SIZE, 100);
    const safeOverlap = Math.max(Math.min(Number.isFinite(overlap) ? overlap : WEB_CHUNK_OVERLAP, safeChunkSize - 1), 0);

    let start = 0;

    while (start < length) {
        const end = Math.min(start + safeChunkSize, length);
        const fragment = text.slice(start, end).trim();
        if (fragment) {
            chunks.push(fragment);
        }

        if (end >= length) break;

        start = end - safeOverlap;
        if (start < 0) start = 0;
    }

    return chunks;
}

// Helper para convertir chunks + metadata + ids al formato esperado por chromaService
function convertToChromaEntries(chunks, metadatas, ids) {
    return chunks.map((chunk, index) => ({
        id: ids[index],
        document: chunk,
        metadata: metadatas[index],
    }));
}

async function procesarFuenteWeb({ fuenteWeb, etiquetas }) {
    const metadataBase = {
        tipo: 'fuente_web',
        etiquetas: etiquetas.join(',') || null,
        etiquetas_json: JSON.stringify(etiquetas),
        url: fuenteWeb.url,
        dominio: fuenteWeb.dominio,
        titulo: fuenteWeb.titulo || '',
        fechaRegistro: new Date().toISOString(),
        fuenteWebId: fuenteWeb.id,
    };

    try {
        await prisma.fuenteWeb.update({
            where: { id: fuenteWeb.id },
            data: { estadoProcesamiento: EstadoProcesamiento.PROCESANDO },
        });

        let scrapeResult;

        // Procesar según el tipo de fuente
        if (fuenteWeb.tipoFuente === TipoFuenteWeb.PAGINA) {
            scrapeResult = await webScraperService.scrapePage(fuenteWeb.url);
            
            if (!scrapeResult.success) {
                throw new Error(scrapeResult.error || 'Error desconocido al scraping la página');
            }
            if (!scrapeResult.content || scrapeResult.content.trim().length === 0) {
                throw new Error('No se pudo extraer contenido utilizable de la página');
            }

            // Vectorizar el contenido de la página
            const chunks = splitIntoChunks(scrapeResult.content, WEB_CHUNK_SIZE, WEB_CHUNK_OVERLAP);
            const limitedChunks = chunks.slice(0, WEB_MAX_CHUNKS);

            if (limitedChunks.length === 0) {
                throw new Error('La página no generó fragmentos para vectorizar');
            }

            const metadata = {
                ...metadataBase,
                descripcion: scrapeResult.description || '',
                wordCount: scrapeResult.wordCount,
            };

            const entries = convertToChromaEntries(
                limitedChunks,
                Array(limitedChunks.length).fill(metadata),
                limitedChunks.map((_, index) => `${fuenteWeb.id}_chunk_${index}`)
            );

            const addResult = await chromaService.addDocuments(entries, CHROMA_WEB_COLLECTION);

            if (!addResult) {
                throw new Error(`Error vectorizando página ${fuenteWeb.url}`);
            }

            console.log(`✅ Vectorizados ${limitedChunks.length} chunks de ${fuenteWeb.url}`);

            await prisma.fuenteWeb.update({
                where: { id: fuenteWeb.id },
                data: {
                    titulo: scrapeResult.title || fuenteWeb.titulo,
                    descripcion: scrapeResult.description || fuenteWeb.descripcion,
                    contenidoExtraido: scrapeResult.content.slice(0, 50000),
                    estadoProcesamiento: EstadoProcesamiento.COMPLETADO,
                    fechaProcesamiento: new Date(),
                    vectorDocumentoId: fuenteWeb.id,
                    coleccionVectorial: CHROMA_WEB_COLLECTION,
                },
            });

        } else if (fuenteWeb.tipoFuente === TipoFuenteWeb.DOMINIO) {
            scrapeResult = await webScraperService.scrapeDomain(fuenteWeb.url);

            const successfulPages = scrapeResult.pages.filter(p => p.success);
            if (successfulPages.length === 0) {
                throw new Error('No se pudo extraer contenido utilizable del dominio');
            }
            let totalChunks = 0;

            for (const page of successfulPages) {
                const chunks = splitIntoChunks(page.content, WEB_CHUNK_SIZE, WEB_CHUNK_OVERLAP);
                const limitedChunks = chunks.slice(0, Math.floor(WEB_MAX_CHUNKS / successfulPages.length));

                if (limitedChunks.length === 0) {
                    console.warn(`⚠️ Página ${page.url} no generó fragmentos utilizable, se omite`);
                    continue;
                }

                const pageMetadata = {
                    ...metadataBase,
                    pagina_url: page.url,
                    pagina_titulo: page.title,
                    pagina_descripcion: page.description,
                };

                const entries = convertToChromaEntries(
                    limitedChunks,
                    Array(limitedChunks.length).fill(pageMetadata),
                    limitedChunks.map((_, index) => `${fuenteWeb.id}_${totalChunks + index}`)
                );

                const addResult = await chromaService.addDocuments(entries, CHROMA_WEB_COLLECTION);

                if (!addResult) {
                    throw new Error(`Error vectorizando página ${page.url}`);
                }

                console.log(`✅ Vectorizados ${limitedChunks.length} chunks de ${page.url}`);

                totalChunks += limitedChunks.length;
            }

            if (totalChunks === 0) {
                throw new Error('El dominio no generó contenido vectorizable');
            }

            const combinedContent = successfulPages
                .map(p => `${p.title}\n${p.content}`)
                .join('\n\n')
                .slice(0, 50000);

            await prisma.fuenteWeb.update({
                where: { id: fuenteWeb.id },
                data: {
                    titulo: `Dominio: ${scrapeResult.domain}`,
                    descripcion: `${scrapeResult.successfulPages} páginas procesadas`,
                    contenidoExtraido: combinedContent,
                    estadoProcesamiento: EstadoProcesamiento.COMPLETADO,
                    fechaProcesamiento: new Date(),
                    vectorDocumentoId: fuenteWeb.id,
                    coleccionVectorial: CHROMA_WEB_COLLECTION,
                },
            });

        } else if (fuenteWeb.tipoFuente === TipoFuenteWeb.SITEMAP) {
            scrapeResult = await webScraperService.scrapeSitemap(fuenteWeb.url);

            const successfulPages = scrapeResult.pages.filter(p => p.success);
            if (successfulPages.length === 0) {
                throw new Error('No se pudo extraer contenido utilizable del sitemap');
            }
            let totalChunks = 0;

            for (const page of successfulPages) {
                const chunks = splitIntoChunks(page.content, WEB_CHUNK_SIZE, WEB_CHUNK_OVERLAP);
                const limitedChunks = chunks.slice(0, Math.floor(WEB_MAX_CHUNKS / successfulPages.length));

                if (limitedChunks.length === 0) {
                    console.warn(`⚠️ Página ${page.url} del sitemap no generó fragmentos utilizable, se omite`);
                    continue;
                }

                const pageMetadata = {
                    ...metadataBase,
                    pagina_url: page.url,
                    pagina_titulo: page.title,
                    pagina_descripcion: page.description,
                };

                const entries = convertToChromaEntries(
                    limitedChunks,
                    Array(limitedChunks.length).fill(pageMetadata),
                    limitedChunks.map((_, index) => `${fuenteWeb.id}_${totalChunks + index}`)
                );

                const addResult = await chromaService.addDocuments(entries, CHROMA_WEB_COLLECTION);

                if (!addResult) {
                    throw new Error(`Error vectorizando página ${page.url}`);
                }

                console.log(`✅ Vectorizados ${limitedChunks.length} chunks de ${page.url}`);

                totalChunks += limitedChunks.length;
            }

            if (totalChunks === 0) {
                throw new Error('El sitemap no generó contenido vectorizable');
            }

            const combinedContent = successfulPages
                .map(p => `${p.title}\n${p.content}`)
                .join('\n\n')
                .slice(0, 50000);

            await prisma.fuenteWeb.update({
                where: { id: fuenteWeb.id },
                data: {
                    titulo: `Sitemap: ${fuenteWeb.dominio}`,
                    descripcion: `${scrapeResult.successfulPages} páginas procesadas`,
                    contenidoExtraido: combinedContent,
                    estadoProcesamiento: EstadoProcesamiento.COMPLETADO,
                    fechaProcesamiento: new Date(),
                    vectorDocumentoId: fuenteWeb.id,
                    coleccionVectorial: CHROMA_WEB_COLLECTION,
                },
            });
        }

        console.log(`✅ Fuente web procesada: ${fuenteWeb.url}`);

    } catch (error) {
        console.error(`❌ Error procesando fuente web ${fuenteWeb.url}:`, error);

        await prisma.fuenteWeb.update({
            where: { id: fuenteWeb.id },
            data: {
                estadoProcesamiento: EstadoProcesamiento.ERROR,
                mensajeError: error.message,
            },
        });

        throw error;
    }
}

// GET /api/fuentes-web/etiquetas
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
    }
);

// GET /api/fuentes-web
router.get(
    '/',
    authenticate,
    authorize(['DOCUMENTADOR', 'DOCUMENTADOR_JUNIOR']),
    async (req, res) => {
        try {
            const fuentes = await prisma.fuenteWeb.findMany({
                where: { activa: true },
                orderBy: { fechaCreacion: 'desc' },
            });

            return res.json({ fuentes: fuentes.map(sanitizeFuenteWeb) });
        } catch (error) {
            return res.status(500).json({
                error: 'Error listando fuentes web',
                message: error.message,
            });
        }
    }
);

// POST /api/fuentes-web
router.post(
    '/',
    authenticate,
    authorize(['DOCUMENTADOR', 'DOCUMENTADOR_JUNIOR']),
    async (req, res) => {
        const { url, etiquetas: rawEtiquetas, tipoFuente, descripcion } = req.body || {};

        if (!url) {
            return res.status(400).json({
                error: 'URL requerida',
                message: 'Debes proporcionar una URL válida',
            });
        }

        try {
            const dominio = webScraperService.extractDomain(url);
            const normalizedUrl = webScraperService.normalizeUrl(url);

            const etiquetas = parseEtiquetas(rawEtiquetas);

            const tipo = TipoFuenteWeb[tipoFuente?.toUpperCase()] || TipoFuenteWeb.PAGINA;

            const fuenteWeb = await prisma.fuenteWeb.create({
                data: {
                    usuarioId: req.user.id,
                    url: normalizedUrl,
                    dominio: dominio,
                    descripcion: descripcion || null,
                    etiquetas: etiquetas,
                    tipoFuente: tipo,
                    estadoProcesamiento: EstadoProcesamiento.PENDIENTE,
                },
            });

            // Procesar en background
            procesarFuenteWeb({ fuenteWeb, etiquetas }).catch((error) => {
                console.error('Error procesando fuente web en background:', error);
            });

            return res.status(201).json({
                message: 'Fuente web agregada, procesando...',
                fuente: sanitizeFuenteWeb(fuenteWeb),
            });

        } catch (error) {
            return res.status(500).json({
                error: 'Error agregando fuente web',
                message: error.message,
            });
        }
    }
);

// PATCH /api/fuentes-web/:id
router.patch(
    '/:id',
    authenticate,
    authorize(['DOCUMENTADOR']),
    async (req, res) => {
        const { id } = req.params;
        const { etiquetas: rawEtiquetas, descripcion, activa } = req.body || {};

        try {
            const fuenteWeb = await prisma.fuenteWeb.findUnique({ where: { id } });

            if (!fuenteWeb) {
                return res.status(404).json({
                    error: 'Fuente web no encontrada',
                });
            }

            const updateData = {};

            if (rawEtiquetas !== undefined) {
                const etiquetas = parseEtiquetas(rawEtiquetas);
                updateData.etiquetas = etiquetas;

                // Actualizar metadatos en ChromaDB si está vectorizado
                if (fuenteWeb.vectorDocumentoId && fuenteWeb.coleccionVectorial) {
                    try {
                        // Aquí podrías actualizar los metadatos en ChromaDB
                        // Por ahora solo actualizamos en BD
                    } catch (error) {
                        console.warn('Error actualizando metadatos en ChromaDB:', error.message);
                    }
                }
            }

            if (descripcion !== undefined) {
                updateData.descripcion = descripcion;
            }

            if (activa !== undefined) {
                updateData.activa = Boolean(activa);
            }

            const fuenteActualizada = await prisma.fuenteWeb.update({
                where: { id },
                data: updateData,
            });

            return res.json({
                message: 'Fuente web actualizada',
                fuente: sanitizeFuenteWeb(fuenteActualizada),
            });

        } catch (error) {
            return res.status(500).json({
                error: 'Error actualizando fuente web',
                message: error.message,
            });
        }
    }
);

// DELETE /api/fuentes-web/:id
router.delete(
    '/:id',
    authenticate,
    authorize(['DOCUMENTADOR']),
    async (req, res) => {
        const { id } = req.params;

        try {
            const fuenteWeb = await prisma.fuenteWeb.findUnique({ where: { id } });

            if (!fuenteWeb) {
                return res.status(404).json({
                    error: 'Fuente web no encontrada',
                });
            }

            // Eliminar de ChromaDB si está vectorizado
            if (fuenteWeb.vectorDocumentoId && fuenteWeb.coleccionVectorial) {
                try {
                    // Eliminar documentos con este ID
                    // ChromaDB eliminará por prefijo del ID
                    await chromaService.deleteDocuments(
                        fuenteWeb.coleccionVectorial,
                        [fuenteWeb.vectorDocumentoId]
                    );
                } catch (error) {
                    console.warn('Error eliminando de ChromaDB:', error.message);
                }
            }

            await prisma.fuenteWeb.delete({ where: { id } });

            return res.json({
                message: 'Fuente web eliminada correctamente',
            });

        } catch (error) {
            return res.status(500).json({
                error: 'Error eliminando fuente web',
                message: error.message,
            });
        }
    }
);

// POST /api/fuentes-web/:id/reprocesar
router.post(
    '/:id/reprocesar',
    authenticate,
    authorize(['DOCUMENTADOR']),
    async (req, res) => {
        const { id } = req.params;

        try {
            const fuenteWeb = await prisma.fuenteWeb.findUnique({ where: { id } });

            if (!fuenteWeb) {
                return res.status(404).json({
                    error: 'Fuente web no encontrada',
                });
            }

            // Eliminar vectorización anterior si existe
            if (fuenteWeb.vectorDocumentoId && fuenteWeb.coleccionVectorial) {
                try {
                    await chromaService.deleteDocuments(
                        fuenteWeb.coleccionVectorial,
                        [fuenteWeb.vectorDocumentoId]
                    );
                } catch (error) {
                    console.warn('Error eliminando vectorización anterior:', error.message);
                }
            }

            // Resetear estado
            await prisma.fuenteWeb.update({
                where: { id },
                data: {
                    estadoProcesamiento: EstadoProcesamiento.PENDIENTE,
                    mensajeError: null,
                    fechaProcesamiento: null,
                    contenidoExtraido: null,
                    vectorDocumentoId: null,
                },
            });

            const etiquetas = Array.isArray(fuenteWeb.etiquetas) ? fuenteWeb.etiquetas : [];

            // Reprocesar en background
            procesarFuenteWeb({ fuenteWeb, etiquetas }).catch((error) => {
                console.error('Error reprocesando fuente web:', error);
            });

            return res.json({
                message: 'Fuente web reprocesándose...',
                fuente: sanitizeFuenteWeb(fuenteWeb),
            });

        } catch (error) {
            return res.status(500).json({
                error: 'Error reprocesando fuente web',
                message: error.message,
            });
        }
    }
);

export default router;
