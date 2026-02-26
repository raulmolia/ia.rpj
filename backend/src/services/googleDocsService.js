/**
 * Servicio Google Docs — Herramientas disponibles en el chat
 *
 * Requiere scopes:
 *   https://www.googleapis.com/auth/documents
 *   https://www.googleapis.com/auth/drive.file  (para crear documentos nuevos)
 */
import { getGoogleAccessToken } from './googleOAuthService.js';

const DOCS_API = 'https://docs.googleapis.com/v1';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * Realiza una petición autenticada a la API de Google Docs.
 */
async function docsRequest(method, path, token, body = null) {
    const options = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(body && { 'Content-Type': 'application/json' }),
        },
        ...(body && { body: JSON.stringify(body) }),
    };

    const res = await fetch(`${DOCS_API}${path}`, options);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google Docs API error (${res.status}): ${text}`);
    }

    if (res.status === 204) return null;
    return res.json();
}

/**
 * Realiza una petición autenticada a la API de Google Drive (para listar Docs).
 */
async function driveRequest(method, path, token) {
    const res = await fetch(`${DRIVE_API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google Drive API error (${res.status}): ${text}`);
    }
    return res.json();
}

// ─── Helpers de contenido ─────────────────────────────────────────────────────

/**
 * Extrae el texto plano de un documento de Google Docs.
 * Recorre los párrafos del body y concatena los textRuns.
 */
function extractDocumentText(document) {
    const content = document.body?.content || [];
    const lines = [];

    for (const element of content) {
        if (element.paragraph) {
            const parts = element.paragraph.elements || [];
            const line = parts
                .filter((e) => e.textRun)
                .map((e) => e.textRun.content)
                .join('');
            if (line.trim()) lines.push(line.trimEnd());
        }
    }

    return lines.join('\n');
}

// ─── Funciones exportadas ─────────────────────────────────────────────────────

/**
 * Lista los documentos de Google Docs del usuario.
 * @param {string} usuarioId
 * @param {{ pageSize?: number, query?: string }} options
 */
export async function listDocuments(usuarioId, { pageSize = 10, query = '' } = {}) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DOCS');

    const qParts = ["mimeType = 'application/vnd.google-apps.document'", "trashed = false"];
    if (query) qParts.push(`name contains '${query.replace(/'/g, "\\'")}'`);

    const params = new URLSearchParams({
        pageSize: String(pageSize),
        orderBy: 'modifiedTime desc',
        fields: 'files(id,name,webViewLink,modifiedTime)',
        q: qParts.join(' and '),
    });

    const data = await driveRequest('GET', `/files?${params}`, token);
    return data.files || [];
}

/**
 * Lee el contenido de un documento de Google Docs por su ID.
 * Devuelve título, texto extraído y URL de edición.
 * @param {string} usuarioId
 * @param {string} documentId
 */
export async function getDocument(usuarioId, documentId) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DOCS');
    const doc = await docsRequest('GET', `/documents/${documentId}`, token);

    return {
        id: doc.documentId,
        title: doc.title,
        url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        text: extractDocumentText(doc),
        revisionId: doc.revisionId,
    };
}

/**
 * Crea un documento nuevo en Google Docs con un título y contenido inicial.
 * @param {string} usuarioId
 * @param {string} title
 * @param {string} content  Texto plano inicial del documento
 */
export async function createDocument(usuarioId, title, content = '') {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DOCS');

    // Crear documento vacío con título
    const doc = await docsRequest('POST', '/documents', token, { title });
    const docId = doc.documentId;

    // Si hay contenido inicial, insertarlo con batchUpdate
    if (content) {
        await docsRequest('POST', `/documents/${docId}:batchUpdate`, token, {
            requests: [
                {
                    insertText: {
                        location: { index: 1 },
                        text: content,
                    },
                },
            ],
        });
    }

    return {
        id: docId,
        title: doc.title,
        url: `https://docs.google.com/document/d/${docId}/edit`,
    };
}

/**
 * Añade texto al final de un documento existente.
 * @param {string} usuarioId
 * @param {string} documentId
 * @param {string} text        Texto a añadir
 */
