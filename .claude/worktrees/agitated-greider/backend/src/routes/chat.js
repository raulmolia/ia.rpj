import express from 'express';
import prismaPackage from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import chromaService from '../services/chromaService.js';
import { callChatCompletion, MODELS } from '../services/llmService.js';
import gemmaService from '../services/gemmaService.js';
import logService from '../services/logService.js';
import { hasActiveGoogleConnector } from '../services/googleOAuthService.js';
import { GOOGLE_DRIVE_TOOLS, executeGoogleDriveTool } from '../services/googleDriveService.js';
import { GOOGLE_DOCS_TOOLS, executeGoogleDocsTool } from '../services/googleDocsService.js';
import { registrarCosteGeneracion } from '../services/openRouterCostService.js';
import {
    detectIntentFromText,
    resolveIntent,
    DEFAULT_INTENT,
    getLanguageInstruction,
    getGreeting,
} from '../config/chatPrompts.js';

const { PrismaClient } = prismaPackage;
const PrismaEnums = prismaPackage.$Enums || {};

const RolMensaje = PrismaEnums.RolMensaje || {
    USUARIO: 'USUARIO',
    ASISTENTE: 'ASISTENTE',
    SISTEMA: 'SISTEMA',
};

const router = express.Router();
const prisma = new PrismaClient();
const FALLBACK_MESSAGE = 'Lo siento, ahora mismo no puedo generar una propuesta. Estoy revisando el sistema; inténtalo de nuevo en unos minutos.';
const RATE_LIMIT_MESSAGE = 'El servicio de IA está experimentando una alta demanda en este momento. Por favor, espera unos momentos e intenta de nuevo.';
const SYSTEM_MESSAGE_PREDICATE = /mensaje del sistema:/i;

// Límites por rol (para roles especiales que no dependen de suscripción)
const ROLE_LIMITS = {
    SUPERADMIN: {
        maxConversations: null, // Sin límite
        maxMessagesPerConversation: null, // Sin límite
        maxDailyInteractions: null, // Sin límite
        maxDailyChats: null, // Sin límite
        hasTools: true, // Acceso a herramientas
    },
    ADMINISTRADOR: {
        maxConversations: null,
        maxMessagesPerConversation: null,
        maxDailyInteractions: null,
        maxDailyChats: null,
        hasTools: true,
    },
    DOCUMENTADOR: {
        maxConversations: null, // Sin límite
        maxMessagesPerConversation: null, // Sin límite
        maxDailyInteractions: null, // Sin límite
        maxDailyChats: null, // Sin límite
        hasTools: true,
    },
    DOCUMENTADOR_JUNIOR: {
        maxConversations: null, // Sin límite
        maxMessagesPerConversation: null, // Sin límite
        maxDailyInteractions: null, // Sin límite
        maxDailyChats: null, // Sin límite
        hasTools: true,
    },
};

// Límites por tipo de suscripción (para rol USUARIO)
const SUBSCRIPTION_LIMITS = {
    FREE: {
        maxConversations: 7,
        maxMessagesPerConversation: null, // Sin límite per-conversación; el límite diario es suficiente
        maxDailyInteractions: 15,
        maxDailyChats: 3,
        hasTools: true, // Acceso a herramientas (Deep Think, Canvas, Conectores)
    },
    PRO: {
        maxConversations: 50,
        maxMessagesPerConversation: null, // Sin límite per-conversación; el límite diario es suficiente
        maxDailyInteractions: 100,
        maxDailyChats: 20,
        hasTools: true, // Acceso completo a herramientas
    },
};

// Función para obtener los límites según rol y suscripción
function getUserLimits(userRole, tipoSuscripcion = 'FREE') {
    // Si el rol tiene límites especiales (admin, documentador, etc.), usarlos
    if (ROLE_LIMITS[userRole]) {
        return ROLE_LIMITS[userRole];
    }

    // Para rol USUARIO, usar los límites de suscripción
    return SUBSCRIPTION_LIMITS[tipoSuscripcion] || SUBSCRIPTION_LIMITS.FREE;
}

// Mantener compatibilidad con código existente
const USER_LIMITS = {
    SUPERADMIN: ROLE_LIMITS.SUPERADMIN,
    ADMINISTRADOR: ROLE_LIMITS.ADMINISTRADOR,
    DOCUMENTADOR: ROLE_LIMITS.DOCUMENTADOR,
    DOCUMENTADOR_JUNIOR: ROLE_LIMITS.DOCUMENTADOR_JUNIOR,
    USUARIO: SUBSCRIPTION_LIMITS.FREE, // Por defecto FREE para usuarios normales
};

function mapRoleToOpenAI(role) {
    switch (role) {
        case RolMensaje.ASISTENTE:
            return 'assistant';
        case RolMensaje.SISTEMA:
            return 'system';
        case RolMensaje.USUARIO:
        default:
            return 'user';
    }
}

function mapOpenAIRoleToPrisma(role) {
    if (role === 'assistant') return RolMensaje.ASISTENTE;
    if (role === 'system') return RolMensaje.SISTEMA;
    return RolMensaje.USUARIO;
}

function buildConversationTitle(conversation) {
    if (conversation?.titulo) {
        return conversation.titulo;
    }

    if (conversation?.descripcion) {
        const clean = conversation.descripcion.trim();
        if (clean.length > 0) {
            return clean.slice(0, 48) + (clean.length > 48 ? '…' : '');
        }
    }

    const date = conversation?.fechaCreacion instanceof Date
        ? conversation.fechaCreacion
        : new Date(conversation?.fechaCreacion || Date.now());

    return `Conversación ${date.toLocaleDateString('es-ES')}`;
}

function sanitizeConversation(conversation) {
    return {
        id: conversation.id,
        titulo: buildConversationTitle(conversation),
        descripcion: conversation.descripcion,
        intencionPrincipal: conversation.intencionPrincipal || DEFAULT_INTENT.id,
        esCompartida: conversation.esCompartida || false,
        compartidaDesde: conversation.compartidaDesde || null,
        compartidaNombre: conversation.compartidaNombre || null,
        carpetaId: conversation.carpetaId || null,
        fechaCreacion: conversation.fechaCreacion,
        fechaActualizacion: conversation.fechaActualizacion,
    };
}

