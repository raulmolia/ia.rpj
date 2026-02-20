// Rutas para gestionar el feedback de mensajes del asistente
import express from 'express';
import prismaPackage from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const { PrismaClient, TipoFeedback } = prismaPackage;
const router = express.Router();
const prisma = new PrismaClient();

// POST /api/feedback — Crear o actualizar feedback de un mensaje
router.post('/', authenticate, async (req, res) => {
    const { mensajeId, tipo, intencion } = req.body || {};

    if (!mensajeId || !tipo) {
        return res.status(400).json({
            error: 'Datos incompletos',
            message: 'Se requiere mensajeId y tipo (POSITIVO o NEGATIVO)',
        });
    }

    if (!['POSITIVO', 'NEGATIVO'].includes(tipo)) {
        return res.status(400).json({
            error: 'Tipo inválido',
            message: 'El tipo debe ser POSITIVO o NEGATIVO',
        });
    }

    try {
        // Verificar que el mensaje existe y pertenece a una conversación del usuario
        const mensaje = await prisma.mensajeConversacion.findUnique({
            where: { id: mensajeId },
            include: {
                conversacion: { select: { usuarioId: true, intencionPrincipal: true } },
            },
        });

        if (!mensaje) {
            return res.status(404).json({ error: 'Mensaje no encontrado' });
        }

        if (mensaje.conversacion.usuarioId !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permisos para esta acción' });
        }

        // Upsert: crear o actualizar
        const feedback = await prisma.feedbackMensaje.upsert({
            where: {
                mensajeId_usuarioId: { mensajeId, usuarioId: req.user.id },
            },
            update: {
                tipo: TipoFeedback[tipo],
                intencion: intencion || mensaje.conversacion.intencionPrincipal || mensaje.intencion,
            },
            create: {
                mensajeId,
                usuarioId: req.user.id,
                tipo: TipoFeedback[tipo],
                intencion: intencion || mensaje.conversacion.intencionPrincipal || mensaje.intencion,
            },
        });

        return res.json({
            message: 'Feedback guardado correctamente',
            feedback: { id: feedback.id, tipo: feedback.tipo },
        });
    } catch (error) {
        console.error('❌ Error guardando feedback:', error);
        return res.status(500).json({
            error: 'Error interno',
            message: 'No se pudo guardar el feedback',
        });
    }
});

// DELETE /api/feedback/:mensajeId — Eliminar feedback de un mensaje
router.delete('/:mensajeId', authenticate, async (req, res) => {
    const { mensajeId } = req.params;

    try {
        await prisma.feedbackMensaje.deleteMany({
            where: {
                mensajeId,
                usuarioId: req.user.id,
            },
        });

        return res.json({ message: 'Feedback eliminado' });
    } catch (error) {
        console.error('❌ Error eliminando feedback:', error);
        return res.status(500).json({
            error: 'Error interno',
            message: 'No se pudo eliminar el feedback',
        });
    }
});

// GET /api/feedback/stats — Estadísticas de feedback (admin)
router.get('/stats', authenticate, async (req, res) => {
    const ADMIN_ROLES = ['SUPERADMIN', 'ADMINISTRADOR'];
    if (!ADMIN_ROLES.includes(req.user.rol)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    try {
        const [total, positivos, negativos, porIntencion, recientes] = await Promise.all([
            prisma.feedbackMensaje.count(),
            prisma.feedbackMensaje.count({ where: { tipo: 'POSITIVO' } }),
            prisma.feedbackMensaje.count({ where: { tipo: 'NEGATIVO' } }),
            prisma.feedbackMensaje.groupBy({
                by: ['intencion', 'tipo'],
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            }),
            prisma.feedbackMensaje.findMany({
                take: 20,
                orderBy: { fechaCreacion: 'desc' },
                include: {
                    mensaje: {
                        select: {
                            contenido: true,
                            intencion: true,
                            conversacion: {
                                select: { titulo: true },
                            },
                        },
                    },
                },
            }),
        ]);

        // Agrupar por intención
        const feedbackPorIntencion = {};
        for (const item of porIntencion) {
            const intent = item.intencion || 'SIN_INTENCION';
            if (!feedbackPorIntencion[intent]) {
                feedbackPorIntencion[intent] = { positivo: 0, negativo: 0 };
            }
            feedbackPorIntencion[intent][item.tipo.toLowerCase()] = item._count.id;
        }

        return res.json({
            total,
            positivos,
            negativos,
            porcentajePositivo: total > 0 ? Math.round((positivos / total) * 100) : 0,
            feedbackPorIntencion,
            recientes: recientes.map((f) => ({
                id: f.id,
                tipo: f.tipo,
                intencion: f.intencion,
                fecha: f.fechaCreacion,
                tituloConversacion: f.mensaje?.conversacion?.titulo || null,
                extractoMensaje: f.mensaje?.contenido?.slice(0, 150) || null,
            })),
        });
    } catch (error) {
        console.error('❌ Error obteniendo stats de feedback:', error);
        return res.status(500).json({
            error: 'Error interno',
            message: 'No se pudieron obtener las estadísticas de feedback',
        });
    }
});

export default router;
