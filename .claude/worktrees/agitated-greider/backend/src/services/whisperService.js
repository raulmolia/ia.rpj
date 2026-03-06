/**
 * Servicio para transcripción de audio usando Gemini 2.5 Flash Lite via OpenRouter
 * Incluye post-procesamiento con LLM para asegurar el idioma correcto.
 */

import { callChatCompletion, MODELS } from './llmService.js';

// Mapa de códigos de idioma de la app a códigos ISO 639-1
const LANGUAGE_MAP = {
    es: 'es', en: 'en', fr: 'fr', it: 'it', pt: 'pt',
    hu: 'hu', pl: 'pl', ca: 'ca', gl: 'gl', eu: 'eu',
};

// Nombres legibles de los idiomas para el prompt de traducción
const LANGUAGE_NAMES = {
    es: 'español', en: 'English', fr: 'français', it: 'italiano', pt: 'português',
    hu: 'magyar', pl: 'polski', ca: 'català', gl: 'galego', eu: 'euskara',
};

/**
 * Asegura que el texto esté en el idioma objetivo.
 * Si ya está en el idioma correcto, lo devuelve tal cual.
 * Si está en otro idioma, lo traduce usando el LLM.
 */
async function ensureLanguage(text, targetLang) {
    if (!text || !text.trim()) return text;

    const langName = LANGUAGE_NAMES[targetLang] || targetLang;

    try {
        const result = await callChatCompletion({
            messages: [
                {
                    role: 'system',
                    content: `Eres un traductor preciso. Tu ÚNICA tarea es asegurar que el texto del usuario esté en ${langName}. `
                        + `Si el texto YA está en ${langName}, devuélvelo EXACTAMENTE igual sin cambiar nada. `
                        + `Si está en otro idioma, tradúcelo fielmente a ${langName}. `
                        + `Devuelve SOLO el texto resultante, sin explicaciones, sin comillas, sin prefijos.`,
                },
                { role: 'user', content: text },
            ],
            temperature: 0.1,
            maxTokens: 1024,
            timeoutMs: 15000,
            maxRetries: 1,
        });

        console.log(`🌐 Traducción LLM: "${text}" → "${result.content}" [${targetLang}]`);
        return result.content;
    } catch (err) {
        console.warn(`⚠️ No se pudo traducir la transcripción: ${err.message}. Devolviendo texto original.`);
        return text;
    }
}

/**
 * Transcribe audio a texto usando Gemini 2.5 Flash Lite (multimodal) via OpenRouter
 * @param {Buffer} audioBuffer - Buffer del audio a transcribir
 * @param {string} [language='es'] - Código de idioma (es, en, fr, etc.)
 * @returns {Promise<{text: string}>} - Texto transcrito
 */
export async function transcribeAudio(audioBuffer, language = 'es') {
    try {
        const audioB64 = audioBuffer.toString('base64');
        const whisperLang = LANGUAGE_MAP[language] || 'es';
        const langName = LANGUAGE_NAMES[whisperLang] || whisperLang;

        console.log(`🎙️ Transcripción: enviando audio (${audioB64.length} chars base64), idioma: ${whisperLang}`);

        // Gemini 2.5 Flash Lite soporta audio inline vía OpenRouter usando el formato input_audio
        const result = await callChatCompletion({
            model: MODELS.THINKING, // google/gemini-2.5-flash-lite
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_audio',
                            input_audio: {
                                data: audioB64,
                                format: 'webm', // formato por defecto del micrófono del navegador
                            },
                        },
                        {
                            type: 'text',
                            text: `Transcribe el audio exactamente en ${langName}. Devuelve SOLO la transcripción del texto hablado, sin explicaciones ni etiquetas adicionales.`,
                        },
                    ],
                },
            ],
            temperature: 0.1,
            maxTokens: 1024,
            timeoutMs: 45000,
            maxRetries: 1,
        });

        let text = (result?.content || '').trim();

        console.log(`🎙️ Transcripción bruta: "${text}"`);

        // Post-procesamiento: asegurar que el texto esté en el idioma del usuario
        if (text && whisperLang !== 'en') {
            text = await ensureLanguage(text, whisperLang);
        }

        return { text };
    } catch (error) {
        console.error('Error transcribiendo audio:', error);
        throw error;
    }
}

export default {
    transcribeAudio,
};

