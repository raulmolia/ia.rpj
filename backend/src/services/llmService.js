// Servicio de integración con Chutes AI (chat completions)
// Encapsula la llamada HTTP y gestión de errores

const CHUTES_API_URL = process.env.CHUTES_API_URL || "https://llm.chutes.ai/v1/chat/completions";
const CHUTES_API_TOKEN = process.env.CHUTES_API_TOKEN || "";
const DEFAULT_MODEL = process.env.CHUTES_MODEL || "deepseek-ai/DeepSeek-R1";
const DEFAULT_MAX_TOKENS = Number.parseInt(process.env.CHUTES_MAX_TOKENS || "128000", 10);
const DEFAULT_TEMPERATURE = Number.parseFloat(process.env.CHUTES_TEMPERATURE || "0.7");
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.CHUTES_TIMEOUT_MS || "45000", 10);
const DEFAULT_MAX_RETRIES = Number.parseInt(process.env.CHUTES_MAX_RETRIES || "1", 10);
const DEFAULT_RETRY_DELAY_MS = Number.parseInt(process.env.CHUTES_RETRY_DELAY_MS || "600", 10);

function ensureApiToken() {
    if (!CHUTES_API_TOKEN) {
        throw new Error("Falta la variable de entorno CHUTES_API_TOKEN");
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callChatCompletion({
    messages,
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    stream = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
}) {
    ensureApiToken();

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
                    max_tokens: maxTokens,
                    stream,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorPayload = await response.text();
                throw new Error(`Error en Chutes AI (${response.status}): ${errorPayload}`);
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content?.trim();

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

            // Detectar error 429 y aumentar el tiempo de espera
            const is429Error = lastError.message.includes('429');
            const waitTime = is429Error 
                ? Math.min(DEFAULT_RETRY_DELAY_MS * attempt * 3, 5000) // Esperar más tiempo en error 429
                : Math.min(DEFAULT_RETRY_DELAY_MS * attempt, DEFAULT_RETRY_DELAY_MS * 4);
            
            console.warn(`[ChutesAI] intento ${attempt} fallido: ${lastError.message}. Reintentando en ${waitTime} ms`);
            await delay(waitTime);
        }
    }

    throw new Error(`El modelo no pudo generar una respuesta tras ${attempt} intentos: ${lastError?.message || 'Error desconocido'}`);
}
