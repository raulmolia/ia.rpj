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

// ─── Mapeo de tipos de diseño ─────────────────────────────────────────────────

/**
 * Mapeo de tipos conceptuales a parámetros reales de la API de Canva.
 * La API solo admite 3 presets: doc, whiteboard, presentation.
 * Para el resto usamos custom_size con dimensiones estándar (en px a 300dpi).
 */
const DESIGN_TYPE_MAP = {
    doc:          { type: 'preset', name: 'doc' },
    whiteboard:   { type: 'preset', name: 'whiteboard' },
    presentation: { type: 'preset', name: 'presentation' },
    poster:       { type: 'custom', width: 2480, height: 3508 },     // A4 vertical
    banner:       { type: 'custom', width: 4961, height: 1748 },     // Banner horizontal
    flyer:        { type: 'custom', width: 2480, height: 3508 },     // A4 vertical
    social_post:  { type: 'custom', width: 1080, height: 1080 },     // Cuadrado (Instagram)
    story:        { type: 'custom', width: 1080, height: 1920 },     // Vertical (Stories)
    card:         { type: 'custom', width: 1500, height: 1050 },     // Tarjeta horizontal
};

/** Nombres legibles para mostrar al usuario */
const DESIGN_TYPE_LABELS = {
    doc: 'Documento',
    whiteboard: 'Pizarra',
    presentation: 'Presentación',
    poster: 'Póster / Cartel',
    banner: 'Banner',
    flyer: 'Folleto',
    social_post: 'Post redes sociales',
    story: 'Historia / Story',
    card: 'Tarjeta',
};

// ─── Herramientas Canva ───────────────────────────────────────────────────────

/**
 * Lista los diseños recientes del usuario en Canva.
 */
export async function listDesigns(usuarioId, { limit = 10, query = '' } = {}) {
    const token = await getValidAccessToken(usuarioId);
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('query', query);
    const data = await canvaRequest('GET', `/designs?${params}`, token);
    // Incluir thumbnails en la respuesta
    return (data.items || []).map(item => ({
        id: item.id,
        title: item.title || 'Sin título',
        thumbnail_url: item.thumbnail?.url || null,
        edit_url: item.urls?.edit_url || `https://www.canva.com/design/${item.id}/edit`,
        created_at: item.created_at,
        updated_at: item.updated_at,
    }));
}

/**
 * Obtiene metadatos de un diseño por ID.
 */
export async function getDesign(usuarioId, designId) {
    const token = await getValidAccessToken(usuarioId);
    const result = await canvaRequest('GET', `/designs/${designId}`, token);
    const design = result.design || result;
    return {
        id: design.id,
        title: design.title || 'Sin título',
        thumbnail_url: design.thumbnail?.url || null,
        edit_url: design.urls?.edit_url || `https://www.canva.com/design/${design.id}/edit`,
        created_at: design.created_at,
        updated_at: design.updated_at,
        page_count: design.page_count || null,
    };
}

/**
 * Crea un nuevo diseño en blanco.
 * Acepta tipos extendidos: doc, whiteboard, presentation, poster, banner, flyer, social_post, story, card.
 * Para tipos sin preset nativo se usa custom_size con las dimensiones del DESIGN_TYPE_MAP.
 */
export async function createDesign(usuarioId, { designTypeId = 'doc', title = '' } = {}) {
    const token = await getValidAccessToken(usuarioId);
    const mapping = DESIGN_TYPE_MAP[designTypeId] || DESIGN_TYPE_MAP.doc;

    const body = {};
    if (mapping.type === 'preset') {
        body.design_type = { type: 'preset', name: mapping.name };
    } else {
        // custom con dimensiones para tipos como poster, banner, flyer, etc.
        body.design_type = { type: 'custom', width: mapping.width, height: mapping.height };
    }
    if (title) body.title = title;

    console.log(`[Canva] createDesign body:`, JSON.stringify(body));

    const result = await canvaRequest('POST', '/designs', token, body);
    const design = result.design || result;
    const editUrl = design.urls?.edit_url || design.url || `https://www.canva.com/design/${design.id}/edit`;

    return {
        id: design.id,
        title: design.title || title,
        edit_url: editUrl,
        thumbnail_url: design.thumbnail?.url || null,
        type: designTypeId,
        type_label: DESIGN_TYPE_LABELS[designTypeId] || designTypeId,
        created_at: design.created_at,
    };
}

/**
 * Crea múltiples diseños del MISMO tipo.
 * El LLM llama a esta función una sola vez con count=3 (por ejemplo)
 * y el backend ejecuta N llamadas secuenciales a la API de Canva.
 *
 * @param {number} usuarioId
 * @param {object} options
 * @param {string} options.designTypeId - Tipo de diseño (doc, poster, presentation, etc.)
 * @param {string} options.titleBase - Título base para los diseños
 * @param {number} options.count - Número de diseños a crear (1-5, por defecto 3)
 * @returns {Promise<Array>} Array con los diseños creados
 */
