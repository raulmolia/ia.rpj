// Rutas de estadísticas - Solo accesibles por SUPERADMIN y ADMINISTRADOR
import express from 'express';
import prismaPackage from '@prisma/client';
import chromaService from '../services/chromaService.js';
import { authenticate, authorize } from '../middleware/auth.js';

const { PrismaClient } = prismaPackage;
const router = express.Router();
const prisma = new PrismaClient();

// Middleware de autenticación y autorización para todas las rutas
router.use(authenticate, authorize(['ADMINISTRADOR']));

// ===== ESTADÍSTICAS GENERALES (resumen) =====
router.get('/resumen', async (req, res) => {
    try {
        const [
            totalUsuarios,
            usuariosActivos,
            totalConversaciones,
            totalMensajes,
            totalDocumentos,
            totalFuentesWeb,
        ] = await Promise.all([
            prisma.usuario.count(),
            prisma.usuario.count({ where: { activo: true } }),
            prisma.conversacion.count(),
            prisma.mensajeConversacion.count(),
            prisma.documento.count(),
            prisma.fuenteWeb.count(),
        ]);

        // Tokens totales
        const tokensAgg = await prisma.mensajeConversacion.aggregate({
            _sum: { tokensEntrada: true, tokensSalida: true },
        });

        // ChromaDB
        let chromaDocCount = -1;
        try {
            chromaDocCount = await chromaService.getDocumentCount();
        } catch (_) { /* ChromaDB no disponible */ }

        res.json({
            usuarios: { total: totalUsuarios, activos: usuariosActivos },
            conversaciones: totalConversaciones,
            mensajes: totalMensajes,
            documentos: totalDocumentos,
            fuentesWeb: totalFuentesWeb,
            tokens: {
                entrada: tokensAgg._sum.tokensEntrada || 0,
                salida: tokensAgg._sum.tokensSalida || 0,
                total: (tokensAgg._sum.tokensEntrada || 0) + (tokensAgg._sum.tokensSalida || 0),
            },
            chromaDocumentos: chromaDocCount,
        });
    } catch (error) {
        console.error('❌ Error en /stats/resumen:', error.message);
        res.status(500).json({ error: 'Error obteniendo resumen', details: error.message });
    }
});

// ===== ESTADÍSTICAS DE USUARIOS =====
router.get('/usuarios', async (req, res) => {
    try {
        // Usuarios por rol
        const porRol = await prisma.usuario.groupBy({
            by: ['rol'],
            _count: { id: true },
        });

        // Usuarios por tipo de suscripción
        const porSuscripcion = await prisma.usuario.groupBy({
            by: ['tipoSuscripcion'],
            _count: { id: true },
        });

        // Registros por mes (últimos 12 meses)
        const hace12Meses = new Date();
        hace12Meses.setMonth(hace12Meses.getMonth() - 12);

        const registrosPorMes = await prisma.$queryRaw`
            SELECT DATE_FORMAT(fechaCreacion, '%Y-%m') as mes, COUNT(*) as total
            FROM usuarios
            WHERE fechaCreacion >= ${hace12Meses}
            GROUP BY mes
            ORDER BY mes ASC
        `;

        // Usuarios activos / inactivos
        const activos = await prisma.usuario.count({ where: { activo: true } });
        const inactivos = await prisma.usuario.count({ where: { activo: false } });

        // Top 10 usuarios por número de conversaciones
        const topUsuarios = await prisma.$queryRaw`
            SELECT u.nombre, u.apellidos, u.email, u.rol, COUNT(c.id) as totalConversaciones,
                   (SELECT COUNT(*) FROM mensajes_conversacion mc 
                    INNER JOIN conversaciones c2 ON mc.conversacionId = c2.id 
                    WHERE c2.usuarioId = u.id) as totalMensajes
            FROM usuarios u
            LEFT JOIN conversaciones c ON c.usuarioId = u.id
            GROUP BY u.id, u.nombre, u.apellidos, u.email, u.rol
            ORDER BY totalConversaciones DESC
            LIMIT 10
        `;

        res.json({
            porRol: porRol.map(r => ({ rol: r.rol, total: r._count.id })),
            porSuscripcion: porSuscripcion.map(s => ({ tipo: s.tipoSuscripcion, total: s._count.id })),
            registrosPorMes: registrosPorMes.map(r => ({ mes: r.mes, total: Number(r.total) })),
            estado: { activos, inactivos },
            topUsuarios: topUsuarios.map(u => ({
                nombre: `${u.nombre} ${u.apellidos || ''}`.trim(),
                email: u.email,
                rol: u.rol,
                conversaciones: Number(u.totalConversaciones),
                mensajes: Number(u.totalMensajes),
            })),
        });
    } catch (error) {
        console.error('❌ Error en /stats/usuarios:', error.message);
        res.status(500).json({ error: 'Error obteniendo estadísticas de usuarios', details: error.message });
    }
});

