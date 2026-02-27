// Servicio de integración con OpenRouter API (chat completions)
// Encapsula la llamada HTTP, gestión de errores y selección de modelos
import logService from './logService.js';

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || "https://ia.rpj.es";
const OPENROUTER_SITE_NAME = process.env.OPENROUTER_SITE_NAME || "Asistente IA Juvenil RPJ";

// Modelos configurables
const MODEL_DEFAULT  = process.env.OPENROUTER_MODEL_DEFAULT  || "qwen/qwen3-30b-a3b-instruct-2507";
const MODEL_THINKING = process.env.OPENROUTER_MODEL_THINKING || "google/gemini-2.5-flash-lite";
const MODEL_TOOLS    = process.env.OPENROUTER_MODEL_TOOLS    || "google/gemini-2.5-flash-lite";

const DEFAULT_MAX_TOKENS     = Number.parseInt(process.env.OPENROUTER_MAX_TOKENS      || "8192",  10);
const DEFAULT_TEMPERATURE    = Number.parseFloat(process.env.OPENROUTER_TEMPERATURE   || "0.7");
const DEFAULT_TIMEOUT_MS     = Number.parseInt(process.env.OPENROUTER_TIMEOUT_MS      || "60000", 10);
const DEFAULT_MAX_RETRIES    = Number.parseInt(process.env.OPENROUTER_MAX_RETRIES     || "1",     10);
const DEFAULT_RETRY_DELAY_MS = Number.parseInt(process.env.OPENROUTER_RETRY_DELAY_MS  || "2000",  10);

// Límites de max_tokens por modelo (para evitar errores 400)
const MODEL_MAX_COMPLETION_TOKENS = {
    'qwen/qwen3-30b-a3b-instruct-2507': 32768,
    'google/gemini-2.5-flash-lite': 65536,
};

const SAFE_DEFAULT_MAX_TOKENS = 16384;

/**
 * Devuelve el max_tokens efectivo para un modelo, sin exceder su límite conocido.
 */
function getEffectiveMaxTokens(model, requested) {
    const limit = MODEL_MAX_COMPLETION_TOKENS[model] || SAFE_DEFAULT_MAX_TOKENS;
    const capped = Math.min(requested, limit);
    if (capped < requested) {
        console.log(`[OpenRouter] max_tokens ajustado de ${requested} → ${capped} para ${model}`);
    }
    return capped;
}

function ensureApiKey() {
    if (!OPENROUTER_API_KEY) {
        throw new Error("Falta la variable de entorno OPENROUTER_API_KEY");
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
    const effectiveMaxTokens = getEffectiveMaxTokens(model, maxTokens);

    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
        attempt += 1;
        const startedAt = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(new Error(`Timeout tras ${timeoutMs} ms`)),
            timeoutMs,
        );

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": OPENROUTER_SITE_URL,
                    "X-Title": OPENROUTER_SITE_NAME,
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
                const err = new Error(`Error en OpenRouter (${response.status}): ${errorPayload}`);
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

            // Limpiar etiquetas <think> residuales (algunos modelos pueden emitirlas)
            if (content) {
                content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                content = content.replace(/^<think>[\s\S]*$/gi, '').trim();
                content = content.replace(/<\/?think>/gi, '').trim();
            }

            // Si content está vacío, intentar extraer de reasoning (modelos thinking)
            if (!content && message?.reasoning) {
                content = String(message.reasoning).trim();
            }
            if (!content && message?.reasoning_content) {
                content = String(message.reasoning_content).trim();
            }

            if (!content) {
                throw new Error("La respuesta de OpenRouter no contiene contenido");
            }

            return {
                content,
                raw: data,
                usage: data?.usage ?? null,
                attempts: attempt,
                durationMs: Date.now() - startedAt,
                model,
            };
        } catch (error) {
            clearTimeout(timeout);
            lastError = error instanceof Error ? error : new Error(String(error));

            if (lastError?.name === 'AbortError') {
                lastError = new Error(`Timeout tras ${timeoutMs} ms`);
            }

            if (attempt > maxRetries) break;

            const is429 = lastError.message.includes('429') || lastError.message.includes('rate limit');
            const waitTime = is429
                ? Math.min(DEFAULT_RETRY_DELAY_MS * attempt * 3, 15000)
                : Math.min(DEFAULT_RETRY_DELAY_MS * attempt * 2, 10000);

            console.warn(`[OpenRouter] ${model} intento ${attempt} fallido: ${lastError.message}. Reintentando en ${waitTime} ms`);
            await delay(waitTime);
        }
    }

    lastError.attempts = attempt;
    throw lastError;
}

/**
 * Llamada principal al LLM vía OpenRouter.
 *
 * @param {object}  options
 * @param {Array}   options.messages             - Mensajes en formato OpenAI
 * @param {string}  [options.model]              - Modelo a usar (por defecto MODEL_DEFAULT)
 * @param {number}  [options.temperature]
 * @param {number}  [options.maxTokens]
 * @param {boolean} [options.stream]
 * @param {number}  [options.timeoutMs]
 * @param {number}  [options.maxRetries]
 * @param {object}  [options.extraBody]          - Campos extra para el body (tools, reasoning, etc.)
 * @param {boolean} [options.noFallback]         - Si true, no intentar toolFallbackModel
 * @param {string}  [options.toolFallbackModel]  - Modelo alternativo si el principal falla
 * @param {boolean} [options.useThinking]        - Si true, activa reasoning (DeepThink mode)
 */
export async function callChatCompletion({
    messages,
    model = MODEL_DEFAULT,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    stream = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    extraBody = {},
    noFallback = false,
    toolFallbackModel = null,
    useThinking = false,
}) {
    ensureApiKey();

    const effectiveModel = model ?? MODEL_DEFAULT;
    const effectiveExtraBody = { ...extraBody };

    // Activar razonamiento cuando se solicita DeepThink (Gemini 2.5 Flash Lite)
    if (useThinking && !effectiveExtraBody.reasoning) {
        effectiveExtraBody.reasoning = { max_tokens: 8000 };
    }

    try {
        return await tryModelCompletion({
            messages,
            model: effectiveModel,
            temperature,
            maxTokens,
            stream,
            timeoutMs,
            maxRetries,
            extraBody: effectiveExtraBody,
        });
    } catch (primaryError) {
        // Intentar con el modelo de fallback si está definido
        if (toolFallbackModel && toolFallbackModel !== effectiveModel && !noFallback) {
            try {
                console.log(`[OpenRouter] Intentando con toolFallbackModel: ${toolFallbackModel}`);
                return await tryModelCompletion({
                    messages,
                    model: toolFallbackModel,
                    temperature,
                    maxTokens,
                    stream,
                    timeoutMs,
                    maxRetries: 0,
                    extraBody: effectiveExtraBody,
                });
            } catch (fallbackError) {
                console.warn(`[OpenRouter] toolFallbackModel ${toolFallbackModel} también falló: ${fallbackError.message}`);
            }
        }

        const errorMsg = `OpenRouter: el modelo ${effectiveModel} no pudo responder: ${primaryError.message}`;
        logService.logError('LLM', errorMsg, { detalles: { modelo: effectiveModel, error: primaryError.message } });
        throw new Error(errorMsg);
    }
}

// Exportar constantes de modelos para uso en otras partes del código
export const MODELS = {
    DEFAULT:  MODEL_DEFAULT,
    THINKING: MODEL_THINKING,
    TOOLS:    MODEL_TOOLS,
};
