import express from 'express';
import prismaPackage from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import chromaService from '../services/chromaService.js';
import { callChatCompletion, MODELS } from '../services/llmService.js';
import gemmaService from '../services/gemmaService.js';
import logService from '../services/logService.js';
import { hasActiveCanvaConnector, CANVA_TOOLS, executeCanvaTool } from '../services/canvaConnectorService.js';
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
        maxMessagesPerConversation: 5,
        maxDailyInteractions: 15,
        maxDailyChats: 3,
        hasTools: false, // Sin acceso a herramientas
    },
    PRO: {
        maxConversations: 50,
        maxMessagesPerConversation: 30,
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

// Función para obtener estadísticas de uso del usuario
async function getUserStats(userId, userRole, tipoSuscripcion = 'FREE') {
    const limits = getUserLimits(userRole, tipoSuscripcion);

    // Contar conversaciones totales (activas + archivadas)
    const totalConversations = await prisma.conversacion.count({
        where: { usuarioId: userId },
    });

    // Obtener mensajes del usuario de hoy para límite diario
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyMessages = await prisma.mensajeConversacion.count({
        where: {
            conversacion: { usuarioId: userId },
            rol: RolMensaje.USUARIO,
            fechaCreacion: { gte: today },
        },
    });

    // Contar chats creados hoy
    const dailyChats = await prisma.conversacion.count({
        where: {
            usuarioId: userId,
            fechaCreacion: { gte: today },
        },
    });

    return {
        conversations: {
            current: totalConversations,
            max: limits.maxConversations,
            available: limits.maxConversations ? Math.max(0, limits.maxConversations - totalConversations) : null,
        },
        dailyChats: {
            current: dailyChats,
            max: limits.maxDailyChats,
            available: limits.maxDailyChats ? Math.max(0, limits.maxDailyChats - dailyChats) : null,
        },
        dailyInteractions: {
            current: dailyMessages,
            max: limits.maxDailyInteractions,
            available: limits.maxDailyInteractions ? Math.max(0, limits.maxDailyInteractions - dailyMessages) : null,
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

    // Validar límite de mensajes por conversación
    if (conversationId && limits.maxMessagesPerConversation) {
        const messagesInConversation = await prisma.mensajeConversacion.count({
            where: {
                conversacionId: conversationId,
                rol: RolMensaje.USUARIO,
            },
        });

        if (messagesInConversation >= limits.maxMessagesPerConversation) {
            return {
                allowed: false,
                reason: 'MAX_MESSAGES_PER_CONVERSATION',
                message: `Has alcanzado el límite de ${limits.maxMessagesPerConversation} mensajes en esta conversación. Crea una nueva.`,
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
    const { message, conversationId, intent: rawIntent, tags: clientTags, useThinkingModel, attachments, canvasMode, useCanvaTools, useGoogleDriveTools, useGoogleDocsTools } = req.body || {};

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

        // ── Conectores: comprobar Canva / Google Drive / Google Docs ──
        const userIsPro = tipoSuscripcion === 'PRO' || USER_LIMITS[userRole]?.hasTools;
        let activeTools = [];
        let canvaToolsActive = false;
        let googleDriveToolsActive = false;
        let googleDocsToolsActive = false;

        // ── Google Drive tools ──
        if (userIsPro && req.user?.id && useGoogleDriveTools === true) {
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
        if (userIsPro && req.user?.id && useGoogleDocsTools === true) {
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

        // ── Canva tools ──
        if (userIsPro && req.user?.id && useCanvaTools === true) {
            try {
                const canvaActive = await hasActiveCanvaConnector(req.user.id);
                if (canvaActive) {
                    activeTools = [...activeTools, ...CANVA_TOOLS];
                    canvaToolsActive = true;
                    llmMessages.push({
                        role: 'system',
                        content:
                            'El usuario ha activado la integración con Canva. Tienes acceso a herramientas para crear lienzos en Canva.\n\n' +
                            'IMPORTANTE: La API de Canva crea LIENZOS EN BLANCO del formato correcto. ' +
                            'Tu trabajo es proporcionar contenido útil que el usuario pueda usar para rellenar el diseño.\n\n' +
                            'HERRAMIENTAS DISPONIBLES:\n' +
                            '• canva_create_designs — crea varios lienzos del MISMO tipo en Canva\n' +
                            '• canva_list_designs — lista los diseños existentes del usuario\n' +
                            '• canva_get_design — obtiene detalles de un diseño por su ID\n' +
                            '• canva_export_design — exporta un diseño como PDF, PNG o JPG\n\n' +
                            'FLUJO OBLIGATORIO CUANDO EL USUARIO PIDE CREAR UN DISEÑO:\n' +
                            '1. USA canva_create_designs con count=3 y el design_type correcto. Mapeo:\n' +
                            '   - cartel/póster/afiche/portada → poster\n' +
                            '   - presentación/diapositivas → presentation\n' +
                            '   - pizarra/brainstorming → whiteboard\n' +
                            '   - documento/hoja/folio → doc\n' +
                            '   - banner/cabecera/pancarta → banner\n' +
                            '   - folleto/flyer/volante → flyer\n' +
                            '   - post/publicación redes → social_post\n' +
                            '   - historia/story → story\n' +
                            '   - tarjeta/invitación/postal → card\n' +
                            '2. title_base SIEMPRE descriptivo del tema.\n' +
                            '3. NUNCA crees un diseño de cada tipo distinto. SIEMPRE 3 del MISMO tipo.\n' +
                            '4. DESPUÉS de crear los lienzos, genera una respuesta RICA con:\n' +
                            '   a) TEXTOS SUGERIDOS: título principal, subtítulo y textos que el usuario debería poner en el diseño.\n' +
                            '   b) PALETA DE COLORES: 3-4 colores recomendados con códigos hex.\n' +
                            '   c) ELEMENTOS SUGERIDOS: qué imágenes, iconos o elementos visuales usar.\n' +
                            '   d) ESTRUCTURA/LAYOUT: descripción breve de cómo organizar los elementos.\n' +
                            '   e) ENLACE A PLANTILLAS: incluye este enlace para buscar plantillas: ' +
                            '`https://www.canva.com/templates/?query=TÉRMINO_DE_BÚSQUEDA` ' +
                            'reemplazando TÉRMINO_DE_BÚSQUEDA por palabras clave relevantes en inglés separadas por +.\n' +
                            '   f) Indica que los lienzos se han creado en su cuenta de Canva con el formato correcto, ' +
                            'listos para personalizar con las sugerencias anteriores o usando una plantilla.\n' +
                            '5. Los cards con enlaces a los lienzos se muestran automáticamente en la interfaz, NO los repitas en el texto.',
                    });
                    console.log('[Canva] Tools inyectadas al LLM');
                }
            } catch (e) {
                console.error('[Canva] Error activando tools:', e.message);
            }
        }

        // ── Inyectar contexto documental SOLO si NO hay tools Canva activas ──
        // Cuando Canva está activo, las fuentes documentales no aportan nada y ensucian la respuesta
        if (!canvaToolsActive && contextPrompt) {
            llmMessages.push({ role: 'system', content: contextPrompt });
        }

        // Historial previo de la conversación
        if (previousHistory.length > 0) {
            llmMessages.push(...previousHistory);
        }

        // Añadir mensaje del usuario
        llmMessages.push({ role: 'user', content: trimmedMessage });

        // ── Detectar si el usuario pide crear/diseñar algo en Canva ──
        // Si detectamos intención de creación, forzamos tool_choice = "required"
        // para que el modelo NO simule la creación sino que llame a la tool real.
        const CANVA_CREATION_REGEX = /\b(cre[aá]|crear|dise[ñn]|diseñar|haz|hacer|genera|generar|prepar[aáe]|necesito|quiero|hazme|dame|elabor[aáe])\b[\s\S]{0,60}\b(cartel|p[oó]ster|poster|presentaci[oó]n|diapositiva|pizarra|whiteboard|documento|banner|folleto|flyer|post|historia|story|tarjeta|invitaci[oó]n|portada|afiche|cancionero|díptico|tríptico|pancarta|cabecera)\b/i;
        const userWantsCanvaCreation = activeTools.length > 0 && CANVA_CREATION_REGEX.test(trimmedMessage);
        const toolChoiceSetting = userWantsCanvaCreation ? 'required' : 'auto';

        if (userWantsCanvaCreation) {
            console.log('[Canva] Intención de creación detectada → tool_choice: required');
        }

        const llmCallOptions = {
            messages: llmMessages,
            model: useThinkingModel === true ? MODELS.THINKING : (activeTools.length > 0 ? MODELS.TOOLS : undefined),
            useThinking: useThinkingModel === true,
            // Los modelos de razonamiento (thinking) no admiten tools
            ...(activeTools.length > 0 && !useThinkingModel
                ? { extraBody: { tools: activeTools, tool_choice: toolChoiceSetting, parallel_tool_calls: true } }
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
            console.log(`[Canva] Respuesta LLM: finishReason=${llmResponse.finishReason}, toolCalls=${llmResponse.toolCalls?.length || 0}, contentLength=${(llmResponse.content || '').length}`);
        }

        // ── Retry: si el modelo respondió con texto pero debía haber llamado tools ──
        // Detectar si el modelo "simuló" crear diseños sin llamar realmente a ninguna tool
        if (
            activeTools.length > 0 &&
            llmResponse.finishReason !== 'tool_calls' &&
            (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) &&
            (userWantsCanvaCreation || /\b(he creado|creado.*diseño|creé|diseños.*canva)\b/i.test(llmResponse.content || ''))
        ) {
            console.warn('[Canva] ⚠️ Modelo respondió con texto sin llamar tools. Reintentando con tool_choice: required');
            try {
                llmResponse = await callChatCompletion({
                    ...llmCallOptions,
                    extraBody: { tools: activeTools, tool_choice: 'required', parallel_tool_calls: true },
                });
            } catch (retryError) {
                console.error('[Canva] ❌ Retry con tool_choice:required también falló:', retryError.message);
                // Mantener la respuesta original del primer intento
            }
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
                        toolResult = await executeCanvaTool(req.user.id, toolName, toolArgs);
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
                        // Si es un array (createMultipleDesigns), formatear cada diseño
                        if (Array.isArray(result)) {
                            return result.map(d => {
                                if (d.edit_url) return `- **${d.title || d.type_label || 'Diseño'}**: [Abrir en Canva](${d.edit_url})`;
                                if (d.error) return `- Error: ${d.error}`;
                                return `- ${JSON.stringify(d)}`;
                            }).join('\n');
                        }
                        if (result.edit_url) {
                            return `- **${result.title || result.type_label || 'Diseño'}**: [Abrir en Canva](${result.edit_url})`;
                        }
                        if (result.error) return `- Error: ${result.error}`;
                        return `- ${JSON.stringify(result)}`;
                    } catch { return `- ${m.content}`; }
                }).join('\n');
                if (toolResultsText) {
                    llmResponse = {
                        content: `He creado los diseños en Canva. Aquí tienes los enlaces:\n\n${toolResultsText}`,
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

        // Si hay tools Canva activas, eliminar secciones de "Fuentes consultadas" que no aplican
        if (canvaToolsActive) {
            cleanContent = cleanContent.replace(/\n*📚\s*\*?Fuentes consultadas[:\s].*$/gims, '').trim();
            cleanContent = cleanContent.replace(/\n*\*?Fuentes consultadas[:\s].*$/gims, '').trim();
        } else {
            // ── Post-procesado de fuentes: reemplazar sección del LLM por una controlada ──
            // Esto garantiza que SOLO se citen documentos realmente proporcionados por ChromaDB
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
            // Si no hay fuentes válidas, no se añade la sección (correcto)
        }

        llmResponse.content = cleanContent;

        // ── Extraer diseños de Canva de los resultados de tools ──
        let canvaDesigns = [];
        let toolSteps = [];
        let templateSearchUrl = null;
        if (toolPasses > 0) {
            const toolMessages = llmMessages.filter(m => m.role === 'tool');
            for (const tm of toolMessages) {
                try {
                    const parsed = JSON.parse(tm.content);
                    // Nuevo formato: createMultipleDesigns devuelve { designs: [...], template_search_url, ... }
                    if (parsed.designs && Array.isArray(parsed.designs)) {
                        const designs = parsed.designs.filter(d => d.edit_url && !d.error);
                        canvaDesigns.push(...designs);
                        if (parsed.template_search_url) templateSearchUrl = parsed.template_search_url;
                        if (designs.length > 0) {
                            toolSteps.push({
                                tool: 'canva_create_designs',
                                status: 'success',
                                summary: `Creados ${designs.length} lienzo(s) de tipo ${parsed.design_type_label || designs[0]?.type_label || 'desconocido'}`,
                            });
                        }
                        // Registrar errores individuales
                        const errors = parsed.designs.filter(d => d.error);
                        for (const e of errors) {
                            toolSteps.push({ tool: 'canva', status: 'error', summary: e.error });
                        }
                    }
                    // Compatibilidad: formato antiguo array directo
                    else if (Array.isArray(parsed)) {
                        const designs = parsed.filter(d => d.edit_url && !d.error);
                        canvaDesigns.push(...designs);
                        if (designs.length > 0) {
                            toolSteps.push({
                                tool: 'canva_create_designs',
                                status: 'success',
                                summary: `Creados ${designs.length} diseño(s)`,
                            });
                        }
                    } else if (parsed.edit_url && !parsed.error) {
                        canvaDesigns.push(parsed);
                        toolSteps.push({
                            tool: 'canva_get_design',
                            status: 'success',
                            summary: `Diseño: ${parsed.title || 'Sin título'}`,
                        });
                    } else if (parsed.error) {
                        toolSteps.push({ tool: 'canva', status: 'error', summary: parsed.error });
                    }
                } catch { /* no parseable, ignorar */ }
            }
            console.log(`[Canva] Diseños extraídos: ${canvaDesigns.length}, Pasos: ${toolSteps.length}, Templates: ${templateSearchUrl ? 'sí' : 'no'}`);
        }

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
                    canvaDesigns: canvaDesigns.length > 0 ? canvaDesigns : undefined,
                    toolSteps: toolSteps.length > 0 ? toolSteps : undefined,
                    templateSearchUrl: templateSearchUrl || undefined,
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
                role: 'assistant',
                content: assistantMessageRecord.contenido,
                isWorkContent,
                canvaDesigns: canvaDesigns.length > 0 ? canvaDesigns : undefined,
                toolSteps: toolSteps.length > 0 ? toolSteps : undefined,
                templateSearchUrl: templateSearchUrl || undefined,
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