/**
 * Clasifica si una respuesta del LLM es una "entrega de trabajo" (contenido estructurado)
 * o una respuesta conversacional (saludo, aclaración, confirmación...).
 *
 * Devuelve true únicamente cuando hay evidencia clara de contenido estructurado:
 *   – encabezados markdown (# ## ###...)
 *   – 4 o más ítems de lista consecutivos
 *   – 3 o más secciones en negrita en un texto largo
 *   – al menos una regla horizontal en un texto suficientemente largo
 */
function classifyAsWorkContent(content, canvasMode = false) {
    if (!content || typeof content !== 'string') return false;

    // Canvas mode SIEMPRE produce contenido de trabajo
    if (canvasMode) return true;

    const trimmed = content.trim();

    // Respuestas cortas son conversacionales
    if (trimmed.length < 200) return false;

    // Encabezados markdown (H1–H6): señal inequívoca de documento estructurado
    if (/^#{1,6}\s/m.test(trimmed)) return true;

    // 4 o más ítems de lista: estructurado
    const listItems = (trimmed.match(/^[\-\*\+]\s|^\d+\.\s/gm) || []).length;
    if (listItems >= 4) return true;

    // 3+ secciones en negrita con texto suficiente: contenido bien organizado
    const boldHeaders = (trimmed.match(/\*\*[^*]{2,60}\*\*/g) || []).length;
    if (boldHeaders >= 3 && trimmed.length > 400) return true;

    // Regla horizontal (---): solo en documentos formateados
    if (/^---+$/m.test(trimmed) && trimmed.length > 300) return true;

    return false;
}

function sanitizeMessage(message) {
    const metadatos = (message.metadatos && typeof message.metadatos === 'object') ? message.metadatos : {};

    // Para mensajes existentes sin el campo, se computa a partir del contenido
    const isWorkContent = metadatos.isWorkContent !== undefined
        ? Boolean(metadatos.isWorkContent)
        : classifyAsWorkContent(message.contenido);

    return {
        id: message.id,
        role: mapRoleToOpenAI(message.rol),
        content: message.contenido,
        isWorkContent,
        intencion: message.intencion,
        fechaCreacion: message.fechaCreacion,
    };
}

function buildContextFromChroma(results = []) {
    if (!Array.isArray(results) || results.length === 0) {
        return '';
    }

    const limited = results.slice(0, 4);
    const sections = limited.map((item, index) => {
        const title = item?.metadata?.titulo || `Fragmento ${index + 1}`;
        const etiquetas = Array.isArray(item?.metadata?.etiquetas)
            ? `Etiquetas: ${item.metadata.etiquetas.join(', ')}`
            : '';

        // Identificar tipo de fuente
        const tipo = item?.metadata?.tipo || 'documento';
        const sourceUrl = item?.metadata?.url || item?.metadata?.pagina_url;
        const source = sourceUrl
            ? `${tipo === 'fuente_web' ? 'Web: ' : ''}${sourceUrl}`
            : (item?.metadata?.nombreOriginal || item?.metadata?.documentoId || item?.id);

        const fragment = (item?.document || '').trim().slice(0, 1200);
        return [`### Fuente: ${title}`, etiquetas, fragment, `Referencia: ${source}`]
            .filter((value) => value && value.length > 0)
            .join('\n');
    });

    // Extraer nombres resumidos de las fuentes para la cita final
    const sourceNames = limited
        .map(item => {
            const title = item?.metadata?.titulo || '';
            const url = item?.metadata?.url || item?.metadata?.pagina_url || '';
            if (title) return title;
            if (url) {
                try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
            }
            return null;
        })
        .filter(Boolean);

    // Instrucción estricta: solo citar las fuentes proporcionadas, nunca inventar
    const sourceList = sourceNames.map((n, i) => `  ${i + 1}. ${n}`).join('\n');
    const sourceHint = sourceNames.length > 0
        ? `\n\n**CITA DE FUENTES (OBLIGATORIO — LISTA CERRADA):**\nAl final de tu respuesta SIEMPRE añade una sección "📚 Fuentes consultadas:" citando ÚNICAMENTE fuentes de esta lista:\n${sourceList}\n\nREGLAS ESTRICTAS:\n- Cita SOLO las fuentes de la lista anterior que hayas utilizado realmente en tu respuesta.\n- NUNCA inventes, imagines ni añadas fuentes que NO estén en la lista.\n- Si solo usaste 1 fuente, cita solo esa. No cites todas por defecto.\n- Si son fuentes web, indica el dominio.\n- Formato: 📚 *Fuentes consultadas: [nombre1], [nombre2]*`
        : '';

    return `Contexto documental relevante (DEBES basar tu respuesta en estos documentos y citar al final SOLO los que uses):\n\n${sections.join('\n\n')}\n\nUsa estas referencias como base principal de tu respuesta. Puedes complementar con tu conocimiento pero SIEMPRE prioriza y cita el contenido documental proporcionado.${sourceHint}`;
}

function logChatEvent(level = 'info', payload = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        source: 'chat-api',
        ...payload,
    };

    // Escribir en BD de logs (además de consola)
    const nivel = level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : 'INFO';
    const { userId, conversationId, ...resto } = payload;
    logService.log(nivel, 'CHAT', payload.event || 'chat.event', {
        usuarioId: userId || undefined,
        detalles: { conversationId, ...resto },
    });

    if (level === 'error') {
        console.error(entry);
    } else if (level === 'warn') {
        console.warn(entry);
    } else {
        console.info(entry);
    }
}

