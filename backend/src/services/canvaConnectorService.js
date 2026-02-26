/**
 * canvaConnectorService.js
 * Cliente para la Canva Connect API.
 * Gestiona tokens OAuth (refresh automático) y expone herramientas (tools)
 * listas para ser inyectadas al LLM en el flujo de chat.
 */
import prismaPackage from '@prisma/client';
import { encryptToken, decryptToken } from './connectorEncryptionService.js';

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID || '';
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET || '';

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Llama a la Canva API con el token del usuario */
async function canvaRequest(method, path, accessToken, body = null) {
    const options = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${CANVA_API_BASE}${path}`, options);

    if (!res.ok) {
        const text = await res.text();
        const err = new Error(`Canva API error ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

/** Refresca el access_token usando el refresh_token y actualiza la BD */
async function refreshAccessToken(conector) {
    if (!conector.tokenActualizacion) {
        throw new Error('No hay refresh token disponible para renovar la sesión de Canva');
    }

    const refreshToken = decryptToken(conector.tokenActualizacion);

    const credentials = Buffer.from(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });

    const res = await fetch(CANVA_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
        },
        body: params.toString(),
    });

    if (!res.ok) {
        const text = await res.text();
        // Marcar el conector como ERROR si el refresh falla
        await prisma.conector.update({
            where: { id: conector.id },
            data: { estado: 'ERROR' },
        });
        throw new Error(`No se pudo renovar el token de Canva: ${text}`);
    }

    const data = await res.json();
    const expiracion = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    await prisma.conector.update({
        where: { id: conector.id },
        data: {
            tokenAcceso: encryptToken(data.access_token),
            tokenActualizacion: data.refresh_token
                ? encryptToken(data.refresh_token)
                : conector.tokenActualizacion,
            tokenExpiracion: expiracion,
            estado: 'ACTIVO',
        },
    });

    return data.access_token;
}

/**
 * Devuelve el access_token en claro, refrescándolo si está próximo a expirar.
 * Lanza error si el conector está inactivo o en error.
 */
export async function getValidAccessToken(usuarioId) {
    const conector = await prisma.conector.findUnique({
        where: { usuarioId_tipo: { usuarioId, tipo: 'CANVA' } },
    });

    if (!conector) {
        throw new Error('No tienes Canva conectado. Conéctalo desde Configuración → Conectores.');
    }

    if (conector.estado === 'INACTIVO') {
        throw new Error('El conector de Canva está pausado. Actívalo desde Configuración → Conectores.');
    }

    if (conector.estado === 'ERROR') {
        throw new Error('El conector de Canva tiene un error. Reconéctalo desde Configuración → Conectores.');
    }

    // Refrescar si expira en menos de 5 minutos
    const now = new Date();
    const expiresAt = conector.tokenExpiracion ? new Date(conector.tokenExpiracion) : null;
    const needsRefresh = !expiresAt || (expiresAt - now) < 5 * 60 * 1000;

    if (needsRefresh) {
        return refreshAccessToken(conector);
    }

    return decryptToken(conector.tokenAcceso);
}

// ─── Herramientas Canva ───────────────────────────────────────────────────────

/**
 * Lista los diseños recientes del usuario en Canva.
 */
export async function listDesigns(usuarioId, { limit = 10, query = '' } = {}) {
    const token = await getValidAccessToken(usuarioId);
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('query', query);
    const data = await canvaRequest('GET', `/designs?${params}`, token);
    return data.items || [];
}

/**
 * Obtiene metadatos de un diseño por ID.
 */
export async function getDesign(usuarioId, designId) {
    const token = await getValidAccessToken(usuarioId);
    return canvaRequest('GET', `/designs/${designId}`, token);
}

/**
 * Crea un nuevo diseño en blanco.
 * Tipos válidos según la API de Canva Connect: "doc", "whiteboard", "presentation"
 */
export async function createDesign(usuarioId, { designTypeId = 'doc', title = '' } = {}) {
    const token = await getValidAccessToken(usuarioId);
    const body = {
        design_type: { type: 'preset', name: designTypeId },
    };
    if (title) body.title = title;
    const result = await canvaRequest('POST', '/designs', token, body);
    // La URL real está en design.urls.edit_url (JWT temporal generado por Canva)
    const design = result.design || result;
    const editUrl = design.urls?.edit_url || design.url || `https://www.canva.com/design/${design.id}/edit`;
    return {
        id: design.id,
        title: design.title || title,
        edit_url: editUrl,
        type: designTypeId,
        created_at: design.created_at,
    };
}

/**
 * Exporta un diseño como PDF, PNG o JPG.
 */
