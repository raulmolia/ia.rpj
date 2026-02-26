/**
 * Servicio Google Drive — Herramientas disponibles en el chat
 *
 * Requiere scopes:
 *   https://www.googleapis.com/auth/drive.readonly
 *   https://www.googleapis.com/auth/drive.file  (para crear/subir)
 */
import { getGoogleAccessToken } from './googleOAuthService.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * Realiza una petición autenticada a la API de Google Drive.
 */
async function driveRequest(method, path, token, body = null) {
    const options = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(body && { 'Content-Type': 'application/json' }),
        },
        ...(body && { body: JSON.stringify(body) }),
    };

    const res = await fetch(`${DRIVE_API}${path}`, options);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google Drive API error (${res.status}): ${text}`);
    }

    // Algunos endpoints devuelven 204 sin body
    if (res.status === 204) return null;
    return res.json();
}

// ─── Funciones exportadas ─────────────────────────────────────────────────────

/**
 * Lista archivos y carpetas del Drive del usuario.
 * @param {string} usuarioId
 * @param {{ query?: string, pageSize?: number, mimeType?: string }} options
 */
export async function listFiles(usuarioId, { query = '', pageSize = 10, mimeType = '' } = {}) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DRIVE');

    const qParts = ["trashed = false"];
    if (query) qParts.push(`name contains '${query.replace(/'/g, "\\'")}'`);
    if (mimeType) qParts.push(`mimeType = '${mimeType}'`);

    const params = new URLSearchParams({
        pageSize: String(pageSize),
        orderBy: 'modifiedTime desc',
        fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size,parents)',
        q: qParts.join(' and '),
    });

    const data = await driveRequest('GET', `/files?${params}`, token);
    return data.files || [];
}

/**
 * Busca archivos por texto en el contenido y nombre.
 * @param {string} usuarioId
 * @param {string} searchQuery
 * @param {number} limit
 */
export async function searchFiles(usuarioId, searchQuery, limit = 8) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DRIVE');

    const q = `fullText contains '${searchQuery.replace(/'/g, "\\'")}' and trashed = false`;
    const params = new URLSearchParams({
        pageSize: String(limit),
        orderBy: 'relevanceScore desc',
        fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
        q,
    });

    const data = await driveRequest('GET', `/files?${params}`, token);
    return data.files || [];
}

/**
 * Obtiene metadatos de un archivo por su ID.
 * @param {string} usuarioId
 * @param {string} fileId
 */
export async function getFile(usuarioId, fileId) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DRIVE');
    return driveRequest('GET', `/files/${fileId}?fields=id,name,mimeType,webViewLink,description,modifiedTime,size,parents,owners`, token);
}

/**
 * Crea una carpeta en Drive.
 * @param {string} usuarioId
 * @param {string} name
 * @param {string|null} parentId  ID de la carpeta padre (o null para root)
 */
export async function createFolder(usuarioId, name, parentId = null) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DRIVE');
    const body = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId && { parents: [parentId] }),
    };
    const data = await driveRequest('POST', '/files?fields=id,name,webViewLink', token, body);
    return { id: data.id, name: data.name, url: data.webViewLink };
}

/**
 * Mueve un archivo a la papelera.
 * @param {string} usuarioId
 * @param {string} fileId
 */
export async function trashFile(usuarioId, fileId) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DRIVE');
    await driveRequest('PATCH', `/files/${fileId}?fields=id,trashed`, token, { trashed: true });
    return { success: true };
}

// ─── CANVA_TOOLS equivalente para LLM (tool definitions) ─────────────────────

export const GOOGLE_DRIVE_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'gdrive_list_files',
            description: 'Lista archivos y carpetas del Google Drive del usuario. Útil para ver qué tiene guardado, buscar por nombre o filtrar por tipo de archivo.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Texto para filtrar por nombre de archivo (opcional)' },
                    pageSize: { type: 'number', description: 'Número de resultados (por defecto 10, máximo 50)' },
                    mimeType: { type: 'string', description: 'Filtrar por tipo MIME, p.e. "application/vnd.google-apps.document" para Docs, "application/vnd.google-apps.spreadsheet" para Sheets' },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'gdrive_search_files',
            description: 'Busca archivos en Google Drive por contenido o nombre. Más potente que listar ya que busca dentro del texto de los archivos.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Texto a buscar en nombre y contenido de los archivos' },
                    limit: { type: 'number', description: 'Número máximo de resultados (por defecto 8)' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'gdrive_get_file',
            description: 'Obtiene los metadatos detallados de un archivo de Google Drive por su ID.',
            parameters: {
                type: 'object',
                properties: {
                    fileId: { type: 'string', description: 'ID del archivo en Google Drive' },
                },
                required: ['fileId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'gdrive_create_folder',
            description: 'Crea una carpeta nueva en Google Drive.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Nombre de la carpeta a crear' },
                    parentId: { type: 'string', description: 'ID de la carpeta padre (opcional, si no se indica se crea en root)' },
                },
                required: ['name'],
            },
        },
    },
];

/**
 * Ejecuta una herramienta de Google Drive a partir de su nombre y argumentos.
 */
export async function executeGoogleDriveTool(usuarioId, toolName, args) {
    switch (toolName) {
        case 'gdrive_list_files':
            return listFiles(usuarioId, args);
        case 'gdrive_search_files':
            return searchFiles(usuarioId, args.query, args.limit);
        case 'gdrive_get_file':
            return getFile(usuarioId, args.fileId);
        case 'gdrive_create_folder':
            return createFolder(usuarioId, args.name, args.parentId);
        default:
            throw new Error(`Herramienta Google Drive desconocida: ${toolName}`);
    }
}