// ===== INTERACCIONES (mensajes por período) =====
router.get('/interacciones', async (req, res) => {
    try {
        const ahora = new Date();

        // Función auxiliar para obtener inicio de período
        const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const inicioSemana = new Date(inicioHoy);
        inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1); // Lunes
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const inicioAno = new Date(ahora.getFullYear(), 0, 1);

        const [hoy, semana, mes, ano, total] = await Promise.all([
            prisma.mensajeConversacion.count({ where: { fechaCreacion: { gte: inicioHoy } } }),
            prisma.mensajeConversacion.count({ where: { fechaCreacion: { gte: inicioSemana } } }),
            prisma.mensajeConversacion.count({ where: { fechaCreacion: { gte: inicioMes } } }),
            prisma.mensajeConversacion.count({ where: { fechaCreacion: { gte: inicioAno } } }),
            prisma.mensajeConversacion.count(),
        ]);

        // Mensajes por día (últimos 30 días)
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);

        const porDia = await prisma.$queryRaw`
            SELECT DATE_FORMAT(fechaCreacion, '%Y-%m-%d') as dia, COUNT(*) as total
            FROM mensajes_conversacion
            WHERE fechaCreacion >= ${hace30Dias}
            GROUP BY dia
            ORDER BY dia ASC
        `;

        // Interacciones por usuario (top 10 este mes)
        const porUsuario = await prisma.$queryRaw`
            SELECT u.nombre, u.apellidos, u.email, COUNT(mc.id) as totalMensajes
            FROM mensajes_conversacion mc
            INNER JOIN conversaciones c ON mc.conversacionId = c.id
            INNER JOIN usuarios u ON c.usuarioId = u.id
            WHERE mc.fechaCreacion >= ${inicioMes}
            GROUP BY u.id, u.nombre, u.apellidos, u.email
            ORDER BY totalMensajes DESC
            LIMIT 10
        `;

        // Mensajes por hora del día (distribución)
        const porHora = await prisma.$queryRaw`
            SELECT HOUR(fechaCreacion) as hora, COUNT(*) as total
            FROM mensajes_conversacion
            GROUP BY hora
            ORDER BY hora ASC
        `;

        res.json({
            periodos: { hoy, semana, mes, ano, total },
            porDia: porDia.map(d => ({ dia: d.dia, total: Number(d.total) })),
            porUsuario: porUsuario.map(u => ({
                nombre: `${u.nombre} ${u.apellidos || ''}`.trim(),
                email: u.email,
                mensajes: Number(u.totalMensajes),
            })),
            porHora: porHora.map(h => ({ hora: Number(h.hora), total: Number(h.total) })),
        });
    } catch (error) {
        console.error('❌ Error en /stats/interacciones:', error.message);
        res.status(500).json({ error: 'Error obteniendo interacciones', details: error.message });
    }
});

