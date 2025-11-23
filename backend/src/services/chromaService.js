// Servicio para ChromaDB - Base de datos vectorial
// Manejo de documentación y búsqueda semántica para IA
import { ChromaClient } from 'chromadb';
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';

class ChromaService {
    constructor() {
        this.client = null;
        this.collection = null;
        this.collections = new Map();
        this.isAvailable = false;
        this.collectionName = process.env.CHROMA_COLLECTION || 'rpjia-actividades';
        this.baseUrl = null;
        this.initializing = null;
        this.retryHandle = null;
        this.retryDelayMs = Math.max(
            Number.parseInt(process.env.CHROMA_RETRY_DELAY_MS || '5000', 10),
            1000,
        );

        this.embeddingFunction = null;

        try {
            this.embeddingFunction = new DefaultEmbeddingFunction();
        } catch (error) {
            console.error('⚠️ No se pudo cargar DefaultEmbeddingFunction de Chroma:', error.message);
        }

        const parsedBatchSize = Number.parseInt(process.env.CHROMA_EMBED_BATCH_SIZE || '8', 10);
        this.embeddingBatchSize = Number.isFinite(parsedBatchSize) && parsedBatchSize > 0
            ? parsedBatchSize
            : 16;
    }

    normalizeMetadata(rawMetadata) {
        if (!rawMetadata || typeof rawMetadata !== 'object') {
            return {};
        }

        const normalized = {};

        for (const [key, value] of Object.entries(rawMetadata)) {
            if (value === undefined) {
                normalized[key] = null;
            } else if (value === null) {
                normalized[key] = null;
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                normalized[key] = value;
            } else if (value instanceof Date) {
                normalized[key] = value.toISOString();
            } else if (Array.isArray(value)) {
                normalized[key] = JSON.stringify(value);
            } else {
                try {
                    normalized[key] = JSON.stringify(value);
                } catch (error) {
                    normalized[key] = String(value);
                }
            }
        }

        return normalized;
    }

    buildClientOptions() {
        const host = process.env.CHROMA_HOST || '127.0.0.1';
        const port = Number(process.env.CHROMA_PORT || '8000');
        const ssl = process.env.CHROMA_SSL === 'true';

        if (process.env.CHROMA_URL) {
            try {
                const parsed = new URL(process.env.CHROMA_URL);
                return {
                    host: parsed.hostname,
                    port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
                    ssl: parsed.protocol === 'https:',
                };
            } catch (error) {
                console.warn('⚠️ No se pudo interpretar CHROMA_URL, se usará host/port por defecto');
            }
        }

        return { host, port, ssl };
    }

    scheduleRetry() {
        if (this.retryHandle) {
            return;
        }

        this.retryHandle = setTimeout(() => {
            this.retryHandle = null;
            this.initialize().catch(() => {
                /* la re-intentaremos en la siguiente invocación */
            });
        }, this.retryDelayMs);

        if (typeof this.retryHandle.unref === 'function') {
            this.retryHandle.unref();
        }
    }

    async initialize(force = false) {
        if (this.isAvailable && !force) {
            return true;
        }

        if (this.initializing && !force) {
            return this.initializing;
        }

        const initPromise = (async () => {
            const clientOptions = this.buildClientOptions();

            try {
                this.client = new ChromaClient(clientOptions);
                this.baseUrl = `${clientOptions.ssl ? 'https' : 'http'}://${clientOptions.host}:${clientOptions.port}`;

                const collection = await this.client.getOrCreateCollection({
                    name: this.collectionName,
                    metadata: {
                        project: 'asistente-ia-juvenil',
                        created_at: new Date().toISOString(),
                    },
                    embeddingFunction: null,
                });

                this.collections.set(this.collectionName, collection);
                this.collection = collection;

                await collection.count();

                if (this.retryHandle) {
                    clearTimeout(this.retryHandle);
                    this.retryHandle = null;
                }

                this.isAvailable = true;
                console.log(`📚 ChromaDB conectado en ${this.baseUrl} (colección base: ${this.collectionName})`);
                return true;
            } catch (error) {
                console.error('❌ Error inicializando ChromaDB:', error.message);
                this.client = null;
                this.collection = null;
                this.collections.clear();
                this.isAvailable = false;
                this.scheduleRetry();
                return false;
            } finally {
                this.initializing = null;
            }
        })();

        this.initializing = initPromise;
        return initPromise;
    }

    async ensureReady() {
        if (this.isAvailable && this.client) {
            return true;
        }

        const initialized = await this.initialize();
        return initialized;
    }