export async function exportDesign(usuarioId, designId, format = 'pdf') {
    const token = await getValidAccessToken(usuarioId);

    // Crear job de exportación
    const job = await canvaRequest('POST', `/designs/${designId}/exports`, token, {
        format: format.toUpperCase(),
    });

    const jobId = job.job?.id;
    if (!jobId) throw new Error('No se pudo iniciar la exportación en Canva');

    // Esperar a que el job complete (polling hasta 30s)
    for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await canvaRequest('GET', `/designs/${designId}/exports/${jobId}`, token);
        if (status.job?.status === 'success') {
            return status.job.urls?.[0] || null;
        }
        if (status.job?.status === 'failed') {
            throw new Error('La exportación del diseño falló en Canva');
        }
    }
    throw new Error('Tiempo de espera agotado para la exportación de Canva');
}

/**
 * Busca templates en Canva por texto.
 */
export async function findTemplates(usuarioId, query, limit = 8) {
    const token = await getValidAccessToken(usuarioId);
    const params = new URLSearchParams({ query, limit: String(limit) });
    const data = await canvaRequest('GET', `/templates?${params}`, token);
    return data.items || [];
}

// ─── Definición de tools para el LLM ─────────────────────────────────────────

/**
 * Devuelve las tools de Canva listas para inyectar al array tools del LLM.
 * Solo se llama si el usuario tiene suscripción PRO o rol privilegiado.
 */
export const CANVA_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'canva_list_designs',
            description: 'Lista los diseños recientes del usuario en Canva. Úsala cuando el usuario pregunte por sus diseños, quiera ver qué tiene en Canva o seleccionar uno para trabajar.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Texto de búsqueda para filtrar diseños por nombre (opcional)',
                    },
                    limit: {
                        type: 'number',
                        description: 'Número de resultados a devolver (por defecto 10, máximo 50)',
                    },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'canva_get_design',
            description: 'Obtiene los detalles completos de un diseño de Canva por su ID.',
            parameters: {
                type: 'object',
                properties: {
                    design_id: {
                        type: 'string',
                        description: 'El ID del diseño en Canva',
                    },
                },
                required: ['design_id'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'canva_create_design',
            description: 'Crea un nuevo diseño en blanco en Canva y devuelve el enlace directo (edit_url) para editarlo. ' +
                'Cuando el usuario pida crear algo en Canva, llama a esta función TRES VECES con los 3 tipos disponibles: ' +
                '"doc", "whiteboard" y "presentation". Cada respuesta incluye "edit_url" con el enlace real y funcional.',
            parameters: {
                type: 'object',
                properties: {
                    design_type: {
                        type: 'string',
                        description: 'Tipo de diseño. Únicos valores válidos aceptados por la API de Canva: ' +
                            '"doc" (documento de texto, ideal para hojas impresas y contenido escrito), ' +
                            '"whiteboard" (pizarra colaborativa, ideal para mapas mentales y lluvia de ideas), ' +
                            '"presentation" (presentación de diapositivas, ideal para proyectar)',
                        enum: ['doc', 'whiteboard', 'presentation'],
                    },
                    title: {
                        type: 'string',
                        description: 'Título o nombre para el nuevo diseño (entre 1 y 255 caracteres)',
                    },
                },
                required: ['design_type'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'canva_export_design',
            description: 'Exporta un diseño de Canva como PDF, PNG o JPG y devuelve la URL de descarga.',
            parameters: {
                type: 'object',
                properties: {
                    design_id: {
                        type: 'string',
                        description: 'El ID del diseño a exportar',
                    },
                    format: {
                        type: 'string',
                        description: 'Formato de exportación: "pdf", "png" o "jpg"',
                        enum: ['pdf', 'png', 'jpg'],
                    },
                },
                required: ['design_id', 'format'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'canva_find_templates',
            description: 'Busca plantillas disponibles en Canva por texto. Úsala cuando el usuario quiera buscar una plantilla para empezar un diseño.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Términos de búsqueda para encontrar plantillas (en español o inglés)',
                    },
                    limit: {
                        type: 'number',
                        description: 'Número de resultados (por defecto 8)',
                    },
                },
                required: ['query'],
            },
        },
    },
];

/**
 * Ejecuta una tool de Canva dado su nombre y argumentos.
 * Devuelve el resultado como objeto JSON.
 */
export async function executeCanvaTool(usuarioId, toolName, args) {
    switch (toolName) {
        case 'canva_list_designs':
            return listDesigns(usuarioId, args);

        case 'canva_get_design':
            return getDesign(usuarioId, args.design_id);

        case 'canva_create_design':
            return createDesign(usuarioId, {
                designTypeId: args.design_type,
                title: args.title || '',
            });

        case 'canva_export_design':
            return exportDesign(usuarioId, args.design_id, args.format);

        case 'canva_find_templates':
            return findTemplates(usuarioId, args.query, args.limit);

        default:
            throw new Error(`Tool de Canva desconocida: ${toolName}`);
    }
}

/**
 * Comprueba si un usuario tiene el conector Canva activo.
 */
export async function hasActiveCanvaConnector(usuarioId) {
    const conector = await prisma.conector.findUnique({
        where: { usuarioId_tipo: { usuarioId, tipo: 'CANVA' } },
        select: { estado: true },
    });
    return conector?.estado === 'ACTIVO';
}
