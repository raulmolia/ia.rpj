// Servicio de actualización automática de fuentes web
// Se ejecuta cada 24 horas para detectar y añadir nuevo contenido
import { PrismaClient } from '@prisma/client';
import chromaService from '../src/services/chromaService.js';
import webScraperService from '../src/services/webScraperService.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();

const WEB_CHUNK_SIZE = Number(process.env.WEB_CHUNK_SIZE) || 1500;
const WEB_CHUNK_OVERLAP = Number(process.env.WEB_CHUNK_OVERLAP) || 200;
const WEB_MAX_CHUNKS = Number(process.env.WEB_MAX_CHUNKS) || 200;
const CHROMA_WEB_COLLECTION = 'rpjia-fuentes-web';

const TipoFuenteWeb = {
    PAGINA: 'PAGINA',
    DOMINIO: 'DOMINIO',
    SITEMAP: 'SITEMAP',
};

function splitIntoChunks(text, maxSize, overlap) {
    if (!text || text.length === 0) {
        return [];
    }

    const chunks = [];
    const safeMaxSize = Math.max(maxSize, 100);
    const safeOverlap = Math.min(overlap, Math.floor(safeMaxSize / 2));
    const length = text.length;
    let start = 0;

    while (start < length) {
        let end = start + safeMaxSize;
        if (end >= length) {
            end = length;
        }

        const fragment = text.substring(start, end);
        if (fragment.trim().length > 0) {
            chunks.push(fragment);
        }

        if (end >= length) break;

        start = end - safeOverlap;
        if (start < 0) start = 0;
    }

    return chunks;
}

function convertToChromaEntries(chunks, metadatas, ids) {
    return chunks.map((chunk, index) => ({
        id: ids[index],
        document: chunk,
        metadata: metadatas[index],
    }));
}

// Genera un hash del contenido para detectar cambios
function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

// Obtiene los IDs de documentos existentes en ChromaDB para una fuente
async function getExistingDocumentIds(fuenteId) {
    try {
        const collection = await chromaService.getOrCreateCollection(CHROMA_WEB_COLLECTION);
        const result = await collection.get({
            where: { fuenteWebId: fuenteId }
        });
        return new Set(result.ids || []);
    } catch (error) {
        console.error(`Error obteniendo IDs existentes para ${fuenteId}:`, error.message);
        return new Set();
    }
}

async function actualizarFuentePagina(fuenteWeb, etiquetas) {
    console.log(`📄 Actualizando PAGINA: ${fuenteWeb.url}`);

    const scrapeResult = await webScraperService.scrapePage(fuenteWeb.url);
    
    if (!scrapeResult.success) {
        throw new Error(scrapeResult.error || 'Error al scrapear la página');
    }

    // Verificar si el contenido ha cambiado
    const newContentHash = hashContent(scrapeResult.content);
    const oldContent = fuenteWeb.contenidoExtraido || '';
    const oldContentHash = hashContent(oldContent);

    if (newContentHash === oldContentHash) {
        console.log('   ℹ️  Sin cambios en el contenido');
        await prisma.fuenteWeb.update({
            where: { id: fuenteWeb.id },
            data: { fechaUltimaActualizacion: new Date() },
        });
        return { updated: false, newChunks: 0 };
    }

    console.log('   🆕 Contenido modificado, actualizando...');

    const metadataBase = {
        tipo: 'fuente_web',
        etiquetas: etiquetas.join(',') || null,
        etiquetas_json: JSON.stringify(etiquetas),
        url: fuenteWeb.url,
        dominio: fuenteWeb.dominio,
        titulo: scrapeResult.title || fuenteWeb.titulo,
        fechaRegistro: fuenteWeb.fechaCreacion.toISOString(),
        fuenteWebId: fuenteWeb.id,
    };

    // Eliminar chunks antiguos de ChromaDB
    const existingIds = await getExistingDocumentIds(fuenteWeb.id);
    if (existingIds.size > 0) {
        console.log(`   🗑️  Eliminando ${existingIds.size} chunks antiguos`);
        const collection = await chromaService.getOrCreateCollection(CHROMA_WEB_COLLECTION);
        await collection.delete({ ids: Array.from(existingIds) });
    }

    // Añadir nuevo contenido
    const chunks = splitIntoChunks(scrapeResult.content, WEB_CHUNK_SIZE, WEB_CHUNK_OVERLAP);
    const limitedChunks = chunks.slice(0, WEB_MAX_CHUNKS);

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
        throw new Error('Error vectorizando contenido actualizado');
    }

    console.log(`   ✅ ${limitedChunks.length} chunks vectorizados`);

    await prisma.fuenteWeb.update({
        where: { id: fuenteWeb.id },
        data: {
            titulo: scrapeResult.title || fuenteWeb.titulo,
            descripcion: scrapeResult.description || fuenteWeb.descripcion,
            contenidoExtraido: scrapeResult.content.slice(0, 50000),
            fechaUltimaActualizacion: new Date(),
        },
    });

    return { updated: true, newChunks: limitedChunks.length };
}