export async function createMultipleDesigns(usuarioId, { designTypeId = 'doc', titleBase = '', count = 3 } = {}) {
    // Limitar entre 1 y 5 para no abusar de la API (20 req/min por usuario)
    const safeCount = Math.max(1, Math.min(5, count));
    const results = [];

    for (let i = 0; i < safeCount; i++) {
        const suffix = safeCount > 1 ? ` — Opción ${i + 1}` : '';
        const title = titleBase ? `${titleBase}${suffix}` : `Diseño${suffix}`;
        try {
            const design = await createDesign(usuarioId, { designTypeId, title });
            design.is_blank_canvas = true;
            results.push(design);
        } catch (err) {
            console.error(`[Canva] Error creando diseño ${i + 1}/${safeCount}:`, err.message);
            results.push({ error: err.message, index: i + 1 });
        }
    }

    // Generar URL de búsqueda de plantillas relevantes en Canva
    const typeToTemplateCategory = {
        poster: 'posters', presentation: 'presentations', doc: 'documents',
        whiteboard: 'whiteboards', banner: 'banners', flyer: 'flyers',
        social_post: 'social-media', story: 'instagram-stories', card: 'cards',
    };
    const category = typeToTemplateCategory[designTypeId] || '';
    const searchTerms = titleBase.replace(/[^\w\sáéíóúñ]/g, '').trim().replace(/\s+/g, '+');
    const templateSearchUrl = category
        ? `https://www.canva.com/${category}/templates/?query=${encodeURIComponent(searchTerms)}`
        : `https://www.canva.com/templates/?query=${encodeURIComponent(searchTerms)}`;

    return {
        designs: results,
        template_search_url: templateSearchUrl,
        design_type: designTypeId,
        design_type_label: DESIGN_TYPE_LABELS[designTypeId] || designTypeId,
        note: 'Los lienzos se han creado en blanco con el formato correcto. Usa las sugerencias de contenido o busca una plantilla para personalizarlos.',
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
            name: 'canva_create_designs',
            description:
                'Crea varios diseños en blanco en Canva del MISMO tipo y devuelve un array con los enlaces. ' +
                'IMPORTANTE: Crea siempre el número indicado en count (por defecto 3) del MISMO design_type. ' +
                'NUNCA crees un diseño de cada tipo diferente. Si el usuario pide un cartel, crea 3 carteles (poster). ' +
                'Si pide una presentación, crea 3 presentaciones. Cada diseño tendrá un título ligeramente distinto.',
            parameters: {
                type: 'object',
                properties: {
                    design_type: {
                        type: 'string',
                        description:
                            'Tipo de diseño a crear. Mapeo de lo que pide el usuario:\n' +
                            '• "doc" → documento de texto, hoja, folio\n' +
                            '• "whiteboard" → pizarra, brainstorming, mapa mental\n' +
                            '• "presentation" → presentación, diapositivas\n' +
                            '• "poster" → cartel, póster, afiche (A4 vertical)\n' +
                            '• "banner" → banner, cabecera, pancarta (formato horizontal ancho)\n' +
                            '• "flyer" → folleto, octavilla, volante (A4 vertical)\n' +
                            '• "social_post" → post para redes sociales, publicación cuadrada\n' +
                            '• "story" → historia, story, formato vertical tipo Instagram/TikTok\n' +
                            '• "card" → tarjeta, invitación, postal',
                        enum: ['doc', 'whiteboard', 'presentation', 'poster', 'banner', 'flyer', 'social_post', 'story', 'card'],
                    },
                    title_base: {
                        type: 'string',
                        description: 'Título descriptivo para los diseños. Se añadirá "— Opción 1/2/3" automáticamente.',
                    },
                    count: {
                        type: 'number',
                        description: 'Número de diseños a crear (entre 1 y 5). Por defecto 3.',
                    },
                },
                required: ['design_type', 'title_base'],
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

        // Mantener compatibilidad con la tool antigua (singular)
        case 'canva_create_design':
            return createMultipleDesigns(usuarioId, {
                designTypeId: args.design_type,
                titleBase: args.title || args.title_base || '',
                count: args.count || 3,
            });

        // Nueva tool (plural) — flujo principal
        case 'canva_create_designs':
            return createMultipleDesigns(usuarioId, {
                designTypeId: args.design_type,
                titleBase: args.title_base || '',
                count: args.count || 3,
            });

        case 'canva_export_design':
            return exportDesign(usuarioId, args.design_id, args.format);

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