// ===== CONVERSACIONES (chats activos/archivados) =====
router.get('/conversaciones', async (req, res) => {
    try {
        const totalConversaciones = await prisma.conversacion.count();

        // Conversaciones por usuario
        const porUsuario = await prisma.$queryRaw`
            SELECT u.nombre, u.apellidos, u.email, COUNT(c.id) as total
            FROM conversaciones c
            INNER JOIN usuarios u ON c.usuarioId = u.id
            GROUP BY u.id, u.nombre, u.apellidos, u.email
            ORDER BY total DESC
            LIMIT 15
        `;

        // Conversaciones por intención principal
        const porIntencion = await prisma.conversacion.groupBy({
            by: ['intencionPrincipal'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        });

        // Conversaciones por mes (últimos 12 meses)
        const hace12Meses = new Date();
        hace12Meses.setMonth(hace12Meses.getMonth() - 12);

        const porMes = await prisma.$queryRaw`
            SELECT DATE_FORMAT(fechaCreacion, '%Y-%m') as mes, COUNT(*) as total
            FROM conversaciones
            WHERE fechaCreacion >= ${hace12Meses}
            GROUP BY mes
            ORDER BY mes ASC
        `;

        // Media de mensajes por conversación
        const mediaMensajes = await prisma.$queryRaw`
            SELECT AVG(cnt) as media FROM (
                SELECT COUNT(*) as cnt FROM mensajes_conversacion GROUP BY conversacionId
            ) sub
        `;

        res.json({
            total: totalConversaciones,
            porUsuario: porUsuario.map(u => ({
                nombre: `${u.nombre} ${u.apellidos || ''}`.trim(),
                email: u.email,
                total: Number(u.total),
            })),
            porIntencion: porIntencion.map(i => ({
                intencion: i.intencionPrincipal || 'Sin intención',
                total: i._count.id,
            })),
            porMes: porMes.map(m => ({ mes: m.mes, total: Number(m.total) })),
            mediaMensajesPorConversacion: mediaMensajes[0]?.media ? Number(mediaMensajes[0].media).toFixed(1) : '0',
        });
    } catch (error) {
        console.error('❌ Error en /stats/conversaciones:', error.message);
        res.status(500).json({ error: 'Error obteniendo conversaciones', details: error.message });
    }
});

// ===== USO DE MODELOS IA =====
router.get('/modelos-ia', async (req, res) => {
    try {
        // Extraer modelo usado de metadatos.llmRaw.model
        const modelUsage = await prisma.$queryRaw`
            SELECT 
                JSON_UNQUOTE(JSON_EXTRACT(metadatos, '$.llmRaw.model')) as modelo,
                COUNT(*) as total,
                SUM(COALESCE(tokensEntrada, 0)) as tokensEntrada,
                SUM(COALESCE(tokensSalida, 0)) as tokensSalida,
                AVG(COALESCE(duracionMs, 0)) as duracionMediaMs
            FROM mensajes_conversacion
            WHERE metadatos IS NOT NULL 
              AND JSON_EXTRACT(metadatos, '$.llmRaw.model') IS NOT NULL
            GROUP BY modelo
            ORDER BY total DESC
        `;

        // Uso por día (últimos 30 días)
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);

        const usoPorDia = await prisma.$queryRaw`
            SELECT 
                DATE_FORMAT(fechaCreacion, '%Y-%m-%d') as dia,
                COUNT(*) as total,
                SUM(COALESCE(tokensEntrada, 0)) as tokensEntrada,
                SUM(COALESCE(tokensSalida, 0)) as tokensSalida
            FROM mensajes_conversacion
            WHERE fechaCreacion >= ${hace30Dias}
              AND rol = 'ASISTENTE'
            GROUP BY dia
            ORDER BY dia ASC
        `;

        // Tokens totales
        const tokensTotal = await prisma.mensajeConversacion.aggregate({
            _sum: { tokensEntrada: true, tokensSalida: true },
            where: { rol: 'ASISTENTE' },
        });

        // Duración media de respuesta
        const duracionMedia = await prisma.mensajeConversacion.aggregate({
            _avg: { duracionMs: true },
            where: { rol: 'ASISTENTE', duracionMs: { not: null } },
        });

        res.json({
            modelos: modelUsage.map(m => ({
                modelo: m.modelo || 'Desconocido',
                total: Number(m.total),
                tokensEntrada: Number(m.tokensEntrada),
                tokensSalida: Number(m.tokensSalida),
                duracionMediaMs: Math.round(Number(m.duracionMediaMs)),
            })),
            usoPorDia: usoPorDia.map(d => ({
                dia: d.dia,
                total: Number(d.total),
                tokensEntrada: Number(d.tokensEntrada),
                tokensSalida: Number(d.tokensSalida),
            })),
            tokensTotal: {
                entrada: tokensTotal._sum.tokensEntrada || 0,
                salida: tokensTotal._sum.tokensSalida || 0,
                total: (tokensTotal._sum.tokensEntrada || 0) + (tokensTotal._sum.tokensSalida || 0),
            },
            duracionMediaMs: Math.round(duracionMedia._avg.duracionMs || 0),
        });
    } catch (error) {
        console.error('❌ Error en /stats/modelos-ia:', error.message);
        res.status(500).json({ error: 'Error obteniendo estadísticas de modelos IA', details: error.message });
    }
});

