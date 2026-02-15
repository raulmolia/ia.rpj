import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chromaService from '../src/services/chromaService.js';

describe('chromaService.searchSimilar', () => {
    const originalEmbeddingFunction = chromaService.embeddingFunction;

    beforeEach(() => {
        chromaService.collections.clear();
        chromaService.client = null;
        chromaService.isAvailable = false;
        chromaService.embeddingFunction = {
            generate: vi.fn(async (inputs) => inputs.map(() => [0.1, 0.2, 0.3])),
        };
    });

    afterEach(() => {
        chromaService.collections.clear();
        chromaService.client = null;
        chromaService.isAvailable = false;
        chromaService.embeddingFunction = originalEmbeddingFunction;
    });

    it('devuelve arreglo vacío cuando Chroma no está disponible', async () => {
        chromaService.isAvailable = false;
        const results = await chromaService.searchSimilar('test', 3);
        expect(results).toEqual([]);
    });

    it('devuelve resultados formateados cuando la consulta es exitosa', async () => {
        const queryMock = vi.fn().mockResolvedValue({
            ids: [['doc-1', 'doc-2']],
            documents: [['Contenido 1', 'Contenido 2']],
            metadatas: [[{ titulo: 'Doc 1' }, { titulo: 'Doc 2' }]],
            distances: [[0.12, 0.45]],
        });

        const collectionMock = {
            query: queryMock,
        };

        chromaService.isAvailable = true;
        chromaService.client = {
            getOrCreateCollection: vi.fn().mockResolvedValue(collectionMock),
        };

        const results = await chromaService.searchSimilar('test', 2, 'coleccion-prueba');

        expect(chromaService.client.getOrCreateCollection).toHaveBeenCalledWith(expect.objectContaining({
            name: 'coleccion-prueba',
        }));
        expect(queryMock).toHaveBeenCalled();
        expect(results).toHaveLength(2);
        expect(results[0]).toMatchObject({ id: 'doc-1', document: 'Contenido 1' });
        expect(results[1].metadata).toEqual({ titulo: 'Doc 2' });
    });
});
