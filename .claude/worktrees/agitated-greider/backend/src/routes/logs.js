/**
 * Rutas de logs del sistema — solo accesibles por SUPERADMIN
 */
import express from 'express';
import prismaPackage from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { purgarLogs } from '../services/logService.js';

const { PrismaClient } = prismaPackage;
const router = express.Router();
const prisma = new PrismaClient();

// Todas las rutas requieren SUPERADMIN
router.use(authenticate, authorize(['SUPERADMIN']));

// ─── GET /api/logs ────────────────────────────────────────────────────────────
// Devuelve logs paginados con filtros opcionales.
// Query params: nivel, categoria, desde, hasta, buscar, usuarioId, page, limit
router.get('/', async (req, res) => {
    try {
        const {
            nivel,
            categoria,
            desde,
            hasta,
            buscar,
            usuarioId,
            page = '1',
            limit = '50',
        } = req.query;

        const pageNum  = Math.max(1, parseInt(page,  10) || 1);
        const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
        const skip     = (pageNum - 1) * limitNum;

        // Construir filtro Prisma
        const where = {};

        if (nivel) {
            const niveles = String(nivel).split(',').map(n => n.trim().toUpperCase()).filter(Boolean);
            where.nivel = { in: niveles };
        }

        if (categoria) {
            const categorias = String(categoria).split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
            where.categoria = { in: categorias };
        }

        if (desde || hasta) {
            where.fechaCreacion = {};
            if (desde) where.fechaCreacion.gte = new Date(desde);
            if (hasta) {
                const hastaDate = new Date(hasta);
                hastaDate.setHours(23, 59, 59, 999);
                where.fechaCreacion.lte = hastaDate;
            }
        }

        if (usuarioId) {
            where.usuarioId = usuarioId;
        }

        if (buscar) {
            where.mensaje = { contains: String(buscar) };
        }

        const [logs, total] = await Promise.all([
            prisma.logSistema.findMany({
                where,
                orderBy: { fechaCreacion: 'desc' },
                skip,
                take: limitNum,
                include: {
                    usuario: {
                        select: { id: true, email: true, nombre: true, rol: true },
                    },
                },
            }),
            prisma.logSistema.count({ where }),
        ]);

        return res.json({
            logs,
            pagination: {
                total,
                page:  pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error('❌ Error en GET /api/logs:', error.message);
        return res.status(500).json({ error: 'Error obteniendo logs', details: error.message });
    }
});

// ─── GET /api/logs/resumen ────────────────────────────────────────────────────
// Conteo por nivel y categoría de las últimas 24 horas
router.get('/resumen', async (req, res) => {
    try {
        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [porNivel, porCategoria, total24h, totalErrores] = await Promise.all([
            prisma.logSistema.groupBy({
                by: ['nivel'],
                where:  { fechaCreacion: { gte: hace24h } },
                _count: { id: true },
            }),
            prisma.logSistema.groupBy({
                by: ['categoria'],
                where:  { fechaCreacion: { gte: hace24h } },
                _count: { id: true },
            }),
            prisma.logSistema.count({ where: { fechaCreacion: { gte: hace24h } } }),
            prisma.logSistema.count({ where: { nivel: 'ERROR' } }),
        ]);

        return res.json({
            ultimas24h: {
                total: total24h,
                porNivel:     porNivel.map(r     => ({ nivel:     r.nivel,     count: r._count.id })),
                porCategoria: porCategoria.map(r => ({ categoria: r.categoria, count: r._count.id })),
            },
            totalErroresHistorico: totalErrores,
        });
    } catch (error) {
        console.error('❌ Error en GET /api/logs/resumen:', error.message);
        return res.status(500).json({ error: 'Error obteniendo resumen', details: error.message });
    }
});

// ─── DELETE /api/logs/purgar ─────────────────────────────────────────────────
// Elimina logs según política de retención (INFO>30d, WARN/ERROR>90d)
router.delete('/purgar', async (req, res) => {
    try {
        const eliminados = await purgarLogs();
        return res.json({ success: true, eliminados });
    } catch (error) {
        console.error('❌ Error en DELETE /api/logs/purgar:', error.message);
        return res.status(500).json({ error: 'Error purgando logs', details: error.message });
    }
});

export default router;
