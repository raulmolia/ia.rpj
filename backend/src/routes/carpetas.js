// Rutas para Carpetas de Trabajo (solo Pro)
import express from 'express';
import prismaPackage from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import logService from '../services/logService.js';

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();
const router = express.Router();

// Middleware: requiere autenticación en todas las rutas
router.use(authenticate);

// Helper: verificar si es Pro o privilegiado
function isPro(user) {
    return user.tipoSuscripcion === 'PRO' || ['SUPERADMIN', 'ADMINISTRADOR', 'DOCUMENTADOR'].includes(user.rol);
}

// ────────────────────────────────────────────────────────
// GET / — Listar carpetas propias + compartidas
// ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        if (!isPro(req.user)) {
            return res.status(403).json({ error: 'Función exclusiva para usuarios Pro' });
        }

        // Carpetas propias
        const propias = await prisma.carpetaTrabajo.findMany({
            where: { usuarioId: req.user.id },
            include: {
                conversaciones: {
                    select: { id: true, titulo: true, fechaActualizacion: true, categoria: true },
                    orderBy: { fechaActualizacion: 'desc' },
                },
                compartidas: {
                    include: {
                        usuario: { select: { id: true, nombre: true, email: true } },
                    },
                },
                _count: { select: { notificaciones: { where: { usuarioId: req.user.id, leida: false } } } },
            },
            orderBy: { fechaActualizacion: 'desc' },
        });

        // Carpetas compartidas conmigo
        const compartidas = await prisma.carpetaCompartida.findMany({
            where: { usuarioId: req.user.id },
            include: {
                carpeta: {
                    include: {
                        conversaciones: {
                            select: { id: true, titulo: true, fechaActualizacion: true, categoria: true },
                            orderBy: { fechaActualizacion: 'desc' },
                        },
                        usuario: { select: { id: true, nombre: true, email: true } },
                        compartidas: {
                            include: {
                                usuario: { select: { id: true, nombre: true, email: true } },
                            },
                        },
                        _count: { select: { notificaciones: { where: { usuarioId: req.user.id, leida: false } } } },
                    },
                },
            },
        });

        const carpetasCompartidas = compartidas.map((c) => ({
            ...c.carpeta,
            permisos: c.permisos,
            esCompartida: true,
        }));

        res.json({
            propias: propias.map((c) => ({ ...c, esCompartida: false })),
            compartidas: carpetasCompartidas,
        });
    } catch (error) {
        console.error('Error al obtener carpetas:', error);
        res.status(500).json({ error: 'Error al obtener las carpetas de trabajo' });
    }
});

// ────────────────────────────────────────────────────────
// POST / — Crear carpeta
// ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        if (!isPro(req.user)) {
            return res.status(403).json({ error: 'Función exclusiva para usuarios Pro' });
        }

        const { nombre, icono, color } = req.body;

        if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const carpeta = await prisma.carpetaTrabajo.create({
            data: {
                nombre: nombre.trim().substring(0, 100),
                icono: icono || 'FolderOpen',
                color: color || '#f59e0b',
                usuarioId: req.user.id,
            },
        });

        await logService.log('carpetas.crear', req.user.id, { carpetaId: carpeta.id, nombre: carpeta.nombre });

        res.status(201).json(carpeta);
    } catch (error) {
        console.error('Error al crear carpeta:', error);
        res.status(500).json({ error: 'Error al crear la carpeta' });
    }
});

