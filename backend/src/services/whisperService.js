/**
 * Servicio para transcripción de audio usando Whisper Large V3 via Chutes AI
 */

const CHUTES_API_TOKEN = process.env.CHUTES_API_TOKEN;
const WHISPER_API_URL = 'https://chutes-whisper-large-v3.chutes.ai/transcribe';

// Mapa de códigos de idioma de la app a códigos ISO 639-1 para Whisper
const LANGUAGE_MAP = {
    es: 'es', en: 'en', fr: 'fr', it: 'it', pt: 'pt',
    hu: 'hu', pl: 'pl', ca: 'ca', gl: 'gl', eu: 'eu',
};

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

        // Construir payload con idioma para mejorar la detección
        const payload = {
            audio_b64: audioB64,
        };

        // Enviar el idioma si está mapeado (Whisper acepta códigos ISO 639-1)
        const whisperLang = LANGUAGE_MAP[language] || 'es';
        payload.language = whisperLang;

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
        
        console.log('📥 Respuesta completa de Whisper:', JSON.stringify(data, null, 2));
        
        // Whisper Large V3 devuelve un array de segmentos con timestamps
        // Formato: [{ "start": 0, "end": 3.96, "text": " Hola" }, ...]
        let text = '';
        
        if (Array.isArray(data)) {
            // Si es un array de segmentos, concatenar todos los textos
            text = data.map(segment => segment.text || '').join('').trim();
        } else if (typeof data === 'object' && data.text) {
            // Si es un objeto con propiedad text directa
            text = data.text;
        } else if (typeof data === 'object' && data.transcription) {
            // Si es un objeto con propiedad transcription
            text = data.transcription;
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