async function actualizarFuenteDominio(fuenteWeb, etiquetas) {
    console.log(`🌐 Actualizando DOMINIO: ${fuenteWeb.url}`);

    const scrapeResult = await webScraperService.scrapeDomain(fuenteWeb.url);
    const successfulPages = scrapeResult.pages.filter(p => p.success);

    console.log(`   📊 ${successfulPages.length} páginas scrapeadas`);

    // Obtener IDs existentes
    const existingIds = await getExistingDocumentIds(fuenteWeb.id);
    const newIds = new Set();
    let newChunksCount = 0;
    let updatedPagesCount = 0;

    const metadataBase = {
        tipo: 'fuente_web',
        etiquetas: etiquetas.join(',') || null,
        etiquetas_json: JSON.stringify(etiquetas),
        url: fuenteWeb.url,
        dominio: fuenteWeb.dominio,
        titulo: fuenteWeb.titulo || '',
        fechaRegistro: fuenteWeb.fechaCreacion.toISOString(),
        fuenteWebId: fuenteWeb.id,
    };

    for (const page of successfulPages) {
        // Generar ID base para esta página
        const pageHash = hashContent(page.url);
        const pageBaseId = `${fuenteWeb.id}_${pageHash}`;

        // Verificar si esta URL ya existe
        const pageExistingIds = Array.from(existingIds).filter(id => id.startsWith(pageBaseId));
        
        // Si ya existe, verificar si el contenido cambió
        if (pageExistingIds.length > 0) {
            // Para verificar cambios, necesitaríamos almacenar hashes
            // Por simplicidad, asumimos que si existe, puede haber cambiado
            // En producción, podrías mantener una tabla de hashes por URL
            
            // Eliminar chunks antiguos de esta página
            const collection = await chromaService.getOrCreateCollection(CHROMA_WEB_COLLECTION);
            await collection.delete({ ids: pageExistingIds });
            updatedPagesCount++;
        }

        const chunks = splitIntoChunks(page.content, WEB_CHUNK_SIZE, WEB_CHUNK_OVERLAP);
        const limitedChunks = chunks.slice(0, Math.floor(WEB_MAX_CHUNKS / Math.max(successfulPages.length, 1)));

        const pageMetadata = {
            ...metadataBase,
            pagina_url: page.url,
            pagina_titulo: page.title,
            pagina_descripcion: page.description,
        };

        const chunkIds = limitedChunks.map((_, index) => `${pageBaseId}_${index}`);
        chunkIds.forEach(id => newIds.add(id));

        const entries = convertToChromaEntries(
            limitedChunks,
            Array(limitedChunks.length).fill(pageMetadata),
            chunkIds
        );

        const addResult = await chromaService.addDocuments(entries, CHROMA_WEB_COLLECTION);

        if (!addResult) {
            console.error(`   ❌ Error vectorizando ${page.url}`);
        } else {
            newChunksCount += limitedChunks.length;
        }
    }

    // Eliminar chunks de páginas que ya no existen
    const idsToDelete = Array.from(existingIds).filter(id => !newIds.has(id));
    if (idsToDelete.length > 0) {
        console.log(`   🗑️  Eliminando ${idsToDelete.length} chunks obsoletos`);
        const collection = await chromaService.getOrCreateCollection(CHROMA_WEB_COLLECTION);
        await collection.delete({ ids: idsToDelete });
    }

    console.log(`   ✅ ${newChunksCount} chunks vectorizados, ${updatedPagesCount} páginas actualizadas`);

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
            fechaUltimaActualizacion: new Date(),
        },
    });

    return { updated: true, newChunks: newChunksCount, updatedPages: updatedPagesCount };
}