// ===== ESTADÍSTICAS DE BASE DE DATOS (MariaDB) =====
router.get('/base-datos', async (req, res) => {
    try {
        // Información de tablas MariaDB
        const tablasInfo = await prisma.$queryRaw`
            SELECT 
                TABLE_NAME as tabla,
                TABLE_ROWS as registros,
                ROUND(DATA_LENGTH / 1024, 2) as tamanoKB,
                ROUND(INDEX_LENGTH / 1024, 2) as indicesKB,
                ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 2) as totalKB,
                ENGINE as motor,
                TABLE_COLLATION as colacion,
                UPDATE_TIME as ultimaActualizacion
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
        `;

        // Tamaño total de la base de datos
        const tamanoTotal = await prisma.$queryRaw`
            SELECT 
                ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as tamanoMB,
                SUM(TABLE_ROWS) as registrosTotales,
                COUNT(*) as totalTablas
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
        `;

        res.json({
            tablas: tablasInfo.map(t => ({
                tabla: t.tabla,
                registros: Number(t.registros || 0),
                tamanoKB: Number(t.tamanoKB || 0),
                indicesKB: Number(t.indicesKB || 0),
                totalKB: Number(t.totalKB || 0),
                motor: t.motor,
                colacion: t.colacion,
                ultimaActualizacion: t.ultimaActualizacion,
            })),
            resumen: {
                tamanoMB: Number(tamanoTotal[0]?.tamanoMB || 0),
                registrosTotales: Number(tamanoTotal[0]?.registrosTotales || 0),
                totalTablas: Number(tamanoTotal[0]?.totalTablas || 0),
            },
        });
    } catch (error) {
        console.error('❌ Error en /stats/base-datos:', error.message);
        res.status(500).json({ error: 'Error obteniendo estadísticas de base de datos', details: error.message });
    }
});

