/**
 * logService.js
 * Servicio centralizado de logging al sistema.
 * Escribe en la tabla `logs_sistema` de MariaDB de forma NO bloqueante.
 * Si la BD no está disponible, hace fallback a console para no provocar bucles.
 */

import prismaPackage from '@prisma/client';

const { PrismaClient } = prismaPackage;
const PrismaEnums = prismaPackage.$Enums || {};

const NivelLog = PrismaEnums.NivelLog || { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };
const CategoriaLog = PrismaEnums.CategoriaLog || {
    AUTH: 'AUTH', CHAT: 'CHAT', LLM: 'LLM', DOCUMENTO: 'DOCUMENTO',
    WEB: 'WEB', CANVAS: 'CANVAS', SISTEMA: 'SISTEMA', API: 'API',
};

// Instancia dedicada para logs (no compartir instancia global para evitar deadlocks)
let prisma;
function getPrisma() {
    if (!prisma) prisma = new PrismaClient();
    return prisma;
}

// ─── Purga automática probabilística ──────────────────────────────────────────
// Ejecuta limpieza ~1 de cada 200 escrituras para no añadir carga en cada log.
const PURGE_PROBABILITY = 0.005; // 0.5%
const RETENTION = {
    INFO:  30, // días
    WARN:  90,
    ERROR: 90,
};

async function maybePurge() {
    if (Math.random() > PURGE_PROBABILITY) return;
    try {
        const db = getPrisma();
        const ahora = new Date();
        for (const [nivel, dias] of Object.entries(RETENTION)) {
            const limite = new Date(ahora);
            limite.setDate(limite.getDate() - dias);
            await db.logSistema.deleteMany({
                where: { nivel, fechaCreacion: { lt: limite } },
            });
        }
    } catch (_) { /* silencioso */ }
}

// ─── Función base ──────────────────────────────────────────────────────────────
/**
 * @param {'INFO'|'WARN'|'ERROR'} nivel
 * @param {'AUTH'|'CHAT'|'LLM'|'DOCUMENTO'|'WEB'|'CANVAS'|'SISTEMA'|'API'} categoria
 * @param {string} mensaje
 * @param {object} [opts]
 * @param {string}  [opts.usuarioId]
 * @param {string}  [opts.ip]
 * @param {number}  [opts.duracionMs]
 * @param {object}  [opts.detalles]   - Metadatos extra (nunca contenido de prompts)
 */
async function log(nivel, categoria, mensaje, opts = {}) {
    const { usuarioId, ip, duracionMs, detalles } = opts;

    // Siempre imprime en consola para tener traza en PM2
    const prefix = nivel === 'ERROR' ? '❌' : nivel === 'WARN' ? '⚠️' : 'ℹ️';
    console[nivel === 'ERROR' ? 'error' : nivel === 'WARN' ? 'warn' : 'log'](
        `${prefix} [${categoria}] ${mensaje}`,
        detalles ? JSON.stringify(detalles) : '',
    );

    // Escritura asíncrona a BD — no lanzar error si falla
    setImmediate(async () => {
        try {
            const db = getPrisma();
            await db.logSistema.create({
                data: {
                    nivel,
                    categoria,
                    mensaje: String(mensaje).slice(0, 1000), // nunca más de 1000 chars
                    detalles: detalles ?? undefined,
                    usuarioId: usuarioId ?? undefined,
                    ip: ip ?? undefined,
                    duracionMs: duracionMs ?? undefined,
                },
            });
            await maybePurge();
        } catch (err) {
            // Fallback puro a console para no perder el evento
            console.error('[logService] Error escribiendo log en BD:', err.message);
        }
    });
}

// ─── Atajos ────────────────────────────────────────────────────────────────────
const logInfo  = (categoria, mensaje, opts) => log(NivelLog.INFO,  categoria, mensaje, opts);
const logWarn  = (categoria, mensaje, opts) => log(NivelLog.WARN,  categoria, mensaje, opts);
const logError = (categoria, mensaje, opts) => log(NivelLog.ERROR, categoria, mensaje, opts);

// ─── Purga manual (para el endpoint DELETE /api/logs/purgar) ──────────────────
async function purgarLogs() {
    const db = getPrisma();
    const ahora = new Date();
    let eliminados = 0;
    for (const [nivel, dias] of Object.entries(RETENTION)) {
        const limite = new Date(ahora);
        limite.setDate(limite.getDate() - dias);
        const { count } = await db.logSistema.deleteMany({
            where: { nivel, fechaCreacion: { lt: limite } },
        });
        eliminados += count;
    }
    return eliminados;
}

export { log, logInfo, logWarn, logError, purgarLogs, NivelLog, CategoriaLog };
export default { log, logInfo, logWarn, logError, purgarLogs, NivelLog, CategoriaLog };
