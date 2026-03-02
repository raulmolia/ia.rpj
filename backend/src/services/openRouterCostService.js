// Servicio de monitorización de costes de OpenRouter
// Gestiona el tracking de uso por generación, consulta de créditos/saldo
// y almacenamiento en la tabla registros_coste_ia (Prisma: RegistroCosteIA)

import prismaPackage from '@prisma/client';
import logService from './logService.js';

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MANAGEMENT_KEY = process.env.OPENROUTER_MANAGEMENT_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// =====================================================
// 1. Registrar coste de una generación LLM
// =====================================================

/**
 * Registra el coste de una llamada LLM en la base de datos.
 *
 * @param {object} params
 * @param {object} params.llmResponse   – Respuesta completa del LLM (con usage, raw, model, durationMs)
 * @param {string} [params.usuarioId]   – ID del usuario que generó el gasto
 * @param {string} [params.mensajeId]   – ID del MensajeConversacion asociado
 * @param {string} [params.tipoOperacion] – chat | thinking | tools | canvas | transcripcion
 * @param {boolean} [params.exito]      – Si la generación fue exitosa
 */
export async function registrarCosteGeneracion({
    llmResponse,
    usuarioId = null,
    mensajeId = null,
    tipoOperacion = 'chat',
    exito = true,
}) {
    try {
        if (!llmResponse) return null;

        const usage = llmResponse.usage || llmResponse.raw?.usage || {};
        const model = llmResponse.model || llmResponse.raw?.model || 'desconocido';
        const generationId = llmResponse.raw?.id || null;
        const durationMs = typeof llmResponse.durationMs === 'number' ? llmResponse.durationMs : null;

        // Tokens
        const tokensEntrada = usage.prompt_tokens || 0;
        const tokensSalida = usage.completion_tokens || 0;
        const tokensRazonamiento = usage.reasoning_tokens || 0;
        const tokensCacheados = usage.cache_read_input_tokens || usage.cached_tokens || 0;

        // Costes nativos (OpenRouter los devuelve en usage.cost o en native_tokens_reasoning etc.)
        // El campo usage.cost es un float con el coste total USD de la petición si OpenRouter lo devuelve
        let costeTotal = 0;
        let costeEntrada = 0;
        let costeSalida = 0;

        if (typeof usage.cost === 'number') {
            costeTotal = usage.cost;
        }

        // Si no hay coste directo, intentar calcular desde el generation stats async
        // (se reconciliará más tarde si se usa /generation?id=...)
        // Por ahora guardamos lo que venga en usage

        // Datos extra para el campo JSON detalles
        const detalles = {
            native_tokens_prompt: usage.native_tokens_prompt || null,
            native_tokens_completion: usage.native_tokens_completion || null,
            native_tokens_reasoning: usage.native_tokens_reasoning || null,
            cache_creation_input_tokens: usage.cache_creation_input_tokens || null,
            cache_read_input_tokens: usage.cache_read_input_tokens || null,
            finish_reason: llmResponse.raw?.choices?.[0]?.finish_reason || null,
            attempts: llmResponse.attempts || 1,
        };

        const registro = await prisma.registroCosteIA.create({
            data: {
                generationId: generationId || undefined,
                mensajeId,
                usuarioId,
                modelo: model,
                tokensEntrada,
                tokensSalida,
                tokensRazonamiento,
                tokensCacheados,
                costeEntrada,
                costeSalida,
                costeTotal,
                duracionMs: durationMs,
                tipoOperacion,
                exito,
                detalles,
            },
        });

        // Si tenemos un generationId, intentar obtener el coste real de forma asíncrona
        if (generationId && costeTotal === 0) {
            reconciliarCosteAsincrono(registro.id, generationId).catch(err => {
                console.warn(`[CostService] Error reconciliando coste para ${generationId}: ${err.message}`);
            });
        }

        return registro;
    } catch (error) {
        // No dejar que un error de tracking rompa el flujo principal
        console.error('[CostService] Error registrando coste:', error.message);
        logService.logError('LLM', 'Error registrando coste de generación', {
            detalles: { error: error.message, tipoOperacion },
        });
        return null;
    }
}

// =====================================================
// 2. Reconciliar coste desde OpenRouter Generation API
// =====================================================