// ────────────────────────────────────────────────────────
// PATCH /:id — Actualizar carpeta (nombre, icono, color)
// ────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
    try {
        const carpeta = await prisma.carpetaTrabajo.findUnique({ where: { id: req.params.id } });

        if (!carpeta) {
            return res.status(404).json({ error: 'Carpeta no encontrada' });
        }

        // Solo el propietario o un compartido con escritura puede editar
        const esOwner = carpeta.usuarioId === req.user.id;
        let tieneEscritura = false;
        if (!esOwner) {
            const compartida = await prisma.carpetaCompartida.findUnique({
                where: { carpetaId_usuarioId: { carpetaId: carpeta.id, usuarioId: req.user.id } },
            });
            tieneEscritura = compartida?.permisos === 'escritura';
        }

        if (!esOwner && !tieneEscritura) {
            return res.status(403).json({ error: 'No tienes permisos para editar esta carpeta' });
        }

        const { nombre, icono, color } = req.body;
        const data = {};
        if (nombre && typeof nombre === 'string') data.nombre = nombre.trim().substring(0, 100);
        if (icono) data.icono = icono;
        if (color) data.color = color;

        const updated = await prisma.carpetaTrabajo.update({
            where: { id: req.params.id },
            data,
        });

        // Notificar a los demás usuarios compartidos
        if (!esOwner || Object.keys(data).length > 0) {
            await _notifySharedUsers(carpeta.id, req.user.id, 'cambio', `Se actualizó la carpeta "${updated.nombre}"`);
        }

        res.json(updated);
    } catch (error) {
        console.error('Error al actualizar carpeta:', error);
        res.status(500).json({ error: 'Error al actualizar la carpeta' });
    }
});

// ────────────────────────────────────────────────────────
// DELETE /:id — Eliminar carpeta (solo propietario)
// ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const carpeta = await prisma.carpetaTrabajo.findUnique({ where: { id: req.params.id } });

        if (!carpeta) {
            return res.status(404).json({ error: 'Carpeta no encontrada' });
        }

        if (carpeta.usuarioId !== req.user.id) {
            return res.status(403).json({ error: 'Solo el propietario puede eliminar la carpeta' });
        }

        // Primero quitar carpetaId de todas las conversaciones
        await prisma.conversacion.updateMany({
            where: { carpetaId: carpeta.id },
            data: { carpetaId: null },
        });

        await prisma.carpetaTrabajo.delete({ where: { id: req.params.id } });

        await logService.log('carpetas.eliminar', req.user.id, { carpetaId: carpeta.id, nombre: carpeta.nombre });

        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar carpeta:', error);
        res.status(500).json({ error: 'Error al eliminar la carpeta' });
    }
});

// ────────────────────────────────────────────────────────
// POST /:id/conversaciones — Añadir chat a carpeta
// ────────────────────────────────────────────────────────
router.post('/:id/conversaciones', async (req, res) => {
    try {
        const { conversacionId } = req.body;

        if (!conversacionId) {
            return res.status(400).json({ error: 'conversacionId es obligatorio' });
        }

        const carpeta = await prisma.carpetaTrabajo.findUnique({ where: { id: req.params.id } });
        if (!carpeta) {
            return res.status(404).json({ error: 'Carpeta no encontrada' });
        }

        // Verificar acceso (propietario o escritura)
        const esOwner = carpeta.usuarioId === req.user.id;
        if (!esOwner) {
            const compartida = await prisma.carpetaCompartida.findUnique({
                where: { carpetaId_usuarioId: { carpetaId: carpeta.id, usuarioId: req.user.id } },
            });
            if (!compartida || compartida.permisos !== 'escritura') {
                return res.status(403).json({ error: 'No tienes permisos para añadir chats a esta carpeta' });
            }
        }

        // Verificar que la conversación pertenece al usuario
        const conversacion = await prisma.conversacion.findUnique({ where: { id: conversacionId } });
        if (!conversacion || conversacion.usuarioId !== req.user.id) {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }

        await prisma.conversacion.update({
            where: { id: conversacionId },
            data: { carpetaId: carpeta.id },
        });

        // Notificar cambio
        await _notifySharedUsers(carpeta.id, req.user.id, 'nueva_conversacion', `Se añadió "${conversacion.titulo || 'Chat'}" a la carpeta`);

        res.json({ success: true });
    } catch (error) {
        console.error('Error al añadir conversación a carpeta:', error);
        res.status(500).json({ error: 'Error al añadir la conversación' });
    }
});