export async function appendToDocument(usuarioId, documentId, text) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DOCS');

    // Obtener el índice del final del documento
    const doc = await docsRequest('GET', `/documents/${documentId}?fields=body/content`, token);
    const content = doc.body?.content || [];
    const lastElement = content[content.length - 1];
    const endIndex = lastElement?.endIndex || 1;

    await docsRequest('POST', `/documents/${documentId}:batchUpdate`, token, {
        requests: [
            {
                insertText: {
                    location: { index: endIndex - 1 },
                    text: `\n${text}`,
                },
            },
        ],
    });

    return {
        success: true,
        documentId,
        url: `https://docs.google.com/document/d/${documentId}/edit`,
    };
}

/**
 * Reemplaza texto en un documento (útil para plantillas).
 * @param {string} usuarioId
 * @param {string} documentId
 * @param {{ find: string, replace: string }[]} substitutions
 */
export async function replaceTextInDocument(usuarioId, documentId, substitutions) {
    const token = await getGoogleAccessToken(usuarioId, 'GOOGLE_DOCS');

    const requests = substitutions.map(({ find, replace }) => ({
        replaceAllText: {
            containsText: { text: find, matchCase: false },
            replaceText: replace,
        },
    }));

    await docsRequest('POST', `/documents/${documentId}:batchUpdate`, token, { requests });

    return {
        success: true,
        documentId,
        url: `https://docs.google.com/document/d/${documentId}/edit`,
    };
}

// ─── Tool definitions para el LLM ─────────────────────────────────────────────

export const GOOGLE_DOCS_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'gdocs_list_documents',
            description: 'Lista los documentos de Google Docs del usuario, opcionalmente filtrando por nombre.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Texto para filtrar documentos por nombre (opcional)' },
                    pageSize: { type: 'number', description: 'Número de documentos a listar (por defecto 10, máximo 50)' },
                },
                required: [],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'gdocs_get_document',
            description: 'Lee el contenido completo de un documento de Google Docs dado su ID. Devuelve el texto del documento.',
            parameters: {
                type: 'object',
                properties: {
                    documentId: { type: 'string', description: 'ID del documento de Google Docs' },
                },
                required: ['documentId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'gdocs_create_document',
            description: 'Crea un documento nuevo en Google Docs con un título y contenido inicial.',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Título del documento' },
                    content: { type: 'string', description: 'Contenido de texto inicial del documento (opcional)' },
                },
                required: ['title'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'gdocs_append_to_document',
            description: 'Añade texto al final de un documento de Google Docs existente.',
            parameters: {
                type: 'object',
                properties: {
                    documentId: { type: 'string', description: 'ID del documento de Google Docs' },
                    text: { type: 'string', description: 'Texto a añadir al final del documento' },
                },
                required: ['documentId', 'text'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'gdocs_replace_text',
            description: 'Reemplaza texto en un documento de Google Docs. Útil para rellenar plantillas.',
            parameters: {
                type: 'object',
                properties: {
                    documentId: { type: 'string', description: 'ID del documento de Google Docs' },
                    substitutions: {
                        type: 'array',
                        description: 'Lista de sustituciones a aplicar',
                        items: {
                            type: 'object',
                            properties: {
                                find: { type: 'string', description: 'Texto a buscar' },
                                replace: { type: 'string', description: 'Texto de reemplazo' },
                            },
                            required: ['find', 'replace'],
                        },
                    },
                },
                required: ['documentId', 'substitutions'],
            },
        },
    },
];

/**
 * Ejecuta una herramienta de Google Docs a partir de su nombre y argumentos.
 */
export async function executeGoogleDocsTool(usuarioId, toolName, args) {
    switch (toolName) {
        case 'gdocs_list_documents':
            return listDocuments(usuarioId, args);
        case 'gdocs_get_document':
            return getDocument(usuarioId, args.documentId);
        case 'gdocs_create_document':
            return createDocument(usuarioId, args.title, args.content);
        case 'gdocs_append_to_document':
            return appendToDocument(usuarioId, args.documentId, args.text);
        case 'gdocs_replace_text':
            return replaceTextInDocument(usuarioId, args.documentId, args.substitutions);
        default:
            throw new Error(`Herramienta Google Docs desconocida: ${toolName}`);
    }
}