// ===== ESTADÍSTICAS DE ChromaDB =====
router.get('/chromadb', async (req, res) => {
    try {
        let collections = [];
        let totalDocumentos = 0;

        if (chromaService.isAvailable && chromaService.client) {
            try {
                const chromaCollections = await chromaService.client.listCollections();
                
                for (const col of chromaCollections) {
                    try {
                        const collection = await chromaService.client.getCollection({
                            name: col.name,
                            embeddingFunction: chromaService.embeddingFunction,
                        });
                        const count = await collection.count();
                        collections.push({ nombre: col.name, documentos: count });
                        totalDocumentos += count;
                    } catch (_) {
                        collections.push({ nombre: col.name, documentos: -1 });
                    }
                }
            } catch (listError) {
                console.error('❌ Error listando colecciones ChromaDB:', listError.message);
            }
        }

        // Documentos procesados en MariaDB
        const docsPorEstado = await prisma.documento.groupBy({
            by: ['estadoProcesamiento'],
            _count: { id: true },
        });

        const fuentesPorEstado = await prisma.fuenteWeb.groupBy({
            by: ['estadoProcesamiento'],
            _count: { id: true },
        });

        // Tamaño total de documentos
        const tamanoDocsAgg = await prisma.documento.aggregate({
            _sum: { tamanoBytes: true },
            _count: { id: true },
        });

        res.json({
            chromaDisponible: chromaService.isAvailable,
            colecciones: collections,
            totalDocumentosVectoriales: totalDocumentos,
            documentos: {
                total: tamanoDocsAgg._count.id,
                tamanoTotalMB: Number(((tamanoDocsAgg._sum.tamanoBytes || 0) / 1024 / 1024).toFixed(2)),
                porEstado: docsPorEstado.map(d => ({ estado: d.estadoProcesamiento, total: d._count.id })),
            },
            fuentesWeb: {
                porEstado: fuentesPorEstado.map(f => ({ estado: f.estadoProcesamiento, total: f._count.id })),
            },
        });
    } catch (error) {
        console.error('❌ Error en /stats/chromadb:', error.message);
        res.status(500).json({ error: 'Error obteniendo estadísticas de ChromaDB', details: error.message });
    }
});

// ===== ESTADÍSTICAS POR INTENCIÓN =====
router.get('/intenciones', async (req, res) => {
    try {
        // Mensajes por intención
        const porIntencion = await prisma.mensajeConversacion.groupBy({
            by: ['intencion'],
            _count: { id: true },
            _sum: { tokensEntrada: true, tokensSalida: true },
            _avg: { duracionMs: true },
            orderBy: { _count: { id: 'desc' } },
        });

        // Intenciones por mes (últimos 6 meses)
        const hace6Meses = new Date();
        hace6Meses.setMonth(hace6Meses.getMonth() - 6);

        const intencionPorMes = await prisma.$queryRaw`
            SELECT 
                DATE_FORMAT(fechaCreacion, '%Y-%m') as mes,
                intencion,
                COUNT(*) as total
            FROM mensajes_conversacion
            WHERE fechaCreacion >= ${hace6Meses}
              AND intencion IS NOT NULL
            GROUP BY mes, intencion
            ORDER BY mes ASC, total DESC
        `;

        res.json({
            porIntencion: porIntencion.map(i => ({
                intencion: i.intencion || 'Sin intención',
                total: i._count.id,
                tokensEntrada: i._sum.tokensEntrada || 0,
                tokensSalida: i._sum.tokensSalida || 0,
                duracionMediaMs: Math.round(i._avg.duracionMs || 0),
            })),
            porMes: intencionPorMes.map(i => ({
                mes: i.mes,
                intencion: i.intencion,
                total: Number(i.total),
            })),
        });
    } catch (error) {
        console.error('❌ Error en /stats/intenciones:', error.message);
        res.status(500).json({ error: 'Error obteniendo estadísticas por intención', details: error.message });
    }
});