async function actualizarFuenteSitemap(fuenteWeb, etiquetas) {
    console.log(`🗺️  Actualizando SITEMAP: ${fuenteWeb.url}`);
    
    // Similar a DOMINIO pero parseando el sitemap
    const scrapeResult = await webScraperService.scrapeSitemap(fuenteWeb.url);
    const successfulPages = scrapeResult.pages.filter(p => p.success);

    console.log(`   📊 ${successfulPages.length} páginas scrapeadas desde sitemap`);

    const existingIds = await getExistingDocumentIds(fuenteWeb.id);
    const newIds = new Set();
    let newChunksCount = 0;

    const metadataBase = {
        tipo: 'fuente_web',
        etiquetas: etiquetas.join(',') || null,
        etiquetas_json: JSON.stringify(etiquetas),
        url: fuenteWeb.url,
        dominio: fuenteWeb.dominio,
        titulo: fuenteWeb.titulo || '',
        fechaRegistro: fuenteWeb.fechaCreacion.toISOString(),
        fuenteWebId: fuenteWeb.id,
    };

    for (const page of successfulPages) {
        const pageHash = hashContent(page.url);
        const pageBaseId = `${fuenteWeb.id}_${pageHash}`;

        const pageExistingIds = Array.from(existingIds).filter(id => id.startsWith(pageBaseId));
        
        if (pageExistingIds.length > 0) {
            const collection = await chromaService.getOrCreateCollection(CHROMA_WEB_COLLECTION);
            await collection.delete({ ids: pageExistingIds });
        }

        const chunks = splitIntoChunks(page.content, WEB_CHUNK_SIZE, WEB_CHUNK_OVERLAP);
        const limitedChunks = chunks.slice(0, Math.floor(WEB_MAX_CHUNKS / Math.max(successfulPages.length, 1)));

        const pageMetadata = {
            ...metadataBase,
            pagina_url: page.url,
            pagina_titulo: page.title,
            pagina_descripcion: page.description,
        };

        const chunkIds = limitedChunks.map((_, index) => `${pageBaseId}_${index}`);
        chunkIds.forEach(id => newIds.add(id));

        const entries = convertToChromaEntries(
            limitedChunks,
            Array(limitedChunks.length).fill(pageMetadata),
            chunkIds
        );

        const addResult = await chromaService.addDocuments(entries, CHROMA_WEB_COLLECTION);

        if (!addResult) {
            console.error(`   ❌ Error vectorizando ${page.url}`);
        } else {
            newChunksCount += limitedChunks.length;
        }
    }

    const idsToDelete = Array.from(existingIds).filter(id => !newIds.has(id));
    if (idsToDelete.length > 0) {
        console.log(`   🗑️  Eliminando ${idsToDelete.length} chunks obsoletos`);
        const collection = await chromaService.getOrCreateCollection(CHROMA_WEB_COLLECTION);
        await collection.delete({ ids: idsToDelete });
    }

    console.log(`   ✅ ${newChunksCount} chunks vectorizados`);

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
            fechaUltimaActualizacion: new Date(),
        },
    });

    return { updated: true, newChunks: newChunksCount };
}

async function actualizarFuente(fuenteWeb) {
    const etiquetas = Array.isArray(fuenteWeb.etiquetas) ? fuenteWeb.etiquetas : [];

    try {
        let result;

        if (fuenteWeb.tipoFuente === TipoFuenteWeb.PAGINA) {
            result = await actualizarFuentePagina(fuenteWeb, etiquetas);
        } else if (fuenteWeb.tipoFuente === TipoFuenteWeb.DOMINIO) {
            result = await actualizarFuenteDominio(fuenteWeb, etiquetas);
        } else if (fuenteWeb.tipoFuente === TipoFuenteWeb.SITEMAP) {
            result = await actualizarFuenteSitemap(fuenteWeb, etiquetas);
        }

        return result;

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return { updated: false, error: error.message };
    }
}

async function ejecutarActualizacionAutomatica() {
    console.log('🤖 Iniciando actualización automática de fuentes web');
    console.log(`📅 ${new Date().toLocaleString('es-ES')}\n`);

    try {
        await chromaService.initialize();
        console.log('✅ ChromaDB inicializado\n');

        // Obtener fuentes activas que necesitan actualización
        // Por defecto, actualizar todas las que tengan más de 24h sin actualizar
        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const fuentesParaActualizar = await prisma.fuenteWeb.findMany({
            where: {
                activa: true,
                OR: [
                    { fechaUltimaActualizacion: null },
                    { fechaUltimaActualizacion: { lt: hace24h } }
                ]
            },
        });

        console.log(`📊 ${fuentesParaActualizar.length} fuentes para actualizar\n`);

        if (fuentesParaActualizar.length === 0) {
            console.log('✅ Todas las fuentes están actualizadas');
            return;
        }

        let totalActualizadas = 0;
        let totalChunksNuevos = 0;
        let totalErrores = 0;

        for (const fuente of fuentesParaActualizar) {
            try {
                const result = await actualizarFuente(fuente);
                
                if (result.updated) {
                    totalActualizadas++;
                    totalChunksNuevos += result.newChunks || 0;
                }
            } catch (error) {
                console.error(`❌ Error actualizando ${fuente.url}:`, error.message);
                totalErrores++;
            }
        }

        console.log('\n📊 Resumen de actualización:');
        console.log(`   ✅ ${totalActualizadas} fuentes actualizadas`);
        console.log(`   📝 ${totalChunksNuevos} chunks nuevos/actualizados`);
        console.log(`   ❌ ${totalErrores} errores`);

        const totalDocumentos = await chromaService.getDocumentCount(CHROMA_WEB_COLLECTION);
        console.log(`\n📚 Total documentos en ${CHROMA_WEB_COLLECTION}: ${totalDocumentos}`);

    } catch (error) {
        console.error('❌ Error en actualización automática:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

// Si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    ejecutarActualizacionAutomatica();
}

export { ejecutarActualizacionAutomatica };
