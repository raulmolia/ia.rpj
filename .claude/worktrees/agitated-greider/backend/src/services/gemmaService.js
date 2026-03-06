// Servicio para tareas auxiliares de IA (títulos, saludos, transcripción, optimización)
// Usa callChatCompletion de llmService (OpenRouter)
import { getGreeting } from '../config/chatPrompts.js';
import { callChatCompletion, MODELS } from './llmService.js';

/**
 * Genera un título resumido para un chat basado en el primer mensaje
 * @param {string} firstMessage - Primer mensaje del usuario
 * @returns {Promise<string>} - Título del chat (máximo 50 caracteres)
 */
export async function generateChatTitle(firstMessage) {
    const prompt = `Genera un título muy corto y descriptivo (máximo 5 palabras) para un chat que empieza con este mensaje del usuario:

"${firstMessage}"

Responde SOLO con el título, sin comillas, sin explicaciones, sin etiquetas. Debe ser claro y reflejar el tema principal.`;

    try {
        const result = await callChatCompletion({
            messages: [{ role: 'user', content: prompt }],
            model: MODELS.DEFAULT,
            temperature: 0.5,
            maxTokens: 100,
            timeoutMs: 20000,
            maxRetries: 1,
        });

        let cleanTitle = (result?.content || '').trim();
        cleanTitle = cleanTitle.replace(/^["'«»]|["'«»]$/g, '').trim();
        cleanTitle = cleanTitle.slice(0, 60);
        return cleanTitle || 'Nueva conversación';
    } catch (error) {
        console.error('Error generando título de chat:', error.message);
        return 'Nueva conversación';
    }
}

/**
 * Genera un saludo inicial personalizado con el nombre del usuario
 * @param {string} userName - Nombre del usuario
 * @param {string} intent - Intención del chat (DINAMICA, ORACION, etc.)
 * @returns {Promise<string>} - Mensaje de saludo
 */
export async function generateInitialGreeting(userName, intent = null) {
    const intentContext = intent ? `El usuario está interesado en: ${intent}.` : '';

    const prompt = `Genera un saludo ultra corto y cálido para ${userName} que acaba de abrir un chat. ${intentContext}

REQUISITOS ESTRICTOS:
- Máximo 7 palabras (no más)
- Una sola línea
- Cálido y acogedor
- Sin emojis
- Si abres una exclamación (¡), debes cerrarla (!)
- Debe ser CREATIVO y DIFERENTE cada vez (no repitas saludos)

Ejemplos válidos (usa variaciones diferentes):
- "Hola María, cuéntame qué necesitas"
- "Bienvenido Juan, estoy aquí para ayudarte"
- "Hola Pedro, cómo puedo acompañarte hoy"
- "¡Qué alegría verte Laura, te escucho!"
- "Encantado de saludarte Carlos, conversemos"
- "Hola Ana, comparte lo que quieras"

Responde SOLO con el saludo, sin comillas ni explicaciones.`;

    try {
        const result = await callChatCompletion({
            messages: [{ role: 'user', content: prompt }],
            model: MODELS.DEFAULT,
            temperature: 0.9,
            maxTokens: 80,
            timeoutMs: 20000,
            maxRetries: 1,
        });

        return (result?.content || '').trim() || getGreeting(userName, 'es');
    } catch (error) {
        console.error('Error generando saludo inicial:', error);
        return getGreeting(userName, 'es');
    }
}

/**
 * Transcribe y analiza el contenido de un archivo (imagen o PDF)
 * @param {string} fileContent - Contenido del archivo (texto extraído, OCR, etc.)
 * @param {string} fileName - Nombre del archivo
 * @param {string} fileType - Tipo de archivo (image/jpeg, application/pdf, etc.)
 * @returns {Promise<Object>} - Objeto con texto transcrito y resumen
 */
export async function transcribeFileContent(fileContent, fileName, fileType) {
    const prompt = `Analiza el siguiente contenido extraído del archivo "${fileName}" (tipo: ${fileType}).

CONTENIDO:
${fileContent}

Tu tarea es:
1. Transcribir y organizar el contenido de forma clara
2. Identificar los puntos clave
3. Preparar un resumen estructurado que será útil como contexto para un asistente de IA

Responde en formato JSON con esta estructura:
{
  "transcripcion": "Texto completo transcrito y organizado",
  "resumen": "Resumen breve de los puntos principales",
  "palabrasClave": ["palabra1", "palabra2", "..."]
}`;

    try {
        const result = await callChatCompletion({
            messages: [{ role: 'user', content: prompt }],
            model: MODELS.DEFAULT,
            temperature: 0.3,
            maxTokens: 2048,
            timeoutMs: 30000,
            maxRetries: 1,
        });

        const response = result?.content || '';

        // Intentar parsear la respuesta como JSON
        try {
            // Buscar el JSON en la respuesta (puede estar envuelto en markdown)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    transcripcion: parsed.transcripcion || fileContent,
                    resumen: parsed.resumen || '',
                    palabrasClave: parsed.palabrasClave || [],
                };
            }
        } catch (parseError) {
            console.warn('No se pudo parsear respuesta JSON, usando contenido original');
        }

        // Si no se puede parsear, devolver el contenido original
        return {
            transcripcion: fileContent,
            resumen: response.slice(0, 500),
            palabrasClave: [],
        };
    } catch (error) {
        console.error('Error transcribiendo contenido:', error);
        return {
            transcripcion: fileContent,
            resumen: '',
            palabrasClave: [],
        };
    }
}

/**
 * Optimiza texto para almacenamiento en ChromaDB
 * @param {string} text - Texto a optimizar
 * @param {number} maxLength - Longitud máxima del texto
 * @returns {Promise<string>} - Texto optimizado
 */
export async function optimizeTextForEmbedding(text, maxLength = 4000) {
    if (text.length <= maxLength) {
        return text;
    }

    const prompt = `Resume el siguiente texto preservando toda la información importante. El resumen debe ser claro y completo, con un máximo de ${maxLength} caracteres:

${text}

Responde SOLO con el resumen, sin introducción ni explicaciones.`;

    try {
        const result = await callChatCompletion({
            messages: [{ role: 'user', content: prompt }],
            model: MODELS.DEFAULT,
            temperature: 0.3,
            maxTokens: Math.floor(maxLength / 2),
            timeoutMs: 30000,
            maxRetries: 1,
        });

        return (result?.content || '').trim() || text.slice(0, maxLength) + '...';
    } catch (error) {
        console.error('Error optimizando texto:', error);
        // Si falla, truncar directamente
        return text.slice(0, maxLength) + '...';
    }
}

export default {
    generateChatTitle,
    generateInitialGreeting,
    transcribeFileContent,
    optimizeTextForEmbedding,
};