async function ensureConversation({ conversationId, userId, intent, userName, userLanguage = 'es' }) {
    if (conversationId) {
        const existing = await prisma.conversacion.findUnique({
            where: { id: conversationId },
        });

        if (existing) {
            if (existing.usuarioId && existing.usuarioId !== userId) {
                throw new Error('No tienes acceso a esta conversación');
            }
            return existing;
        }
    }

    // Crear nueva conversación
    const newConversation = await prisma.conversacion.create({
        data: {
            usuarioId: userId,
            titulo: null,
            descripcion: null,
            intencionPrincipal: intent?.id || DEFAULT_INTENT.id,
        },
    });

    // Crear colección temporal en ChromaDB
    try {
        await chromaService.createTemporaryCollection(newConversation.id);
        console.log(`✅ Colección temporal creada para conversación ${newConversation.id}`);
    } catch (error) {
        console.warn(`⚠️ No se pudo crear colección temporal: ${error.message}`);
    }

    // Crear mensaje inicial estático del asistente en el idioma del usuario
    if (userName) {
        try {
            const greeting = getGreeting(userName, userLanguage);

            // Crear mensaje inicial del asistente
            await prisma.mensajeConversacion.create({
                data: {
                    conversacionId: newConversation.id,
                    rol: RolMensaje.ASISTENTE,
                    contenido: greeting,
                    intencion: intent?.id || DEFAULT_INTENT.id,
                },
            });

            console.log(`✅ Saludo inicial creado para ${userName} en idioma ${userLanguage}`);
        } catch (error) {
            console.warn(`⚠️ No se pudo crear saludo inicial: ${error.message}`);
        }
    }

    return newConversation;
}

async function fetchConversationHistory(conversationId, limit = 12) {
    const messages = await prisma.mensajeConversacion.findMany({
        where: { conversacionId: conversationId },
        orderBy: { fechaCreacion: 'desc' },
        take: limit,
    });

    return messages
        .reverse()
        .map((msg) => ({
            role: mapRoleToOpenAI(msg.rol),
            content: msg.contenido,
        }));
}

// ─── Contadores diarios inmutables (tabla uso_diario) ───