// ────────────────────────────────────────────────────────
// DELETE /:id/conversaciones/:convId — Quitar chat de carpeta
// ────────────────────────────────────────────────────────
router.delete('/:id/conversaciones/:convId', async (req, res) => {
    try {
        const carpeta = await prisma.carpetaTrabajo.findUnique({ where: { id: req.params.id } });
        if (!carpeta) {
            return res.status(404).json({ error: 'Carpeta no encontrada' });
        }

        const esOwner = carpeta.usuarioId === req.user.id;
        if (!esOwner) {
            const compartida = await prisma.carpetaCompartida.findUnique({
                where: { carpetaId_usuarioId: { carpetaId: carpeta.id, usuarioId: req.user.id } },
            });
            if (!compartida || compartida.permisos !== 'escritura') {
                return res.status(403).json({ error: 'No tienes permisos' });
            }
        }

        const conv = await prisma.conversacion.findUnique({ where: { id: req.params.convId } });
        if (!conv || conv.carpetaId !== carpeta.id) {
            return res.status(404).json({ error: 'La conversación no está en esta carpeta' });
        }

        await prisma.conversacion.update({
            where: { id: req.params.convId },
            data: { carpetaId: null },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error al quitar conversación de carpeta:', error);
        res.status(500).json({ error: 'Error al quitar la conversación' });
    }
});

// ────────────────────────────────────────────────────────
// POST /:id/compartir — Compartir carpeta con usuario Pro
// ────────────────────────────────────────────────────────
router.post('/:id/compartir', async (req, res) => {
    try {
        const { email, permisos } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'El email del usuario es obligatorio' });
        }

        const carpeta = await prisma.carpetaTrabajo.findUnique({ where: { id: req.params.id } });
        if (!carpeta) {
            return res.status(404).json({ error: 'Carpeta no encontrada' });
        }

        if (carpeta.usuarioId !== req.user.id) {
            return res.status(403).json({ error: 'Solo el propietario puede compartir la carpeta' });
        }

        // Buscar usuario destino
        const destUser = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
        if (!destUser) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (destUser.id === req.user.id) {
            return res.status(400).json({ error: 'No puedes compartir contigo mismo' });
        }

        // Verificar que el destino es Pro
        const destIsPro = destUser.tipoSuscripcion === 'PRO' || ['SUPERADMIN', 'ADMINISTRADOR', 'DOCUMENTADOR'].includes(destUser.rol);
        if (!destIsPro) {
            return res.status(400).json({ error: 'Solo se puede compartir con usuarios Pro' });
        }

        // Crear o actualizar
        const compartida = await prisma.carpetaCompartida.upsert({
            where: { carpetaId_usuarioId: { carpetaId: carpeta.id, usuarioId: destUser.id } },
            update: { permisos: permisos === 'escritura' ? 'escritura' : 'lectura' },
            create: {
                carpetaId: carpeta.id,
                usuarioId: destUser.id,
                permisos: permisos === 'escritura' ? 'escritura' : 'lectura',
            },
        });

        // Notificar al usuario
        await prisma.carpetaNotificacion.create({
            data: {
                carpetaId: carpeta.id,
                usuarioId: destUser.id,
                tipo: 'compartida',
                mensaje: `"${req.user.nombre || req.user.email}" compartió la carpeta "${carpeta.nombre}" contigo`,
            },
        });

        await logService.log('carpetas.compartir', req.user.id, {
            carpetaId: carpeta.id,
            destinoId: destUser.id,
            permisos: compartida.permisos,
        });

        res.json({
            success: true,
            usuario: { id: destUser.id, nombre: destUser.nombre, email: destUser.email },
            permisos: compartida.permisos,
        });
    } catch (error) {
        console.error('Error al compartir carpeta:', error);
        res.status(500).json({ error: 'Error al compartir la carpeta' });
    }
});