// ===== USO DE HERRAMIENTAS (Canvas, descargas) =====
router.get('/herramientas', async (req, res) => {
    try {
        // Mensajes con contenido de canvas
        const conCanvas = await prisma.mensajeConversacion.count({
            where: { canvasContent: { not: null } },
        });

        const totalMensajesAsistente = await prisma.mensajeConversacion.count({
            where: { rol: 'ASISTENTE' },
        });

        // Canvas por usuario
        const canvasPorUsuario = await prisma.$queryRaw`
            SELECT u.nombre, u.apellidos, u.email, COUNT(mc.id) as totalCanvas
            FROM mensajes_conversacion mc
            INNER JOIN conversaciones c ON mc.conversacionId = c.id
            INNER JOIN usuarios u ON c.usuarioId = u.id
            WHERE mc.canvasContent IS NOT NULL
            GROUP BY u.id, u.nombre, u.apellidos, u.email
            ORDER BY totalCanvas DESC
            LIMIT 10
        `;

        // Canvas por mes
        const hace6Meses = new Date();
        hace6Meses.setMonth(hace6Meses.getMonth() - 6);

        const canvasPorMes = await prisma.$queryRaw`
            SELECT DATE_FORMAT(mc.fechaCreacion, '%Y-%m') as mes, COUNT(*) as total
            FROM mensajes_conversacion mc
            WHERE mc.canvasContent IS NOT NULL
              AND mc.fechaCreacion >= ${hace6Meses}
            GROUP BY mes
            ORDER BY mes ASC
        `;

        // Documentos subidos (como medida de uso de herramientas)
        const docsPorMes = await prisma.$queryRaw`
            SELECT DATE_FORMAT(fechaCreacion, '%Y-%m') as mes, COUNT(*) as total
            FROM documentos
            WHERE fechaCreacion >= ${hace6Meses}
            GROUP BY mes
            ORDER BY mes ASC
        `;

        res.json({
            canvas: {
                total: conCanvas,
                porcentaje: totalMensajesAsistente > 0 
                    ? Number(((conCanvas / totalMensajesAsistente) * 100).toFixed(1)) 
                    : 0,
                porUsuario: canvasPorUsuario.map(u => ({
                    nombre: `${u.nombre} ${u.apellidos || ''}`.trim(),
                    email: u.email,
                    total: Number(u.totalCanvas),
                })),
                porMes: canvasPorMes.map(m => ({ mes: m.mes, total: Number(m.total) })),
            },
            documentos: {
                porMes: docsPorMes.map(d => ({ mes: d.mes, total: Number(d.total) })),
            },
        });
    } catch (error) {
        console.error('❌ Error en /stats/herramientas:', error.message);
        res.status(500).json({ error: 'Error obteniendo estadísticas de herramientas', details: error.message });
    }
});

// ===== ESTADÍSTICAS DE FEEDBACK =====
router.get('/feedback', async (req, res) => {
    try {
        const [total, positivos, negativos] = await Promise.all([
            prisma.feedbackMensaje.count(),
            prisma.feedbackMensaje.count({ where: { tipo: 'POSITIVO' } }),
            prisma.feedbackMensaje.count({ where: { tipo: 'NEGATIVO' } }),
        ]);

        // Feedback por intención
        const feedbackPorIntencion = await prisma.feedbackMensaje.groupBy({
            by: ['intencion', 'tipo'],
            _count: { id: true },
        });

        // Agrupar por intención
        const intencionMap = {};
        feedbackPorIntencion.forEach(item => {
            const key = item.intencion || 'Sin intención';
            if (!intencionMap[key]) intencionMap[key] = { intencion: key, positivos: 0, negativos: 0, total: 0 };
            if (item.tipo === 'POSITIVO') intencionMap[key].positivos = item._count.id;
            else intencionMap[key].negativos = item._count.id;
            intencionMap[key].total += item._count.id;
        });

        // Últimos 20 feedbacks
        const recientes = await prisma.feedbackMensaje.findMany({
            take: 20,
            orderBy: { fechaCreacion: 'desc' },
            include: {
                usuario: { select: { nombre: true, apellidos: true, email: true } },
                mensaje: { select: { contenido: true } },
            },
        });

        res.json({
            total,
            positivos,
            negativos,
            porcentajePositivo: total > 0 ? Number(((positivos / total) * 100).toFixed(1)) : 0,
            feedbackPorIntencion: Object.values(intencionMap),
            recientes: recientes.map(f => ({
                id: f.id,
                tipo: f.tipo,
                intencion: f.intencion,
                fechaCreacion: f.fechaCreacion,
                usuario: f.usuario ? { nombre: f.usuario.nombre, apellidos: f.usuario.apellidos || '', email: f.usuario.email } : null,
                mensaje: f.mensaje ? { content: (f.mensaje.contenido || '').substring(0, 200) } : null,
            })),
        });
    } catch (error) {
        console.error('❌ Error en /stats/feedback:', error.message);
        res.status(500).json({ error: 'Error obteniendo estadísticas de feedback', details: error.message });
    }
});

export default router;