// Obtiene la fecha de hoy como Date a medianoche UTC (para coincidir con el campo @db.Date)
function getTodayDate() {
    const now = new Date();
    // Usar zona horaria del servidor (Europe/Madrid) para que el reset sea a las 00:00 locales
    const local = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

// Lee los contadores inmutables del día para un usuario
async function getDailyUsage(userId) {
    const fecha = getTodayDate();
    const record = await prisma.usoDiario.findUnique({
        where: { usuarioId_fecha: { usuarioId: userId, fecha } },
    });
    return {
        interaccionesDia: record?.interaccionesDia ?? 0,
        chatsCreados: record?.chatsCreados ?? 0,
    };
}

// Incrementa un contador diario (upsert: crea el registro si no existe)
async function incrementDailyUsage(userId, field) {
    const fecha = getTodayDate();
    await prisma.usoDiario.upsert({
        where: { usuarioId_fecha: { usuarioId: userId, fecha } },
        create: {
            usuarioId: userId,
            fecha,
            [field]: 1,
        },
        update: {
            [field]: { increment: 1 },
        },
    });
}

// Función para obtener estadísticas de uso del usuario
async function getUserStats(userId, userRole, tipoSuscripcion = 'FREE') {
    const limits = getUserLimits(userRole, tipoSuscripcion);

    // Contar conversaciones totales (activas + archivadas)  — sigue siendo real, no afecta a límites diarios
    const totalConversations = await prisma.conversacion.count({
        where: { usuarioId: userId },
    });

    // Leer contadores inmutables del día (no bajan al borrar chats)
    const dailyUsage = await getDailyUsage(userId);

    return {
        conversations: {
            current: totalConversations,
            max: limits.maxConversations,
            available: limits.maxConversations ? Math.max(0, limits.maxConversations - totalConversations) : null,
        },
        dailyChats: {
            current: dailyUsage.chatsCreados,
            max: limits.maxDailyChats,
            available: limits.maxDailyChats ? Math.max(0, limits.maxDailyChats - dailyUsage.chatsCreados) : null,
        },
        dailyInteractions: {
            current: dailyUsage.interaccionesDia,
            max: limits.maxDailyInteractions,
            available: limits.maxDailyInteractions ? Math.max(0, limits.maxDailyInteractions - dailyUsage.interaccionesDia) : null,
        },
        messagesPerConversation: {
            max: limits.maxMessagesPerConversation,
        },
        hasTools: limits.hasTools,
    };
}

// Función para validar límites antes de crear/enviar
async function validateUserLimits(userId, userRole, conversationId = null, tipoSuscripcion = 'FREE') {
    const limits = getUserLimits(userRole, tipoSuscripcion);
    const stats = await getUserStats(userId, userRole, tipoSuscripcion);

    // Validar límite de conversaciones (solo si es nueva conversación)
    if (!conversationId && limits.maxConversations) {
        if (stats.conversations.current >= limits.maxConversations) {
            return {
                allowed: false,
                reason: 'MAX_CONVERSATIONS',
                message: `Has alcanzado el límite de ${limits.maxConversations} conversaciones. Elimina alguna para continuar.`,
            };
        }
    }

    // Validar límite de conversaciones diarias (solo si es nueva conversación)
    if (!conversationId && limits.maxDailyChats) {
        if (stats.dailyChats.current >= limits.maxDailyChats) {
            return {
                allowed: false,
                reason: 'MAX_DAILY_CHATS',
                message: `Has alcanzado el límite de ${limits.maxDailyChats} conversaciones diarias. Vuelve mañana para crear más.`,
            };
        }
    }

    // Validar límite diario de mensajes
    if (limits.maxDailyInteractions) {
        if (stats.dailyInteractions.current >= limits.maxDailyInteractions) {
            return {
                allowed: false,
                reason: 'MAX_DAILY_INTERACTIONS',
                message: `Has alcanzado el límite diario de ${limits.maxDailyInteractions} mensajes. Vuelve mañana.`,
            };
        }
    }

    return { allowed: true };
}

router.get('/', authenticate, async (req, res) => {
    try {
        const conversations = await prisma.conversacion.findMany({
            where: {
                OR: [
                    { usuarioId: req.user?.id || null },
                    { usuarioId: null },
                ],
            },
            orderBy: { fechaActualizacion: 'desc' },
            take: 30,
        });

        return res.json({
            conversations: conversations.map(sanitizeConversation),
        });
    } catch (error) {
        console.error('❌ Error listando conversaciones:', error);
        return res.status(500).json({
            error: 'Error listando conversaciones',
            message: error.message,
        });
    }
});

// GET /api/chat/stats - Obtener estadísticas de uso del usuario
router.get('/stats', authenticate, async (req, res) => {
    try {
        const userRole = req.user?.rol || 'USUARIO';
        const tipoSuscripcion = req.user?.tipoSuscripcion || 'FREE';
        const limits = getUserLimits(userRole, tipoSuscripcion);
        const stats = await getUserStats(req.user.id, userRole, tipoSuscripcion);

        return res.json({
            role: userRole,
            tipoSuscripcion,
            limits,
            stats,
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return res.status(500).json({
            error: 'Error obteniendo estadísticas',
            message: error.message,
        });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    try {
        const conversation = await prisma.conversacion.findUnique({
            where: { id },
        });

        if (!conversation) {
            return res.status(404).json({
                error: 'Conversación no encontrada',
            });
        }

        if (conversation.usuarioId && conversation.usuarioId !== req.user?.id) {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'No puedes acceder a esta conversación',
            });
        }

        const messages = await prisma.mensajeConversacion.findMany({
            where: { conversacionId: id },
            orderBy: { fechaCreacion: 'asc' },
        });

        return res.json({
            conversation: sanitizeConversation(conversation),
            messages: messages.map(sanitizeMessage),
        });
    } catch (error) {
        console.error('❌ Error obteniendo conversación:', error);
        return res.status(500).json({
            error: 'Error obteniendo conversación',
            message: error.message,
        });
    }
});

router.post('/', authenticate, async (req, res) => {
    const { message, conversationId, intent: rawIntent, tags: clientTags, useThinkingModel, attachments, canvasMode, useGoogleDriveTools, useGoogleDocsTools } = req.body || {};

    let conversation = null;
    let detectedIntent = DEFAULT_INTENT;
    let userMessageRecord = null;
    let contextResults = [];

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
            error: 'Mensaje inválido',
            message: 'Debes proporcionar un mensaje de usuario',
        });
    }

    // Validar attachments si se proporcionan
    if (attachments && (!Array.isArray(attachments) || attachments.length > 5)) {
        return res.status(400).json({
            error: 'Archivos adjuntos inválidos',
            message: 'Se permiten máximo 5 archivos adjuntos',
        });
    }

    try {
        // Validar límites del usuario
        const userRole = req.user?.rol || 'USUARIO';
        const tipoSuscripcion = req.user?.tipoSuscripcion || 'FREE';
        const limitCheck = await validateUserLimits(req.user.id, userRole, conversationId, tipoSuscripcion);

        if (!limitCheck.allowed) {
            return res.status(429).json({
                error: limitCheck.reason,
                message: limitCheck.message,
                stats: await getUserStats(req.user.id, userRole, tipoSuscripcion),
            });
        }

        const trimmedMessage = message.trim();
        detectedIntent = rawIntent
            ? resolveIntent(rawIntent)
            : detectIntentFromText(trimmedMessage);

        conversation = await ensureConversation({
            conversationId,
            userId: req.user?.id || null,
            intent: detectedIntent,
            userName: req.user?.nombre || 'Usuario',
            userLanguage: req.user?.idioma || 'es',
        });

        const previousHistory = await fetchConversationHistory(conversation.id, 12);

        // Preparar metadatos con información de archivos adjuntos si existen
        const messageMetadata = {};
        if (attachments && attachments.length > 0) {
            messageMetadata.attachments = attachments.map(file => ({
                fileName: file.fileName,
                mimeType: file.mimeType,
                size: file.size,
                wordCount: file.wordCount,
            }));
        }

        userMessageRecord = await prisma.mensajeConversacion.create({
            data: {
                conversacionId: conversation.id,
                rol: RolMensaje.USUARIO,
                contenido: trimmedMessage,
                intencion: detectedIntent.id,
                metadatos: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
            },
        });

        // Incrementar contador diario inmutable de interacciones
        await incrementDailyUsage(req.user.id, 'interaccionesDia').catch(err => {
            console.warn('⚠️ Error incrementando interacciones diarias:', err.message);
        });

        // Si se acaba de crear una conversación nueva (no había conversationId), incrementar chats creados
        if (!conversationId) {
            await incrementDailyUsage(req.user.id, 'chatsCreados').catch(err => {
                console.warn('⚠️ Error incrementando chats diarios:', err.message);
            });
        }

        // Usar los tags del cliente si están disponibles, sino usar los del intent detectado
        const tagsToSearch = (clientTags && Array.isArray(clientTags) && clientTags.length > 0)
            ? clientTags
            : (detectedIntent?.tags || null);

        // Buscar en ambas colecciones: documentos y fuentes web
        const CHROMA_COLLECTION_DOCUMENTOS = process.env.CHROMA_COLLECTION_DOCUMENTOS || detectedIntent?.chromaCollection;
        const CHROMA_WEB_COLLECTION = process.env.CHROMA_COLLECTION_WEB || 'rpjia-fuentes-web';

        // Realizar búsquedas en paralelo (incluyendo colección temporal de archivos)
        const [documentResults, webResults, tempResults] = await Promise.all([
            chromaService.searchSimilar(
                trimmedMessage,
                3,
                CHROMA_COLLECTION_DOCUMENTOS,
                tagsToSearch,
            ).catch(err => {
                console.warn('Error buscando en documentos:', err.message);
                return [];
            }),
            chromaService.searchSimilar(
                trimmedMessage,
                2,
                CHROMA_WEB_COLLECTION,
                tagsToSearch,
            ).catch(err => {
                console.warn('Error buscando en fuentes web:', err.message);
                return [];
            }),
            chromaService.searchInTemporaryCollection(
                conversation.id,
                trimmedMessage,
                2,
            ).catch(err => {
                console.warn('Error buscando en archivos temporales:', err.message);
                return [];
            }),
        ]);

        // Umbral máximo de distancia ChromaDB: resultados por encima se descartan por irrelevantes
        const CHROMA_DISTANCE_THRESHOLD = parseFloat(process.env.CHROMA_DISTANCE_THRESHOLD) || 1.0;

        // Combinar, filtrar por relevancia mínima y ordenar por distancia
        contextResults = [...documentResults, ...webResults, ...tempResults]
            .filter((r) => r.distance != null && r.distance < CHROMA_DISTANCE_THRESHOLD)
            .sort((a, b) => (a.distance || 999) - (b.distance || 999))
            .slice(0, 5);

        console.log(`[ChromaDB] Resultados relevantes: ${contextResults.length} (umbral: ${CHROMA_DISTANCE_THRESHOLD}, total sin filtrar: ${documentResults.length + webResults.length + tempResults.length})`);

        let contextPrompt = buildContextFromChroma(contextResults);

        // Agregar contenido de archivos adjuntos al contexto
        if (attachments && attachments.length > 0) {
            const attachmentsContext = attachments
                .map(file => `--- Archivo: ${file.fileName} ---\n${file.text}`)
                .join('\n\n');

            const attachmentsHeader = '\n\n=== ARCHIVOS ADJUNTOS POR EL USUARIO ===\n\n';
            contextPrompt = attachmentsHeader + attachmentsContext + (contextPrompt ? '\n\n' + contextPrompt : '');
        }

        // Obtener idioma del usuario y generar instrucción de idioma
        const userLanguage = req.user?.idioma || 'es';
        const languageInstruction = getLanguageInstruction(userLanguage);

        // Si es modo canvas, usar prompt especial que genera contenido directo sin conversación
        let finalSystemPrompt;
        if (canvasMode) {
            const langName = { es: 'español', en: 'English', fr: 'français', it: 'italiano', pt: 'português', hu: 'magyar', pl: 'polski', ca: 'català', gl: 'galego', eu: 'euskara' }[userLanguage] || 'español';
            finalSystemPrompt = `Eres un redactor profesional especializado en pastoral juvenil y contenido religioso católico.

REGLAS ABSOLUTAS:
1. Responde ÚNICAMENTE en ${langName}.
2. Genera DIRECTAMENTE el contenido solicitado. NUNCA incluyas frases conversacionales como "¡Claro!", "Aquí tienes", "Con mucho gusto", "Por supuesto", saludos, despedidas ni comentarios dirigidos al usuario.
3. El texto debe comenzar INMEDIATAMENTE con el contenido (título, encabezado o primer párrafo del documento).
4. Usa formato Markdown rico y profesional:
   - Encabezados jerárquicos (# ## ### ####)
   - Listas ordenadas y desordenadas cuando sea apropiado
   - **Negrita** para conceptos clave
   - *Cursiva* para énfasis o citas
   - Separaciones claras entre secciones
5. El contenido debe ser completo, detallado, bien estructurado y estéticamente cuidado.
6. Incluye introducciones, desarrollo y conclusiones cuando corresponda.
7. Si se pide una actividad, dinámica, oración o programación, incluye todos los detalles necesarios: objetivos, materiales, desarrollo paso a paso, tiempos, reflexiones, etc.
8. NO incluyas metadatos, explicaciones sobre el formato ni comentarios finales.`;
        } else {
            finalSystemPrompt = detectedIntent.systemPrompt;
        }

        const llmMessages = [
            { role: 'system', content: finalSystemPrompt + languageInstruction },
        ];

        // ── Conectores: comprobar Google Drive / Google Docs ──
        let activeTools = [];
        let googleDriveToolsActive = false;
        let googleDocsToolsActive = false;

        // ── Google Drive tools ──
        if (req.user?.id && useGoogleDriveTools === true) {
            try {
                const driveActive = await hasActiveGoogleConnector(req.user.id, 'GOOGLE_DRIVE');
                if (driveActive) {
                    activeTools = [...activeTools, ...GOOGLE_DRIVE_TOOLS];
                    googleDriveToolsActive = true;
                    llmMessages.push({
                        role: 'system',
                        content:
                            'El usuario ha conectado su Google Drive. Tienes acceso a herramientas para gestionar sus archivos.\n\n' +
                            'HERRAMIENTAS GOOGLE DRIVE:\n' +
                            '• gdrive_list_files — lista archivos y carpetas del Drive del usuario\n' +
                            '• gdrive_search_files — busca archivos por contenido o nombre\n' +
                            '• gdrive_get_file — obtiene metadatos de un archivo por ID\n' +
                            '• gdrive_create_folder — crea una carpeta nueva\n\n' +
                            'Cuando el usuario pida ver archivos, buscar algo en su Drive, o crear carpetas, usa estas herramientas.',
                    });
                    console.log('[GoogleDrive] Tools inyectadas al LLM');
                }
            } catch (e) {
                console.error('[GoogleDrive] Error activando tools:', e.message);
            }
        }

        // ── Google Docs tools ──
        if (req.user?.id && useGoogleDocsTools === true) {
            try {
                const docsActive = await hasActiveGoogleConnector(req.user.id, 'GOOGLE_DOCS');
                if (docsActive) {
                    activeTools = [...activeTools, ...GOOGLE_DOCS_TOOLS];
                    googleDocsToolsActive = true;
                    llmMessages.push({
                        role: 'system',
                        content:
                            'El usuario ha conectado Google Docs. Tienes acceso a herramientas para gestionar sus documentos.\n\n' +
                            'HERRAMIENTAS GOOGLE DOCS:\n' +
                            '• gdocs_list_documents — lista los documentos del usuario\n' +
                            '• gdocs_get_document — lee el contenido de un documento\n' +
                            '• gdocs_create_document — crea un nuevo documento con título y contenido\n' +
                            '• gdocs_append_to_document — añade texto al final de un documento existente\n' +
                            '• gdocs_replace_text — reemplaza texto en un documento (útil para plantillas)\n\n' +
                            'Cuando el usuario pida crear documentos, leer contenido, o editar documentos de Google Docs, usa estas herramientas.',
                    });
                    console.log('[GoogleDocs] Tools inyectadas al LLM');
                }
            } catch (e) {
                console.error('[GoogleDocs] Error activando tools:', e.message);
            }
        }

        // ── Inyectar contexto documental ──
        if (contextPrompt) {
            llmMessages.push({ role: 'system', content: contextPrompt });
        }

        // Historial previo de la conversación
        if (previousHistory.length > 0) {
            llmMessages.push(...previousHistory);
        }

        // Añadir mensaje del usuario
        llmMessages.push({ role: 'user', content: trimmedMessage });

        const llmCallOptions = {
            messages: llmMessages,
            model: useThinkingModel === true ? MODELS.THINKING : (activeTools.length > 0 ? MODELS.TOOLS : undefined),
            useThinking: useThinkingModel === true,
            // Los modelos de razonamiento (thinking) no admiten tools
            ...(activeTools.length > 0 && !useThinkingModel
                ? { extraBody: { tools: activeTools, tool_choice: 'auto', parallel_tool_calls: true } }
                : {}),
        };

        let llmResponse;
        try {
            llmResponse = await callChatCompletion(llmCallOptions);
        } catch (error) {
            throw new Error(`El modelo no pudo generar una respuesta: ${error.message}`);
        }

        // Debug: registrar si el modelo usó tools o no
        if (activeTools.length > 0) {
            console.log(`[Tools] Respuesta LLM: finishReason=${llmResponse.finishReason}, toolCalls=${llmResponse.toolCalls?.length || 0}, contentLength=${(llmResponse.content || '').length}`);
        }

        // ── Tool-calling loop: ejecutar tools hasta obtener respuesta final (máx 5 pases) ──
        const MAX_TOOL_PASSES = 5;
        let toolPasses = 0;
        while (
            llmResponse.finishReason === 'tool_calls' &&
            llmResponse.toolCalls?.length > 0 &&
            toolPasses < MAX_TOOL_PASSES
        ) {
            toolPasses++;
            // Añadir la respuesta del asistente con tool_calls al historial
            const assistantToolMessage = {
                role: 'assistant',
                content: null,
                tool_calls: llmResponse.toolCalls,
            };
            llmMessages.push(assistantToolMessage);

            // Ejecutar cada tool y añadir resultados al historial
            for (const toolCall of llmResponse.toolCalls) {
                const toolName = toolCall.function?.name;
                let toolArgs = {};
                try { toolArgs = JSON.parse(toolCall.function?.arguments || '{}'); } catch { /* args vacíos */ }

                let toolResult;
                try {
                    // Dispatcher multi-conector: despachar según prefijo del nombre de la tool
                    if (toolName.startsWith('gdrive_')) {
                        toolResult = await executeGoogleDriveTool(req.user.id, toolName, toolArgs);
                    } else if (toolName.startsWith('gdocs_')) {
                        toolResult = await executeGoogleDocsTool(req.user.id, toolName, toolArgs);
                    } else {
                        throw new Error(`Tool desconocida: ${toolName}`);
                    }
                    console.log(`[Tools] ✅ ${toolName} ejecutada correctamente`);
                } catch (toolError) {
                    console.error(`[Tools] ❌ Error ejecutando ${toolName}:`, toolError.message);
                    toolResult = { error: toolError.message };
                }

                llmMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult),
                });
            }

            // Siguiente llamada al LLM con resultados de tools
            // En el último pase (o si no hay más tools), no inyectar tools para evitar loop infinito
            try {
                const isLastPass = toolPasses >= MAX_TOOL_PASSES - 1;
                llmResponse = await callChatCompletion({
                    messages: llmMessages,
                    model: useThinkingModel === true ? MODELS.THINKING : MODELS.TOOLS,
                    toolFallbackModel: MODELS.DEFAULT,
                    // Timeout reducido para no superar el timeout del proxy (60s total)
                    timeoutMs: 20000,
                    // Solo mantener tools activas si no es el último pase
                    ...(!isLastPass && activeTools.length > 0
                        ? { extraBody: { tools: activeTools, tool_choice: 'auto', parallel_tool_calls: true } }
                        : {}),
                });
            } catch (error) {
                // Si el LLM no puede responder después de ejecutar las tools,
                // construir una respuesta útil directamente desde los resultados de las tools
                console.warn(`[Tools] ⚠️ LLM no disponible tras tools (pase ${toolPasses}). Generando respuesta desde resultados.`);
                const toolMessages = llmMessages.filter(m => m.role === 'tool');
                const toolResultsText = toolMessages.map(m => {
                    try {
                        const result = JSON.parse(m.content);
                        if (Array.isArray(result)) {
                            return result.map(d => {
                                if (d.error) return `- Error: ${d.error}`;
                                return `- ${JSON.stringify(d)}`;
                            }).join('\n');
                        }
                        if (result.error) return `- Error: ${result.error}`;
                        return `- ${JSON.stringify(result)}`;
                    } catch { return `- ${m.content}`; }
                }).join('\n');
                if (toolResultsText) {
                    llmResponse = {
                        content: `Resultados de las herramientas:\n\n${toolResultsText}`,
                        finishReason: 'stop',
                        usage: null,
                    };
                } else {
                    throw new Error(`Error en llamada tras tools (pase ${toolPasses}): ${error.message}`);
                }
            }
        }

        // Limpiar cualquier tag <think> residual del contenido antes de guardar y devolver
        let cleanContent = llmResponse.content || '';
        cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        cleanContent = cleanContent.replace(/<\/?think>/gi, '').trim();

        // ── Post-procesado de fuentes: reemplazar sección del LLM por una controlada ──
        // Esto garantiza que SOLO se citen documentos realmente proporcionados por ChromaDB
        {
            const fuentesRegex = /\n*📚\s*\*?Fuentes consultadas[:\s*][\s\S]*$/gim;

            // Extraer nombres válidos de las fuentes que se proporcionaron al LLM
            const validSourceNames = (contextResults || []).slice(0, 4).map(item => {
                const title = item?.metadata?.titulo || '';
                const url = item?.metadata?.url || item?.metadata?.pagina_url || '';
                if (title) return title;
                if (url) {
                    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
                }
                return null;
            }).filter(Boolean);

            // Siempre eliminar la sección generada por el LLM (puede contener fuentes inventadas)
            cleanContent = cleanContent.replace(fuentesRegex, '').trim();
            // También limpiar variantes sin emoji
            cleanContent = cleanContent.replace(/\n*\*?Fuentes consultadas[:\s*][\s\S]*$/gim, '').trim();

            // Reconstruir sección de fuentes SOLO con las fuentes reales de ChromaDB
            if (validSourceNames.length > 0) {
                const fuentesControladas = validSourceNames.join(', ');
                cleanContent += `\n\n📚 *Fuentes consultadas: ${fuentesControladas}*`;
            }
        }

        llmResponse.content = cleanContent;

        // Clasificar si es entrega de trabajo o respuesta conversacional
        const isWorkContent = classifyAsWorkContent(cleanContent, canvasMode);

        const durationMs = typeof llmResponse.durationMs === 'number'
            ? llmResponse.durationMs
            : null;

        // Verificar que la conversación aún existe (puede haber sido borrada mientras el LLM procesaba)
        const conversationStillExists = await prisma.conversacion.findUnique({
            where: { id: conversation.id },
            select: { id: true },
        });

        if (!conversationStillExists) {
            // La conversación fue eliminada durante el procesamiento.
            // Devolver la respuesta igualmente para que el usuario la vea.
            console.warn(`⚠️ Conversación ${conversation.id} eliminada durante procesamiento LLM. Devolviendo respuesta sin guardar.`);
            return res.json({
                conversationId: null,
                intent: detectedIntent.id,
                title: null,
                message: {
                    role: 'assistant',
                    content: llmResponse.content,
                    isWorkContent,
                },
                usage: llmResponse.usage || null,
                deleted: true,
            });
        }

        const assistantMessageRecord = await prisma.mensajeConversacion.create({
            data: {
                conversacionId: conversation.id,
                rol: RolMensaje.ASISTENTE,
                contenido: llmResponse.content,
                intencion: detectedIntent.id,
                tokensEntrada: llmResponse.usage?.prompt_tokens || null,
                tokensSalida: llmResponse.usage?.completion_tokens || null,
                duracionMs: durationMs,
                metadatos: {
                    isWorkContent,
                    chromaResults: contextResults.map((item) => ({
                        id: item.id,
                        metadata: item.metadata || null,
                        distance: item.distance ?? null,
                    })),
                    llmRaw: llmResponse.raw,
                    userMessageId: userMessageRecord.id,
                    attempts: llmResponse.attempts || 1,
                },
            },
        });

        await prisma.conversacion.update({
            where: { id: conversation.id },
            data: {
                intencionPrincipal: detectedIntent.id,
                descripcion: conversation.descripcion || trimmedMessage.slice(0, 200),
            },
        });

        // Registrar coste de la generación IA en la tabla de costes
        registrarCosteGeneracion({
            llmResponse,
            usuarioId: req.user?.id || null,
            mensajeId: assistantMessageRecord.id,
            tipoOperacion: canvasMode ? 'canvas' : (useThinkingModel ? 'thinking' : (toolPasses > 0 ? 'tools' : 'chat')),
            exito: true,
        }).catch(err => console.warn('[CostTracking] Error registrando coste:', err.message));

        // Generar título automático con Gemma si es el primer mensaje del usuario
        let updatedTitle = null;
        if (previousHistory.length === 0 || previousHistory.length === 1) {
            // length === 1 significa que solo existe el saludo inicial del asistente
            try {
                const generatedTitle = await gemmaService.generateChatTitle(trimmedMessage);

                await prisma.conversacion.update({
                    where: { id: conversation.id },
                    data: { titulo: generatedTitle },
                });

                updatedTitle = generatedTitle;
                console.log(`✅ Título generado automáticamente: "${generatedTitle}"`);
            } catch (error) {
                console.warn(`⚠️ Error generando título: ${error.message}`);
            }
        }

        logChatEvent('info', {
            event: 'chat.completion.success',
            conversationId: conversation.id,
            userId: req.user?.id || null,
            intent: detectedIntent.id,
            durationMs: durationMs,
            attempts: llmResponse.attempts || 1,
            tokensEntrada: llmResponse.usage?.prompt_tokens || null,
            tokensSalida: llmResponse.usage?.completion_tokens || null,
            contextDocuments: contextResults.length,
        });

        // Obtener el título actual de la conversación (puede ser el recién generado o uno existente)
        const currentConversation = await prisma.conversacion.findUnique({
            where: { id: conversation.id },
            select: { titulo: true }
        });

        return res.json({
            conversationId: conversation.id,
            intent: detectedIntent.id,
            title: updatedTitle || currentConversation?.titulo,
            message: {
                id: assistantMessageRecord.id,
                role: 'assistant',
                content: assistantMessageRecord.contenido,
                isWorkContent,
            },
            usage: llmResponse.usage || null,
        });
    } catch (error) {
        console.error('❌ Error en /api/chat:', error);

        if (!conversation || !userMessageRecord) {
            return res.status(500).json({
                error: 'Error generando respuesta',
                message: error.message,
            });
        }

        // Detectar si es un error 429 (rate limit) o FK (conversación borrada)
        const is429Error = error.message.includes('429') || error.message.includes('maximum capacity');
        const isFKError = error.message.includes('Foreign key') || error.message.includes('P2003') || error.message.includes('P2025');
        const fallbackContent = is429Error ? RATE_LIMIT_MESSAGE : FALLBACK_MESSAGE;

        // Si la conversación fue borrada durante el procesamiento, no intentar guardar
        if (isFKError) {
            console.warn(`⚠️ Conversación ${conversation.id} eliminada durante procesamiento. No se guarda fallback.`);
            return res.status(200).json({
                conversationId: null,
                intent: detectedIntent.id,
                message: {
                    role: 'assistant',
                    content: fallbackContent,
                    isWorkContent: false,
                    fallback: true,
                },
                fallback: true,
                deleted: true,
            });
        }

        let assistantMessageRecord = null;
        try {
            // Verificar que la conversación sigue existiendo antes de guardar el fallback
            const convExists = await prisma.conversacion.findUnique({ where: { id: conversation.id }, select: { id: true } });
            if (!convExists) {
                console.warn(`⚠️ Conversación ${conversation.id} ya no existe. Devolviendo fallback sin guardar.`);
                return res.status(200).json({
                    conversationId: null,
                    intent: detectedIntent.id,
                    message: { role: 'assistant', content: fallbackContent, isWorkContent: false, fallback: true },
                    fallback: true,
                    deleted: true,
                });
            }

            assistantMessageRecord = await prisma.mensajeConversacion.create({
                data: {
                    conversacionId: conversation.id,
                    rol: RolMensaje.ASISTENTE,
                    contenido: fallbackContent,
                    intencion: detectedIntent.id,
                    tokensEntrada: null,
                    tokensSalida: null,
                    duracionMs: null,
                    metadatos: {
                        fallback: true,
                        error: error.message,
                        userMessageId: userMessageRecord.id,
                        contextDocuments: contextResults.length,
                    },
                },
            });

            await prisma.conversacion.update({
                where: { id: conversation.id },
                data: {
                    intencionPrincipal: detectedIntent.id,
                    descripcion: conversation.descripcion || message.slice(0, 200),
                },
            });
        } catch (storeError) {
            console.error('❌ Error registrando fallback del chat:', storeError);
        }

        logChatEvent('warn', {
            event: 'chat.completion.fallback',
            conversationId: conversation.id,
            userId: req.user?.id || null,
            intent: detectedIntent.id,
            reason: error.message,
            contextDocuments: contextResults.length,
        });

        return res.status(200).json({
            conversationId: conversation.id,
            intent: detectedIntent.id,
            message: {
                id: assistantMessageRecord?.id,
                role: 'assistant',
                content: assistantMessageRecord?.contenido || FALLBACK_MESSAGE,
                isWorkContent: false,
                fallback: true,
            },
            fallback: true,
            error: error.message,
        });
    }
});