    async getOrCreateCollection(name) {
        if (!this.client) {
            const ready = await this.ensureReady();
            if (!ready) {
                throw new Error('ChromaDB no inicializado');
            }
        }

        const targetName = name || this.collectionName;

        if (this.collections.has(targetName)) {
            return this.collections.get(targetName);
        }

        const collection = await this.client.getOrCreateCollection({
            name: targetName,
            metadata: {
                project: 'asistente-ia-juvenil',
                created_at: new Date().toISOString(),
            },
            // Usamos embeddings locales, por lo que evitamos configurar uno remoto.
            embeddingFunction: null,
        });

        this.collections.set(targetName, collection);
        return collection;
    }

    async addDocument(id, content, metadata = {}, collectionName = null) {
        return this.addDocuments([
            {
                id,
                document: content,
                metadata,
            },
        ], collectionName);
    }

    async addDocuments(entries, collectionName = null) {
        if (!this.isAvailable || !this.client) {
            const ready = await this.ensureReady();

            if (!ready) {
                console.log('⚠️ ChromaDB no disponible, omitiendo documentos');
                return false;
            }
        }

        if (!this.embeddingFunction) {
            console.error('❌ No hay función de embeddings configurada, imposible procesar documentos');
            return false;
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            console.error('❌ addDocuments: entries no válido o vacío');
            console.error('entries type:', typeof entries);
            console.error('entries value:', entries);
            console.error('entries.length:', entries?.length);
            return false;
        }

        try {
            const targetCollection = await this.getOrCreateCollection(collectionName || this.collectionName);

            const batchSize = Math.max(Number.isFinite(this.embeddingBatchSize)
                ? this.embeddingBatchSize
                : 8, 1);

            for (let index = 0; index < entries.length; index += batchSize) {
                const batchEntries = entries.slice(index, index + batchSize);
                const documents = batchEntries.map((entry) => entry.document || '');
                const embeddings = await this.embeddingFunction.generate(documents);

                await targetCollection.add({
                    ids: batchEntries.map((entry) => entry.id),
                    documents,
                    embeddings,
                    metadatas: batchEntries.map((entry) => this.normalizeMetadata(entry.metadata)),
                });
            }

            return true;
        } catch (error) {
            console.error('❌ Error añadiendo documentos a ChromaDB:', error.message);
            return false;
        }
    }

    async searchSimilar(query, limit = 5, collectionName = null, tags = null) {
        if (!this.isAvailable || !this.client) {
            const ready = await this.ensureReady();

            if (!ready) {
                console.log('⚠️ ChromaDB no disponible, devolviendo resultados vacíos');
                return [];
            }
        }

        if (!this.embeddingFunction) {
            console.log('⚠️ No hay función de embeddings configurada para búsquedas');
            return [];
        }

        try {
            const targetCollection = await this.getOrCreateCollection(collectionName || this.collectionName);

            const [queryEmbedding] = await this.embeddingFunction.generate([query]);

            const queryParams = {
                queryEmbeddings: [queryEmbedding],
                // Aumentamos nResults para compensar el filtrado posterior
                nResults: tags && tags.length > 0 ? limit * 3 : limit,
                include: ['documents', 'metadatas', 'distances'],
            };

            // NOTA: ChromaDB no soporta $contains para arrays serializados como JSON strings
            // Por lo tanto, hacemos el filtrado después de obtener los resultados

            const result = await targetCollection.query(queryParams);

            if (!result || !result.ids || result.ids.length === 0) {
                return [];
            }

            const firstBatch = result.ids[0] || [];

            let results = firstBatch.map((id, index) => ({
                id,
                document: result.documents?.[0]?.[index] || '',
                metadata: result.metadatas?.[0]?.[index] || {},
                distance: result.distances?.[0]?.[index] || null,
            }));

            // Filtrar por tags después de obtener los resultados
            if (tags && Array.isArray(tags) && tags.length > 0) {
                results = results.filter(item => {
                    if (!item.metadata || !item.metadata.etiquetas) {
                        return false;
                    }
                    
                    // Las etiquetas están guardadas como string JSON
                    let documentTags = [];
                    try {
                        documentTags = JSON.parse(item.metadata.etiquetas);
                    } catch (e) {
                        // Si no es JSON válido, intentar como string separado por comas
                        documentTags = item.metadata.etiquetas.split(',').map(t => t.trim());
                    }
                    
                    // Verificar si alguna de las etiquetas solicitadas está en el documento
                    return tags.some(tag => documentTags.includes(tag));
                });
            }

            // Limitar al número de resultados solicitado
            return results.slice(0, limit);
        } catch (error) {
            console.error('❌ Error buscando en ChromaDB:', error.message);
            return [];
        }
    }

    async getDocumentCount(collectionName = null) {
        if (!this.isAvailable || !this.client) {
            const ready = await this.ensureReady();
            if (!ready) {
                return -1;
            }
        }

        try {
            const targetCollection = await this.getOrCreateCollection(collectionName || this.collectionName);
            return await targetCollection.count();
        } catch (error) {
            console.error('❌ Error obteniendo conteo de ChromaDB:', error.message);
            return -1;
        }
    }

