import { describe, it, expect } from 'vitest';
import { detectIntentFromText, resolveIntent, CHAT_INTENTS, DEFAULT_INTENT } from '../src/config/chatPrompts.js';

describe('chatPrompts', () => {
    it('detecta intención de dinámica', () => {
        const intent = detectIntentFromText('Necesito una dinámica divertida para un grupo');
        expect(intent).toBe(CHAT_INTENTS.DINAMICA);
    });

    it('detecta intención de oración', () => {
        const intent = detectIntentFromText('¿Puedes crear una oración para jóvenes?');
        expect(intent).toBe(CHAT_INTENTS.ORACION);
    });

    it('usa intención por defecto cuando no hay coincidencias', () => {
        const intent = detectIntentFromText('¿Cuál es el horario de atención?');
        expect(intent).toBe(DEFAULT_INTENT);
    });

    it('resuelve intención desde id válido', () => {
        const intent = resolveIntent('proyecto');
        expect(intent).toBe(CHAT_INTENTS.PROYECTO);
    });

    it('resuelve intención desconocida como general', () => {
        const intent = resolveIntent('desconocido');
        expect(intent).toBe(DEFAULT_INTENT);
    });
});