// Renombrar una conversación
router.patch('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const { titulo } = req.body || {};

    try {
        if (!titulo || typeof titulo !== 'string' || titulo.trim().length === 0) {
            return res.status(400).json({
                error: 'Título inválido',
                message: 'El título no puede estar vacío',
            });
        }

        const conversation = await prisma.conversacion.findUnique({
            where: { id },
            select: { id: true, usuarioId: true },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        if (conversation.usuarioId && conversation.usuarioId !== userId) {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'No puedes renombrar esta conversación',
            });
        }

        const trimmedTitle = titulo.trim().substring(0, 200);

        await prisma.conversacion.update({
            where: { id },
            data: { titulo: trimmedTitle },
        });

        logChatEvent('info', {
            event: 'chat.conversation.renamed',
            conversationId: id,
            userId,
            newTitle: trimmedTitle,
        });

        return res.json({ success: true, titulo: trimmedTitle });
    } catch (error) {
        console.error('❌ Error renombrando conversación:', error);
        return res.status(500).json({
            error: 'No se pudo renombrar la conversación',
            message: error.message,
        });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id || null;

    try {
        const conversation = await prisma.conversacion.findUnique({
            where: { id },
            select: {
                id: true,
                usuarioId: true,
            },
        });

        if (!conversation) {
            return res.status(404).json({
                error: 'Conversación no encontrada',
            });
        }

        if (conversation.usuarioId && conversation.usuarioId !== userId) {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'No puedes eliminar esta conversación',
            });
        }

        // Eliminar colección temporal de ChromaDB
        try {
            await chromaService.deleteTemporaryCollection(id);
            console.log(`✅ Colección temporal eliminada para conversación ${id}`);
        } catch (error) {
            console.warn(`⚠️ Error eliminando colección temporal: ${error.message}`);
        }

        await prisma.conversacion.delete({ where: { id } });

        logChatEvent('info', {
            event: 'chat.conversation.deleted',
            conversationId: id,
            userId,
        });

        return res.json({ success: true });
    } catch (error) {
        logChatEvent('error', {
            event: 'chat.conversation.delete.error',
            conversationId: id,
            userId,
            message: error.message,
        });

        return res.status(500).json({
            error: 'No se pudo eliminar la conversación',
            message: error.message,
        });
    }
});