// ────────────────────────────────────────────────────────
// DELETE /:id/compartir/:userId — Dejar de compartir
// ────────────────────────────────────────────────────────
router.delete('/:id/compartir/:userId', async (req, res) => {
    try {
        const carpeta = await prisma.carpetaTrabajo.findUnique({ where: { id: req.params.id } });
        if (!carpeta) {
            return res.status(404).json({ error: 'Carpeta no encontrada' });
        }

        // Propietario puede quitar a cualquiera; usuario compartido puede quitarse a sí mismo
        if (carpeta.usuarioId !== req.user.id && req.params.userId !== req.user.id) {
            return res.status(403).json({ error: 'No tienes permisos' });
        }

        await prisma.carpetaCompartida.deleteMany({
            where: { carpetaId: carpeta.id, usuarioId: req.params.userId },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error al dejar de compartir:', error);
        res.status(500).json({ error: 'Error al dejar de compartir' });
    }
});

// ────────────────────────────────────────────────────────
// GET /:id/notificaciones — Obtener notificaciones de una carpeta
// ────────────────────────────────────────────────────────
router.get('/:id/notificaciones', async (req, res) => {
    try {
        const notificaciones = await prisma.carpetaNotificacion.findMany({
            where: {
                carpetaId: req.params.id,
                usuarioId: req.user.id,
                leida: false,
            },
            orderBy: { fechaCreacion: 'desc' },
            take: 50,
        });

        res.json(notificaciones);
    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        res.status(500).json({ error: 'Error al obtener notificaciones' });
    }
});

// ────────────────────────────────────────────────────────
// POST /:id/notificaciones/leer — Marcar notificaciones como leídas
// ────────────────────────────────────────────────────────
router.post('/:id/notificaciones/leer', async (req, res) => {
    try {
        await prisma.carpetaNotificacion.updateMany({
            where: {
                carpetaId: req.params.id,
                usuarioId: req.user.id,
                leida: false,
            },
            data: { leida: true },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error al marcar notificaciones:', error);
        res.status(500).json({ error: 'Error al marcar notificaciones' });
    }
});

// ────────────────────────────────────────────────────────
// GET /usuarios/pro — Listar usuarios Pro (para autocompletar al compartir)
// ────────────────────────────────────────────────────────
router.get('/usuarios/pro', async (req, res) => {
    try {
        const { q } = req.query;
        const where = {
            activo: true,
            id: { not: req.user.id },
            OR: [
                { tipoSuscripcion: 'PRO' },
                { rol: { in: ['SUPERADMIN', 'ADMINISTRADOR', 'DOCUMENTADOR'] } },
            ],
        };

        if (q && typeof q === 'string' && q.trim().length >= 2) {
            where.AND = [
                {
                    OR: [
                        { nombre: { contains: q.trim() } },
                        { email: { contains: q.trim() } },
                    ],
                },
            ];
        }

        const usuarios = await prisma.usuario.findMany({
            where,
            select: { id: true, nombre: true, email: true },
            take: 10,
            orderBy: { nombre: 'asc' },
        });

        res.json(usuarios);
    } catch (error) {
        console.error('Error al buscar usuarios Pro:', error);
        res.status(500).json({ error: 'Error al buscar usuarios' });
    }
});

// ────────────────────────────────────────────────────────
// Helper: notificar a usuarios compartidos
// ────────────────────────────────────────────────────────
async function _notifySharedUsers(carpetaId, excludeUserId, tipo, mensaje) {
    try {
        const compartidas = await prisma.carpetaCompartida.findMany({
            where: { carpetaId },
            select: { usuarioId: true },
        });

        // También notificar al propietario si el que hizo el cambio no es él
        const carpeta = await prisma.carpetaTrabajo.findUnique({
            where: { id: carpetaId },
            select: { usuarioId: true },
        });

        const userIds = [...compartidas.map((c) => c.usuarioId)];
        if (carpeta) userIds.push(carpeta.usuarioId);

        const uniqueIds = [...new Set(userIds)].filter((id) => id !== excludeUserId);

        if (uniqueIds.length > 0) {
            await prisma.carpetaNotificacion.createMany({
                data: uniqueIds.map((uid) => ({
                    carpetaId,
                    usuarioId: uid,
                    tipo,
                    mensaje,
                })),
            });
        }
    } catch (error) {
        console.error('Error al notificar usuarios:', error);
    }
}

export default router;
