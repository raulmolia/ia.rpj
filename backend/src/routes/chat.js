import express from 'express';
import prismaPackage from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import chromaService from '../services/chromaService.js';
import { callChatCompletion } from '../services/llmService.js';
import gemmaService from '../services/gemmaService.js';
import {
    detectIntentFromText,
    resolveIntent,
    DEFAULT_INTENT,
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

// Límites por rol
const USER_LIMITS = {
    SUPERADMIN: {
        maxConversations: null, // Sin límite
        maxMessagesPerConversation: null, // Sin límite
        maxDailyInteractions: null, // Sin límite
        maxDailyChats: null, // Sin límite
    },
    ADMINISTRADOR: {
        maxConversations: null,
        maxMessagesPerConversation: null,
        maxDailyInteractions: null,
        maxDailyChats: null,
    },
    DOCUMENTADOR: {
        maxConversations: 10,
        maxMessagesPerConversation: null, // Sin límite
        maxDailyInteractions: null, // Sin límite
        maxDailyChats: null, // Sin límite
    },
    DOCUMENTADOR_JUNIOR: {
        maxConversations: 10,
        maxMessagesPerConversation: null, // Sin límite
        maxDailyInteractions: null, // Sin límite
        maxDailyChats: null, // Sin límite
    },
    USUARIO: {
        maxConversations: 7,
        maxMessagesPerConversation: 5,
        maxDailyInteractions: 15,
        maxDailyChats: 3,
    },
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
        fechaCreacion: conversation.fechaCreacion,
        fechaActualizacion: conversation.fechaActualizacion,
    };
}

function sanitizeMessage(message) {
    return {
        id: message.id,
        role: mapRoleToOpenAI(message.rol),
        content: message.contenido,
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

    return `Contexto documental relevante:\n\n${sections.join('\n\n')}\n\nUsa estas referencias para complementar la respuesta sin copiar literalmente. No inventes datos.`;
}

function logChatEvent(level = 'info', payload = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        source: 'chat-api',
        ...payload,
    };

    if (level === 'error') {
        console.error(entry);
    } else if (level === 'warn') {
        console.warn(entry);
    } else {
        console.info(entry);
    }
}

async function ensureConversation({ conversationId, userId, intent, userName }) {
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

    // Crear mensaje inicial estático del asistente
    if (userName) {
        try {
            const greeting = `Hola ${userName}, ¿en qué puedo ayudarte?`;
            
            // Crear mensaje inicial del asistente
            await prisma.mensajeConversacion.create({
                data: {
                    conversacionId: newConversation.id,
                    rol: RolMensaje.ASISTENTE,
                    contenido: greeting,
                    intencion: intent?.id || DEFAULT_INTENT.id,
                },
            });
            
            console.log(`✅ Saludo inicial creado para ${userName}`);
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
async function getUserStats(userId, userRole) {
    const limits = USER_LIMITS[userRole] || USER_LIMITS.USUARIO;

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
    };
}

// Función para validar límites antes de crear/enviar
async function validateUserLimits(userId, userRole, conversationId = null) {
    const limits = USER_LIMITS[userRole] || USER_LIMITS.USUARIO;
    const stats = await getUserStats(userId, userRole);

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

    // Validar límite de chats diarios (solo si es nueva conversación)
    if (!conversationId && limits.maxDailyChats) {
        if (stats.dailyChats.current >= limits.maxDailyChats) {
            return {
                allowed: false,
                reason: 'MAX_DAILY_CHATS',
                message: `Has alcanzado el límite de ${limits.maxDailyChats} chats diarios. Vuelve mañana para crear más.`,
            };
        }
    }

    // Validar límite diario
    if (limits.maxDailyInteractions) {
        if (stats.dailyInteractions.current >= limits.maxDailyInteractions) {
            return {
                allowed: false,
                reason: 'MAX_DAILY_INTERACTIONS',
                message: `Has alcanzado el límite diario de ${limits.maxDailyInteractions} interacciones. Vuelve mañana.`,
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
        const stats = await getUserStats(req.user.id, userRole);
        
        return res.json({
            role: userRole,
            limits: USER_LIMITS[userRole],
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
    const { message, conversationId, intent: rawIntent, tags: clientTags, useThinkingModel, attachments } = req.body || {};

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
        const limitCheck = await validateUserLimits(req.user.id, userRole, conversationId);
        
        if (!limitCheck.allowed) {
            return res.status(429).json({
                error: limitCheck.reason,
                message: limitCheck.message,
                stats: await getUserStats(req.user.id, userRole),
            });
        }

        const trimmedMessage = message.trim();
        detectedIntent = rawIntent
            ? resolveIntent(rawIntent)
            : detectIntentFromText(trimmedMessage);

        const conversation = await ensureConversation({
            conversationId,
            userId: req.user?.id || null,
            intent: detectedIntent,
            userName: req.user?.nombre || 'Usuario',
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

        // Combinar y ordenar por relevancia (distancia)
        contextResults = [...documentResults, ...webResults, ...tempResults]
            .sort((a, b) => (a.distance || 999) - (b.distance || 999))
            .slice(0, 5);

        let contextPrompt = buildContextFromChroma(contextResults);

        // Agregar contenido de archivos adjuntos al contexto
        if (attachments && attachments.length > 0) {
            const attachmentsContext = attachments
                .map(file => `--- Archivo: ${file.fileName} ---\n${file.text}`)
                .join('\n\n');
            
            const attachmentsHeader = '\n\n=== ARCHIVOS ADJUNTOS POR EL USUARIO ===\n\n';
            contextPrompt = attachmentsHeader + attachmentsContext + (contextPrompt ? '\n\n' + contextPrompt : '');
        }

        const llmMessages = [
            { role: 'system', content: detectedIntent.systemPrompt },
        ];

        if (contextPrompt) {
            llmMessages.push({ role: 'system', content: contextPrompt });
        }

        if (previousHistory.length > 0) {
            llmMessages.push(...previousHistory);
        }

        llmMessages.push({ role: 'user', content: trimmedMessage });

        let llmResponse;
        try {
            llmResponse = await callChatCompletion({
                messages: llmMessages,
                model: useThinkingModel === true ? 'moonshotai/Kimi-K2-Thinking' : undefined,
            });
        } catch (error) {
            throw new Error(`El modelo no pudo generar una respuesta: ${error.message}`);
        }

        const durationMs = typeof llmResponse.durationMs === 'number'
            ? llmResponse.durationMs
            : null;
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

        // Detectar si es un error 429 (rate limit)
        const is429Error = error.message.includes('429');
        const fallbackContent = is429Error ? RATE_LIMIT_MESSAGE : FALLBACK_MESSAGE;

        let assistantMessageRecord = null;
        try {
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

        if (!conversation.usuarioId || conversation.usuarioId !== userId) {
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
