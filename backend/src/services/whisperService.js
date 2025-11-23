/**
 * Servicio para transcripción de audio usando Whisper Large V3 via Chutes AI
 */

const CHUTES_API_TOKEN = process.env.CHUTES_API_TOKEN;
const WHISPER_API_URL = 'https://chutes-whisper-large-v3.chutes.ai/transcribe';

/**
 * Transcribe audio a texto usando Whisper Large V3
 * @param {Buffer} audioBuffer - Buffer del audio a transcribir
 * @returns {Promise<{text: string}>} - Texto transcrito
 */
export async function transcribeAudio(audioBuffer) {
    try {
        // Convertir el buffer a base64
        const audioB64 = audioBuffer.toString('base64');

        const response = await fetch(WHISPER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CHUTES_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audio_b64: audioB64,
            }),
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
