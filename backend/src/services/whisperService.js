/**
 * Servicio para transcripción de audio usando Whisper Large V3 via Chutes AI
 * Incluye post-procesamiento con LLM para asegurar el idioma correcto.
 */

import { callChatCompletion } from './llmService.js';

const CHUTES_API_TOKEN = process.env.CHUTES_API_TOKEN;
const WHISPER_API_URL = 'https://chutes-whisper-large-v3.chutes.ai/transcribe';

// Mapa de códigos de idioma de la app a códigos ISO 639-1 para Whisper
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
 * @param {string} text - Texto a verificar/traducir
 * @param {string} targetLang - Código ISO 639-1 del idioma objetivo
 * @returns {Promise<string>} Texto en el idioma objetivo
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
        // Si falla la traducción, devolver el texto original para no bloquear al usuario
        console.warn(`⚠️ No se pudo traducir la transcripción: ${err.message}. Devolviendo texto original.`);
        return text;
    }
}

/**
 * Transcribe audio a texto usando Whisper Large V3
 * @param {Buffer} audioBuffer - Buffer del audio a transcribir
 * @param {string} [language='es'] - Código de idioma (es, en, fr, etc.)
 * @returns {Promise<{text: string}>} - Texto transcrito
 */
export async function transcribeAudio(audioBuffer, language = 'es') {
    try {
        // Convertir el buffer a base64
        const audioB64 = audioBuffer.toString('base64');

        // La API de Chutes Whisper solo acepta audio_b64 de forma efectiva.
        // Los parámetros language/task se envían pero la API puede ignorarlos.
        const whisperLang = LANGUAGE_MAP[language] || 'es';
        const payload = {
            audio_b64: audioB64,
            language: whisperLang,
            task: 'transcribe',
        };

        console.log(`🎙️ Whisper: enviando audio (${audioB64.length} chars), idioma solicitado: ${whisperLang}`);

        const response = await fetch(WHISPER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CHUTES_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error en Whisper API (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        // Whisper Large V3 devuelve un array de segmentos con timestamps
        // Formato: [{ "start": 0, "end": 3.96, "text": " Hola" }, ...]
        let text = '';

        if (Array.isArray(data)) {
            text = data.map(segment => segment.text || '').join('').trim();
        } else if (typeof data === 'object' && data.text) {
            text = data.text;
        } else if (typeof data === 'object' && data.transcription) {
            text = data.transcription;
        }

        console.log(`🎙️ Whisper transcripción bruta: "${text}"`);

        // Post-procesamiento: asegurar que el texto esté en el idioma del usuario
        if (text && whisperLang !== 'en') {
            // Si el idioma objetivo NO es inglés, verificar/traducir con LLM
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
