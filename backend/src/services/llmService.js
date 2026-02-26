// Servicio de integración con Chutes AI (chat completions)
// Encapsula la llamada HTTP, gestión de errores y fallback automático de modelos
import logService from './logService.js';

const CHUTES_API_URL = process.env.CHUTES_API_URL || "https://llm.chutes.ai/v1/chat/completions";
const CHUTES_API_TOKEN = process.env.CHUTES_API_TOKEN || "";
const DEFAULT_MODEL = process.env.CHUTES_MODEL || "Qwen/Qwen2.5-72B-Instruct";
const DEFAULT_MAX_TOKENS = Number.parseInt(process.env.CHUTES_MAX_TOKENS || "8192", 10);
const DEFAULT_TEMPERATURE = Number.parseFloat(process.env.CHUTES_TEMPERATURE || "0.7");
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.CHUTES_TIMEOUT_MS || "30000", 10);
const DEFAULT_MAX_RETRIES = Number.parseInt(process.env.CHUTES_MAX_RETRIES || "1", 10);
const DEFAULT_RETRY_DELAY_MS = Number.parseInt(process.env.CHUTES_RETRY_DELAY_MS || "1000", 10);

// Modelos de fallback ordenados por preferencia (se prueban si el principal falla)
const FALLBACK_MODELS = (process.env.CHUTES_FALLBACK_MODELS || "deepseek-ai/DeepSeek-V3-0324-TEE,Qwen/Qwen3-235B-A22B-Instruct-2507-TEE")
    .split(",")
    .map(m => m.trim())
    .filter(Boolean);

// Límites de max_completion_tokens conocidos por modelo (no-streaming).
// Se usan para evitar errores 400 por exceder el límite del modelo.
const MODEL_MAX_COMPLETION_TOKENS = {
    'moonshotai/Kimi-K2-Instruct-0905': 131072,
    'moonshotai/Kimi-K2-Thinking': 131072,
    'moonshotai/Kimi-K2.5-TEE': 131072,
    'deepseek-ai/DeepSeek-V3': 65536,
    'deepseek-ai/DeepSeek-V3-0324': 65536,
    'deepseek-ai/DeepSeek-V3-0324-TEE': 65536,
    'deepseek-ai/DeepSeek-V3.1-TEE': 65536,
    'deepseek-ai/DeepSeek-V3.2-TEE': 65536,
    'deepseek-ai/DeepSeek-R1': 65536,
    'deepseek-ai/DeepSeek-R1-0528-TEE': 65536,
    'deepseek-ai/DeepSeek-R1-Distill-Llama-70B': 65536,
    'tngtech/DeepSeek-R1T-Chimera': 65536,
    'Qwen/Qwen3-235B-A22B': 32768,
    'Qwen/Qwen3-235B-A22B-Instruct-2507-TEE': 65536,
    'Qwen/Qwen2.5-72B-Instruct': 32768,
    'MiniMaxAI/MiniMax-M2.5-TEE': 65536,
};

// Límite seguro por defecto para modelos no registrados
const SAFE_DEFAULT_MAX_TOKENS = 16384;

/**
 * Devuelve el max_tokens efectivo para un modelo, sin exceder su límite conocido.
 */
function getEffectiveMaxTokens(model, requested) {
    const limit = MODEL_MAX_COMPLETION_TOKENS[model] || SAFE_DEFAULT_MAX_TOKENS;
    const capped = Math.min(requested, limit);
    if (capped < requested) {
        console.log(`[ChutesAI] max_tokens ajustado de ${requested} → ${capped} para ${model}`);
    }
    return capped;
}

