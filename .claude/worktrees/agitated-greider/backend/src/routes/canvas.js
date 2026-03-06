// Ruta para transformaciones del Canvas (edición iterativa de respuestas)
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { callChatCompletion } from '../services/llmService.js';

const router = express.Router();

// Mapeo de idiomas a nombres legibles para el prompt
const LANGUAGE_NAMES = {
    es: 'español', en: 'English', fr: 'français', it: 'italiano',
    pt: 'português', hu: 'magyar', pl: 'polski', ca: 'català',
    gl: 'galego', eu: 'euskara',
};

/**
 * POST /api/canvas/transform
 * Transforma contenido del canvas según instrucciones del usuario.
 * Soporta transformación completa o parcial (solo texto seleccionado).
 *
 * Body: { content: string, selection?: string, instruction: string, language?: string }
 * Respuesta: { content: string }
 */
router.post('/transform', authenticate, async (req, res) => {
    try {
        const { content, selection, instruction, language = 'es' } = req.body;

        if (!content || !instruction) {
            return res.status(400).json({
                error: 'Se requieren los campos "content" e "instruction".',
            });
        }

        const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.es;

        let systemPrompt;
        if (selection) {
            // Transformación parcial: solo el fragmento seleccionado
            systemPrompt = `Eres un editor de textos profesional. El usuario tiene un documento y ha seleccionado una parte específica para modificar.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE en ${languageName}.
2. Devuelve el documento COMPLETO con la modificación aplicada SOLO al fragmento seleccionado.
3. NO cambies el resto del documento. Mantén exactamente el mismo formato, estructura y contenido fuera de la selección.
4. El fragmento seleccionado es: """${selection}"""
5. Aplica la siguiente instrucción SOLO al fragmento seleccionado: "${instruction}"
6. Devuelve SOLO el texto resultante, sin explicaciones, sin comentarios, sin metadatos.`;
        } else {
            // Transformación completa del documento
            systemPrompt = `Eres un editor de textos profesional. El usuario quiere modificar todo el documento según una instrucción.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE en ${languageName}.
2. Aplica la instrucción al documento completo.
3. Mantén el formato y la estructura general salvo que la instrucción indique lo contrario.
4. Instrucción del usuario: "${instruction}"
5. Devuelve SOLO el texto resultante, sin explicaciones, sin comentarios, sin metadatos.`;
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: content },
        ];

        const result = await callChatCompletion({
            messages,
            temperature: 0.4,
            maxTokens: 16384,
            timeoutMs: 60000,
        });

        // Limpiar posibles tokens de pensamiento (<think>...</think>)
        let transformedContent = result.content || '';
        transformedContent = transformedContent
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .trim();

        console.log(`[Canvas] Transformación completada (${selection ? 'parcial' : 'completa'}) - ${transformedContent.length} chars`);

        res.json({ content: transformedContent });
    } catch (error) {
        console.error('[Canvas] Error en transformación:', error.message);
        res.status(500).json({
            error: 'No se pudo transformar el contenido. Inténtalo de nuevo.',
        });
    }
});

export default router;