/**
 * Consulta /api/v1/generation?id=<id> para obtener el coste real
 * y actualiza el registro en BD. Se ejecuta de forma asíncrona
 * con un pequeño retraso para dar tiempo a OpenRouter a procesar.
 */
async function reconciliarCosteAsincrono(registroId, generationId, retries = 3) {
    // Esperar unos segundos para que OpenRouter tenga los datos listos
    await new Promise(r => setTimeout(r, 5000));

    const key = OPENROUTER_API_KEY;
    if (!key) return;

    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(`${OPENROUTER_BASE_URL}/generation?id=${generationId}`, {
                headers: { Authorization: `Bearer ${key}` },
            });

            if (!res.ok) {
                if (res.status === 404 && i < retries - 1) {
                    // Aún no disponible, esperar más
                    await new Promise(r => setTimeout(r, 10000));
                    continue;
                }
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const genData = data?.data || data;

            if (genData.total_cost !== undefined || genData.usage?.total_cost !== undefined) {
                const totalCost = genData.total_cost ?? genData.usage?.total_cost ?? 0;
                const promptCost = genData.prompt_cost ?? genData.usage?.prompt_cost ?? 0;
                const completionCost = genData.completion_cost ?? genData.usage?.completion_cost ?? 0;

                await prisma.registroCosteIA.update({
                    where: { id: registroId },
                    data: {
                        costeTotal: totalCost,
                        costeEntrada: promptCost,
                        costeSalida: completionCost,
                        tokensEntrada: genData.tokens_prompt || genData.usage?.prompt_tokens || undefined,
                        tokensSalida: genData.tokens_completion || genData.usage?.completion_tokens || undefined,
                    },
                });
                console.log(`[CostService] ✅ Coste reconciliado para ${generationId}: $${totalCost}`);
                return;
            }
        } catch (error) {
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }
}

// =====================================================
// 3. Consultar créditos/saldo de OpenRouter
// =====================================================

/**
 * Consulta el saldo de créditos de la cuenta de OpenRouter.
 * Usa la Management API Key si está disponible, o la API Key normal.
 */