// Crear una nueva conversación con saludo inicial
router.post('/create', authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const userName = req.user?.nombre || 'Usuario';
        const userLanguage = req.user?.idioma || 'es';
        const { intent } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        // Validar límites de conversaciones (igual que en POST /api/chat)
        const userRole = req.user?.rol || 'USUARIO';
        const tipoSuscripcion = req.user?.tipoSuscripcion || 'FREE';
        const limitCheck = await validateUserLimits(userId, userRole, null, tipoSuscripcion);

        if (!limitCheck.allowed) {
            return res.status(429).json({
                error: limitCheck.reason,
                message: limitCheck.message,
                stats: await getUserStats(userId, userRole, tipoSuscripcion),
            });
        }

        // Resolver intención
        const detectedIntent = intent ? resolveIntent(intent) : DEFAULT_INTENT;

        // Crear la conversación con saludo inicial
        const conversation = await ensureConversation({
            conversationId: null,
            userId,
            intent: detectedIntent,
            userName,
            userLanguage,
        });

        // Incrementar contador diario inmutable de chats creados
        await incrementDailyUsage(userId, 'chatsCreados').catch(err => {
            console.warn('⚠️ Error incrementando chats diarios:', err.message);
        });

        // Obtener los mensajes (debería incluir el saludo inicial)
        const messages = await prisma.mensajeConversacion.findMany({
            where: { conversacionId: conversation.id },
            orderBy: { fechaCreacion: 'desc' },
            take: 1,
        });

        logChatEvent('info', {
            event: 'chat.conversation.created',
            conversationId: conversation.id,
            userId,
            intent: detectedIntent.id,
        });

        return res.json({
            conversationId: conversation.id,
            intent: detectedIntent.id,
            messages: messages.map(msg => ({
                id: msg.id,
                role: msg.rol === RolMensaje.ASISTENTE ? 'assistant' : 'user',
                content: msg.contenido,
                fechaCreacion: msg.fechaCreacion,
            })),
        });
    } catch (error) {
        console.error('❌ Error creando conversación:', error);
        return res.status(500).json({
            error: 'Error creando conversación',
            message: error.message,
        });
    }
});

export default router;
