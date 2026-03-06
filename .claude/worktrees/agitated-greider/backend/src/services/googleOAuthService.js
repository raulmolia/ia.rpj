/**
 * Servicio base para autenticación Google OAuth 2.0
 * Compartido por Google Drive y Google Docs.
 * Gestiona obtención y refresco de tokens almacenados en BD.
 */
import prismaPackage from '@prisma/client';
import { encryptToken, decryptToken } from './connectorEncryptionService.js';

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

/**
 * Refresca el access_token usando el refresh_token guardado en BD.
 */
async function refreshGoogleToken(conector) {
    if (!conector.tokenActualizacion) {
        throw new Error('No refresh_token disponible para el conector Google. Reconéctalo desde Configuración.');
    }

    const refreshToken = decryptToken(conector.tokenActualizacion);

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`[GoogleOAuth] Error refrescando token (${conector.tipo}):`, text);
        // Marcar conector con error para que el usuario sepa que debe reconectar
        await prisma.conector.update({
            where: { id: conector.id },
            data: { estado: 'ERROR' },
        });
        throw new Error('El token de Google ha expirado. Reconecta el conector desde Configuración.');
    }

    const data = await res.json();
    const expiracion = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    // Actualizar token en BD
    await prisma.conector.update({
        where: { id: conector.id },
        data: {
            tokenAcceso: encryptToken(data.access_token),
            tokenExpiracion: expiracion,
            estado: 'ACTIVO',
            // Google puede o no devolver nuevo refresh_token (normalmente no)
            ...(data.refresh_token && { tokenActualizacion: encryptToken(data.refresh_token) }),
        },
    });

    return data.access_token;
}

/**
 * Devuelve un access_token válido para el tipo de conector Google indicado.
 * Refresca automáticamente si está próximo a expirar (< 5 min).
 *
 * @param {string} usuarioId
 * @param {'GOOGLE_DRIVE'|'GOOGLE_DOCS'} tipo
 */
export async function getGoogleAccessToken(usuarioId, tipo) {
    const conector = await prisma.conector.findUnique({
        where: { usuarioId_tipo: { usuarioId, tipo } },
    });

    if (!conector) {
        throw new Error(`No tienes ${tipo === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Google Docs'} conectado. Conéctalo desde Configuración → Conectores.`);
    }

    if (conector.estado === 'INACTIVO') {
        throw new Error(`El conector de ${tipo === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Google Docs'} está pausado. Actívalo desde Configuración → Conectores.`);
    }

    if (conector.estado === 'ERROR') {
        throw new Error(`El conector de ${tipo === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Google Docs'} tiene un error. Reconéctalo desde Configuración → Conectores.`);
    }

    const now = new Date();
    const expiresAt = conector.tokenExpiracion ? new Date(conector.tokenExpiracion) : null;
    const needsRefresh = !expiresAt || (expiresAt - now) < 5 * 60 * 1000;

    if (needsRefresh) {
        return refreshGoogleToken(conector);
    }

    return decryptToken(conector.tokenAcceso);
}

/**
 * Comprueba si un usuario tiene el conector Google activo.
 *
 * @param {string} usuarioId
 * @param {'GOOGLE_DRIVE'|'GOOGLE_DOCS'} tipo
 */
export async function hasActiveGoogleConnector(usuarioId, tipo) {
    const conector = await prisma.conector.findUnique({
        where: { usuarioId_tipo: { usuarioId, tipo } },
    });
    return !!(conector && conector.estado === 'ACTIVO');
}