function ensureApiToken() {
    if (!CHUTES_API_TOKEN) {
        throw new Error("Falta la variable de entorno CHUTES_API_TOKEN");
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Intenta una llamada al LLM con un modelo específico y reintentos
 */
async function tryModelCompletion({
    messages,
    model,
    temperature,
    maxTokens,
    stream,
    timeoutMs,
    maxRetries,
    extraBody = {},
}) {
    // Ajustar max_tokens al límite conocido del modelo
    const effectiveMaxTokens = getEffectiveMaxTokens(model, maxTokens);

    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
        attempt += 1;
        const startedAt = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(new Error(`Timeout tras ${timeoutMs} ms`)), timeoutMs);

        try {
            const response = await fetch(CHUTES_API_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${CHUTES_API_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    max_tokens: effectiveMaxTokens,
                    stream,
                    ...extraBody,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorPayload = await response.text();
                const err = new Error(`Error en Chutes AI (${response.status}): ${errorPayload}`);
                err.statusCode = response.status;
                throw err;
            }

            const data = await response.json();
            const message = data?.choices?.[0]?.message;
            const finishReason = data?.choices?.[0]?.finish_reason;

            // Si el modelo responde con tool_calls, devolver sin procesar contenido
            if (finishReason === 'tool_calls' || (message?.tool_calls && message.tool_calls.length > 0)) {
                return {
                    content: '',
                    toolCalls: message.tool_calls || [],
                    finishReason: 'tool_calls',
                    raw: data,
                    usage: data?.usage ?? null,
                    attempts: attempt,
                    durationMs: Date.now() - startedAt,
                    model,
                };
            }

            let content = message?.content?.trim() || '';

            // Algunos modelos de razonamiento (R1, Qwen3) envuelven la respuesta en <think>...</think>
            // Limpiar etiquetas de pensamiento: manejar tanto pares completos como tags sin cerrar
            if (content) {
                // Primero eliminar bloques <think>...</think> completos
                content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                // Luego eliminar <think> sin cierre (todo desde <think> hasta el inicio del contenido real)
                content = content.replace(/^<think>[\s\S]*$/gi, '').trim();
                // Eliminar tags sueltos que puedan quedar
                content = content.replace(/<\/?think>/gi, '').trim();
            }

            // Detectar <tool_call> XML que Qwen emite en el contenido en lugar de finish_reason:tool_calls
            // Formato Qwen: <tool_call>\n{"name":"...","arguments":{...}}\n</tool_call>
            if (content && content.includes('<tool_call>')) {
                const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
                const xmlToolCalls = [];
                let xmlMatch;
                while ((xmlMatch = toolCallRegex.exec(content)) !== null) {
                    try {
                        const parsed = JSON.parse(xmlMatch[1]);
                        if (parsed.name) {
                            xmlToolCalls.push({
                                id: `call_xml_${Date.now()}_${xmlToolCalls.length}`,
                                type: 'function',
                                function: {
                                    name: parsed.name,
                                    arguments: JSON.stringify(parsed.arguments || {}),
                                },
                            });
                        }
                    } catch { /* ignorar XML malformado */ }
                }
                if (xmlToolCalls.length > 0) {
                    return {
                        content: '',
                        toolCalls: xmlToolCalls,
                        finishReason: 'tool_calls',
                        raw: data,
                        usage: data?.usage ?? null,
                        attempts: attempt,
                        durationMs: Date.now() - startedAt,
                        model,
                    };
                }
            }

            // Si content está vacío, intentar extraer de reasoning_content (modelos thinking)
            if (!content && message?.reasoning_content) {
                content = message.reasoning_content.trim();
            }

            if (!content) {
                throw new Error("La respuesta de Chutes AI no contiene contenido");
            }

            const durationMs = Date.now() - startedAt;

            return {
                content,
                raw: data,
                usage: data?.usage ?? null,
                attempts: attempt,
                durationMs,
                model,
            };
        } catch (error) {
            clearTimeout(timeout);
            lastError = error instanceof Error ? error : new Error(String(error));

            if (lastError?.name === 'AbortError' && lastError?.message === 'This operation was aborted') {
                lastError = new Error(`Timeout tras ${timeoutMs} ms`);
            }

            if (attempt > maxRetries) {
                break;
            }

            // Detectar error 429 y usar un tiempo de espera corto pero creciente
            const is429Error = lastError.message.includes('429') || lastError.message.includes('maximum capacity');
            const waitTime = is429Error
                ? Math.min(DEFAULT_RETRY_DELAY_MS * attempt * 2, 5000)   // 429: 2s, 4s, 5s max
                : Math.min(DEFAULT_RETRY_DELAY_MS * attempt, DEFAULT_RETRY_DELAY_MS * 3);

            console.warn(`[ChutesAI] ${model} intento ${attempt} fallido: ${lastError.message}. Reintentando en ${waitTime} ms`);
            await delay(waitTime);
        }
    }

    lastError.attempts = attempt;
    throw lastError;
}

/**
 * Determina si un error justifica probar con un modelo de fallback.
 * Además de errores de disponibilidad (502/503/timeout), incluye errores
 * de límites de tokens y contexto (400) que se solucionan con otro modelo.
 */
function shouldTryFallback(error) {
    const msg = error?.message || '';
    // Disponibilidad: 503 sin instancias, 502 bad gateway, timeout
    if (msg.includes('503') || msg.includes('502') || msg.includes('Timeout') || msg.includes('No instances')) {
        return true;
    }
    // Capacidad máxima / rate limit: probar con otro modelo que tenga instancias libres
    if (msg.includes('429') || msg.includes('maximum capacity') || msg.includes('rate limit') || msg.includes('try again later')) {
        return true;
    }
    // Modelo no encontrado: 404 o mensaje explícito del API
    if (msg.includes('404') || msg.includes('model not found') || msg.includes('not_found')) {
        return true;
    }
    // Límites de tokens/contexto: recuperable con un modelo diferente
    if (msg.includes('max_completion_tokens') || msg.includes('context length') || msg.includes('too large') || msg.includes('token count exceeds')) {
        return true;
    }
    // Respuesta vacía: el modelo respondió pero sin contenido útil
    if (msg.includes('no contiene contenido')) {
        return true;
    }
    return false;
}

export async function callChatCompletion({
    messages,
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    stream = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    extraBody = {},
    noFallback = false,
    toolFallbackModel = null,
}) {
    ensureApiToken();

    // Intentar con el modelo principal
    try {
        return await tryModelCompletion({ messages, model, temperature, maxTokens, stream, timeoutMs, maxRetries, extraBody });
    } catch (primaryError) {
        // Si hay un modelo de fallback específico para tools (compatible con tool_calls en historial), usarlo primero
        if (toolFallbackModel && toolFallbackModel !== model) {
            try {
                console.log(`[ChutesAI] Intentando con toolFallbackModel: ${toolFallbackModel}`);
                return await tryModelCompletion({ messages, model: toolFallbackModel, temperature, maxTokens, stream, timeoutMs, maxRetries: 1, extraBody });
            } catch (toolFallbackError) {
                console.warn(`[ChutesAI] toolFallbackModel ${toolFallbackModel} también falló: ${toolFallbackError.message}`);
                // Continuar con la lógica normal de fallback
            }
        }
        // Si no hay fallback permitido (p.ej. cuando hay tool_calls en el historial)
        if (noFallback) {
            throw new Error(`El modelo ${model} no pudo responder: ${primaryError.message}`);
        }
        // Si el error no justifica fallback (ej: 401 auth), lanzar directamente
        if (!shouldTryFallback(primaryError)) {
            throw new Error(`El modelo no pudo generar una respuesta tras ${primaryError.attempts || '?'} intentos: ${primaryError.message}`);
        }

        console.warn(`[ChutesAI] Modelo principal ${model} no disponible. Probando modelos de fallback...`);
        logService.logWarn('LLM', `Modelo principal no disponible, activando fallback`, { detalles: { modelo: model, error: primaryError.message } });

        // Intentar con cada modelo de fallback en orden
        for (const fallbackModel of FALLBACK_MODELS) {
            if (fallbackModel === model) continue; // Saltar si es el mismo modelo

            try {
                console.log(`[ChutesAI] Intentando con modelo de fallback: ${fallbackModel}`);
                const result = await tryModelCompletion({
                    messages,
                    model: fallbackModel,
                    temperature,
                    maxTokens,
                    stream,
                    timeoutMs,
                    maxRetries: 0, // sin reintentos en fallback para no superar timeout del proxy
                    extraBody,
                });
                console.log(`[ChutesAI] ✅ Modelo de fallback ${fallbackModel} respondió correctamente`);
                logService.logInfo('LLM', `Fallback exitoso con modelo ${fallbackModel}`, { detalles: { modelo: fallbackModel, intento: result.attempts, duracionMs: result.durationMs } });
                return result;
            } catch (fallbackError) {
                console.warn(`[ChutesAI] Modelo de fallback ${fallbackModel} también falló: ${fallbackError.message}`);
                continue;
            }
        }

        // Todos los modelos fallaron
        const allModelsError = `Ningún modelo disponible. Principal (${model}) y fallbacks (${FALLBACK_MODELS.join(', ')}) fallaron.`;
        logService.logError('LLM', allModelsError, { detalles: { modelo: model, fallbacks: FALLBACK_MODELS } });
        throw new Error(allModelsError);
    }
}