export async function consultarCreditos() {
    const key = OPENROUTER_MANAGEMENT_KEY || OPENROUTER_API_KEY;
    if (!key) {
        return { error: 'No hay API key configurada', disponible: false };
    }

    try {
        const res = await fetch(`${OPENROUTER_BASE_URL}/credits`, {
            headers: { Authorization: `Bearer ${key}` },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();
        return {
            disponible: true,
            totalCreditos: data.data?.total_credits ?? data.total_credits ?? null,
            creditosUsados: data.data?.total_usage ?? data.total_usage ?? null,
            creditosRestantes: data.data?.remaining_credits ?? data.remaining_credits
                ?? ((data.data?.total_credits != null && data.data?.total_usage != null)
                    ? data.data.total_credits - data.data.total_usage
                    : null),
            raw: data,
        };
    } catch (error) {
        console.error('[CostService] Error consultando créditos:', error.message);
        return { error: error.message, disponible: false };
    }
}

/**
 * Consulta el estado de la API key actual (rate limits, créditos restantes).
 */
export async function consultarEstadoKey() {
    const key = OPENROUTER_API_KEY;
    if (!key) {
        return { error: 'No hay API key configurada', disponible: false };
    }

    try {
        const res = await fetch(`${OPENROUTER_BASE_URL}/key`, {
            headers: { Authorization: `Bearer ${key}` },
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();
        return {
            disponible: true,
            label: data.data?.label ?? null,
            limit: data.data?.limit ?? null,
            limitRemaining: data.data?.limit_remaining ?? null,
            usage: data.data?.usage ?? null,
            rateLimitRequests: data.data?.rate_limit?.requests ?? null,
            rateLimitInterval: data.data?.rate_limit?.interval ?? null,
            isFreeLimit: data.data?.is_free_tier ?? null,
            raw: data,
        };
    } catch (error) {
        console.error('[CostService] Error consultando estado de key:', error.message);
        return { error: error.message, disponible: false };
    }
}

// =====================================================
// 4. Estadísticas de costes desde la BD local
// =====================================================

/**
 * Obtiene un resumen completo de gastos IA para el panel de estadísticas.
 */
export async function obtenerResumenCostes() {
    try {
        // Totales generales
        const totales = await prisma.registroCosteIA.aggregate({
            _sum: {
                costeTotal: true,
                costeEntrada: true,
                costeSalida: true,
                tokensEntrada: true,
                tokensSalida: true,
                tokensRazonamiento: true,
                tokensCacheados: true,
            },
            _count: { id: true },
            _avg: { costeTotal: true, duracionMs: true },
        });

        // Coste por modelo
        const costePorModelo = await prisma.registroCosteIA.groupBy({
            by: ['modelo'],
            _sum: { costeTotal: true, tokensEntrada: true, tokensSalida: true },
            _count: { id: true },
            _avg: { costeTotal: true, duracionMs: true },
            orderBy: { _sum: { costeTotal: 'desc' } },
        });

        // Coste por tipo de operación
        const costePorOperacion = await prisma.registroCosteIA.groupBy({
            by: ['tipoOperacion'],
            _sum: { costeTotal: true, tokensEntrada: true, tokensSalida: true },
            _count: { id: true },
            orderBy: { _sum: { costeTotal: 'desc' } },
        });

        // Gasto diario últimos 30 días
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);

        const gastoDiario = await prisma.$queryRaw`
            SELECT 
                DATE_FORMAT(fechaCreacion, '%Y-%m-%d') as dia,
                COUNT(*) as peticiones,
                SUM(costeTotal) as costeTotal,
                SUM(tokensEntrada) as tokensEntrada,
                SUM(tokensSalida) as tokensSalida
            FROM registros_coste_ia
            WHERE fechaCreacion >= ${hace30Dias}
            GROUP BY dia
            ORDER BY dia ASC
        `;

        // Gasto mensual últimos 12 meses
        const hace12Meses = new Date();
        hace12Meses.setMonth(hace12Meses.getMonth() - 12);

        const gastoMensual = await prisma.$queryRaw`
            SELECT 
                DATE_FORMAT(fechaCreacion, '%Y-%m') as mes,
                COUNT(*) as peticiones,
                SUM(costeTotal) as costeTotal,
                SUM(tokensEntrada) as tokensEntrada,
                SUM(tokensSalida) as tokensSalida
            FROM registros_coste_ia
            WHERE fechaCreacion >= ${hace12Meses}
            GROUP BY mes
            ORDER BY mes ASC
        `;

        // Gasto por usuario (top 10)
        const gastoPorUsuario = await prisma.$queryRaw`
            SELECT 
                u.nombre, u.apellidos, u.email,
                COUNT(r.id) as peticiones,
                SUM(r.costeTotal) as costeTotal,
                SUM(r.tokensEntrada) as tokensEntrada,
                SUM(r.tokensSalida) as tokensSalida
            FROM registros_coste_ia r
            INNER JOIN usuarios u ON r.usuarioId = u.id
            GROUP BY u.id, u.nombre, u.apellidos, u.email
            ORDER BY costeTotal DESC
            LIMIT 10
        `;

        // Períodos: hoy, semana, mes
        const ahora = new Date();
        const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const inicioSemana = new Date(inicioHoy);
        inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

        const [gastoHoy, gastoSemana, gastoMes] = await Promise.all([
            prisma.registroCosteIA.aggregate({
                _sum: { costeTotal: true },
                _count: { id: true },
                where: { fechaCreacion: { gte: inicioHoy } },
            }),
            prisma.registroCosteIA.aggregate({
                _sum: { costeTotal: true },
                _count: { id: true },
                where: { fechaCreacion: { gte: inicioSemana } },
            }),
            prisma.registroCosteIA.aggregate({
                _sum: { costeTotal: true },
                _count: { id: true },
                where: { fechaCreacion: { gte: inicioMes } },
            }),
        ]);

        // Top de usuarios por gasto en el mes actual
        const gastoPorUsuarioMes = await prisma.$queryRaw`
            SELECT
                u.nombre, u.apellidos, u.email,
                COUNT(r.id) as peticiones,
                SUM(r.costeTotal) as costeTotal,
                SUM(r.tokensEntrada) as tokensEntrada,
                SUM(r.tokensSalida) as tokensSalida
            FROM registros_coste_ia r
            INNER JOIN usuarios u ON r.usuarioId = u.id
            WHERE r.fechaCreacion >= ${inicioMes}
            GROUP BY u.id, u.nombre, u.apellidos, u.email
            ORDER BY costeTotal DESC
            LIMIT 10
        `;

        // Tasa de éxito
        const errores = await prisma.registroCosteIA.count({ where: { exito: false } });

        return {
            totales: {
                costeTotal: totales._sum.costeTotal || 0,
                costeEntrada: totales._sum.costeEntrada || 0,
                costeSalida: totales._sum.costeSalida || 0,
                tokensEntrada: totales._sum.tokensEntrada || 0,
                tokensSalida: totales._sum.tokensSalida || 0,
                tokensRazonamiento: totales._sum.tokensRazonamiento || 0,
                tokensCacheados: totales._sum.tokensCacheados || 0,
                peticiones: totales._count.id || 0,
                costeMediaPorPeticion: totales._avg.costeTotal || 0,
                duracionMediaMs: Math.round(totales._avg.duracionMs || 0),
            },
            periodos: {
                hoy: { coste: gastoHoy._sum.costeTotal || 0, peticiones: gastoHoy._count.id || 0 },
                semana: { coste: gastoSemana._sum.costeTotal || 0, peticiones: gastoSemana._count.id || 0 },
                mes: { coste: gastoMes._sum.costeTotal || 0, peticiones: gastoMes._count.id || 0 },
            },
            costePorModelo: costePorModelo.map(m => ({
                modelo: m.modelo,
                costeTotal: m._sum.costeTotal || 0,
                tokensEntrada: m._sum.tokensEntrada || 0,
                tokensSalida: m._sum.tokensSalida || 0,
                peticiones: m._count.id || 0,
                costeMedia: m._avg.costeTotal || 0,
                duracionMediaMs: Math.round(m._avg.duracionMs || 0),
            })),
            costePorOperacion: costePorOperacion.map(o => ({
                tipoOperacion: o.tipoOperacion,
                costeTotal: o._sum.costeTotal || 0,
                tokensEntrada: o._sum.tokensEntrada || 0,
                tokensSalida: o._sum.tokensSalida || 0,
                peticiones: o._count.id || 0,
            })),
            gastoDiario: gastoDiario.map(d => ({
                dia: d.dia,
                peticiones: Number(d.peticiones),
                costeTotal: Number(d.costeTotal),
                tokensEntrada: Number(d.tokensEntrada),
                tokensSalida: Number(d.tokensSalida),
            })),
            gastoMensual: gastoMensual.map(m => ({
                mes: m.mes,
                peticiones: Number(m.peticiones),
                costeTotal: Number(m.costeTotal),
                tokensEntrada: Number(m.tokensEntrada),
                tokensSalida: Number(m.tokensSalida),
            })),
            gastoPorUsuario: gastoPorUsuario.map(u => ({
                nombre: `${u.nombre} ${u.apellidos || ''}`.trim(),
                email: u.email,
                peticiones: Number(u.peticiones),
                costeTotal: Number(u.costeTotal),
                tokensEntrada: Number(u.tokensEntrada),
                tokensSalida: Number(u.tokensSalida),
            })),
            gastoPorUsuarioMes: gastoPorUsuarioMes.map(u => ({
                nombre: `${u.nombre} ${u.apellidos || ''}`.trim(),
                email: u.email,
                peticiones: Number(u.peticiones),
                costeTotal: Number(u.costeTotal),
                tokensEntrada: Number(u.tokensEntrada),
                tokensSalida: Number(u.tokensSalida),
            })),
            tasaExito: {
                total: totales._count.id || 0,
                errores,
                porcentaje: totales._count.id > 0
                    ? Number((((totales._count.id - errores) / totales._count.id) * 100).toFixed(1))
                    : 100,
            },
        };
    } catch (error) {
        console.error('[CostService] Error obteniendo resumen de costes:', error.message);
        throw error;
    }
}

export default {
    registrarCosteGeneracion,
    consultarCreditos,
    consultarEstadoKey,
    obtenerResumenCostes,
};
