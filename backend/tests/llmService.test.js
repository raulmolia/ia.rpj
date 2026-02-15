import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function createJsonResponse(payload, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return payload;
        },
        async text() {
            return JSON.stringify(payload);
        },
    };
}

describe('llmService.callChatCompletion', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
        process.env.CHUTES_API_TOKEN = 'test-token';
        process.env.CHUTES_MAX_RETRIES = '1';
        process.env.CHUTES_TIMEOUT_MS = '200';
        process.env.CHUTES_RETRY_DELAY_MS = '10';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllTimers();
    });

    it('lanza error cuando falta el token', async () => {
        process.env.CHUTES_API_TOKEN = '';
        vi.stubGlobal('fetch', vi.fn());
        const { callChatCompletion } = await import('../src/services/llmService.js');

        await expect(callChatCompletion({ messages: [] })).rejects.toThrow('Falta la variable de entorno CHUTES_API_TOKEN');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('devuelve contenido y métricas en un intento', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            createJsonResponse({
                choices: [
                    {
                        message: {
                            content: 'Respuesta generada',
                        },
                    },
                ],
                usage: {
                    prompt_tokens: 24,
                    completion_tokens: 12,
                },
            }),
        );

        vi.stubGlobal('fetch', fetchMock);

        const { callChatCompletion } = await import('../src/services/llmService.js');
        const result = await callChatCompletion({ messages: [{ role: 'user', content: 'Hola' }] });

        expect(result.content).toBe('Respuesta generada');
        expect(result.usage.prompt_tokens).toBe(24);
        expect(result.attempts).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reintenta cuando el primer intento falla', async () => {
        const errorResponse = {
            async text() {
                return 'Servicio no disponible';
            },
            ok: false,
            status: 503,
        };

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(errorResponse)
            .mockResolvedValueOnce(
                createJsonResponse({
                    choices: [
                        {
                            message: {
                                content: 'Respuesta tras reintento',
                            },
                        },
                    ],
                    usage: {
                        prompt_tokens: 10,
                        completion_tokens: 8,
                    },
                }),
            );

        vi.stubGlobal('fetch', fetchMock);

        const { callChatCompletion } = await import('../src/services/llmService.js');
        const result = await callChatCompletion({ messages: [{ role: 'user', content: 'Hola' }], maxRetries: 1 });

        expect(result.content).toBe('Respuesta tras reintento');
        expect(result.attempts).toBe(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('lanza error tras agotar reintentos por timeout', async () => {
        const fetchMock = vi.fn((_, options = {}) =>
            new Promise((resolve, reject) => {
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        const abortError = new Error('AbortError');
                        abortError.name = 'AbortError';
                        reject(abortError);
                    });
                }
            }),
        );

        vi.stubGlobal('fetch', fetchMock);

        const { callChatCompletion } = await import('../src/services/llmService.js');
        await expect(
            callChatCompletion({
                messages: [{ role: 'user', content: 'Hola' }],
                timeoutMs: 30,
                maxRetries: 0,
            }),
        ).rejects.toThrow(/AbortError/);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