    /**
     * Crea una colección temporal para una conversación específica
     * @param {string} conversationId - ID de la conversación
     * @returns {Promise<string>} - Nombre de la colección temporal
     */
    async createTemporaryCollection(conversationId) {
        const collectionName = `rpjia-temp-${conversationId}`;
        
        try {
            await this.getOrCreateCollection(collectionName);
            console.log(`✅ Colección temporal creada: ${collectionName}`);
            return collectionName;
        } catch (error) {
            console.error(`❌ Error creando colección temporal: ${error.message}`);
            throw error;
        }
    }

    /**
     * Agrega documentos procesados (con Gemma) a una colección temporal
     * @param {string} conversationId - ID de la conversación
     * @param {Array} documents - Array de documentos a agregar
     * @returns {Promise<boolean>} - true si se agregaron correctamente
     */
    async addToTemporaryCollection(conversationId, documents) {
        const collectionName = `rpjia-temp-${conversationId}`;
        
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            
            const ids = documents.map((doc, idx) => `${conversationId}-file-${idx}-${Date.now()}`);
            const texts = documents.map(doc => doc.text);
            const metadatas = documents.map(doc => this.normalizeMetadata({
                fileName: doc.fileName,
                mimeType: doc.mimeType,
                size: doc.size,
                wordCount: doc.wordCount,
                conversationId: conversationId,
                uploadedAt: new Date().toISOString(),
                ...doc.metadata,
            }));

            await collection.add({
                ids,
                documents: texts,
                metadatas,
            });

            console.log(`✅ ${documents.length} documentos agregados a ${collectionName}`);
            return true;
        } catch (error) {
            console.error(`❌ Error agregando a colección temporal: ${error.message}`);
            return false;
        }
    }

    /**
     * Busca en la colección temporal de una conversación
     * @param {string} conversationId - ID de la conversación
     * @param {string} query - Query de búsqueda
     * @param {number} limit - Número máximo de resultados
     * @returns {Promise<Array>} - Resultados de la búsqueda
     */
    async searchInTemporaryCollection(conversationId, query, limit = 3) {
        const collectionName = `rpjia-temp-${conversationId}`;
        
        try {
            const collection = await this.getOrCreateCollection(collectionName);
            
            const results = await collection.query({
                queryTexts: [query],
                nResults: limit,
            });

            if (!results || !results.documents || results.documents.length === 0) {
                return [];
            }

            const firstResult = results.documents[0];
            const firstMeta = results.metadatas?.[0] || [];
            const firstDist = results.distances?.[0] || [];
            const firstIds = results.ids?.[0] || [];

            return firstResult.map((doc, idx) => ({
                id: firstIds[idx],
                text: doc,
                metadata: firstMeta[idx] || {},
                distance: firstDist[idx] ?? null,
            }));
        } catch (error) {
            console.error(`❌ Error buscando en colección temporal: ${error.message}`);
            return [];
        }
    }

    /**
     * Elimina una colección temporal cuando se borra una conversación
     * @param {string} conversationId - ID de la conversación
     * @returns {Promise<boolean>} - true si se eliminó correctamente
     */
    async deleteTemporaryCollection(conversationId) {
        const collectionName = `rpjia-temp-${conversationId}`;
        
        try {
            if (!this.isAvailable || !this.client) {
                const ready = await this.ensureReady();
                if (!ready) {
                    console.warn('⚠️ ChromaDB no disponible, no se puede eliminar colección temporal');
                    return false;
                }
            }

            await this.client.deleteCollection({ name: collectionName });
            
            // Remover de caché
            this.collections.delete(collectionName);
            
            console.log(`✅ Colección temporal eliminada: ${collectionName}`);
            return true;
        } catch (error) {
            // Si la colección no existe, no es un error crítico
            if (error.message && error.message.includes('does not exist')) {
                console.log(`ℹ️ Colección temporal no existía: ${collectionName}`);
                return true;
            }
            
            console.error(`❌ Error eliminando colección temporal: ${error.message}`);
            return false;
        }
    }

    /**
     * Verifica si existe una colección temporal para una conversación
     * @param {string} conversationId - ID de la conversación
     * @returns {Promise<boolean>} - true si existe
     */
    async hasTemporaryCollection(conversationId) {
        const collectionName = `rpjia-temp-${conversationId}`;
        
        try {
            if (!this.isAvailable || !this.client) {
                return false;
            }

            const collections = await this.client.listCollections();
            return collections.some(col => col.name === collectionName);
        } catch (error) {
            console.error(`❌ Error verificando colección temporal: ${error.message}`);
            return false;
        }
    }
}

// Instancia singleton
const chromaService = new ChromaService();

export default chromaService;