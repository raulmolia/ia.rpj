/**
 * Rutas de conectores externos (MCPs)
 * Gestiona la autenticación OAuth y el ciclo de vida de los conectores.
 * Los conectores solo están disponibles para usuarios PRO o con roles privilegiados.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prismaPackage from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { encryptToken, decryptToken } from '../services/connectorEncryptionService.js';
import logService from '../services/logService.js';

import { listFiles, searchFiles, getFile } from '../services/googleDriveService.js';
import { getGoogleAccessToken, hasActiveGoogleConnector } from '../services/googleOAuthService.js';

// Almacén temporal en memoria para code_verifier PKCE (TTL 10 min)
// Clave: state JWT string  |  Valor: { codeVerifier, expires }
const pkceStore = new Map();

/** Genera un code_verifier PKCE (96 bytes base64url) */
function generateCodeVerifier() {
    return crypto.randomBytes(96).toString('base64url');
}

/** Deriva el code_challenge SHA-256 desde un code_verifier */
function deriveCodeChallenge(codeVerifier) {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

/** Limpieza periódica de entradas expiradas del pkceStore */
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of pkceStore.entries()) {
        if (value.expires < now) pkceStore.delete(key);
    }
}, 5 * 60 * 1000); // cada 5 minutos

const { PrismaClient } = prismaPackage;
const router = express.Router();
const prisma = new PrismaClient();

// ─── Credenciales Google OAuth 2.0 ──────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Redirect URIs (deben coincidir exactamente con los registrados en Google Cloud Console)
const GOOGLE_DRIVE_REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI
    || 'https://ia.rpj.es/api/conectores/google-drive/callback';
const GOOGLE_DOCS_REDIRECT_URI = process.env.GOOGLE_DOCS_REDIRECT_URI
    || 'https://ia.rpj.es/api/conectores/google-docs/callback';

// Scopes por conector Google
// - drive.file: crear archivos nuevos y gestionar SOLO los creados por la app (no toca nada del usuario)
// - drive.readonly: navegar/leer archivos del Drive (sin poder modificarlos ni borrarlos)
const GOOGLE_DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'openid',
    'email',
    'profile',
].join(' ');

// - documents: crear y editar Google Docs vía la API de Docs
// - drive.file: ya incluido implícitamente al crear docs desde la app
const GOOGLE_DOCS_SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file',
    'openid',
    'email',
    'profile',
].join(' ');

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'change-me';
const OAUTH_STATE_TTL = 10 * 60; // 10 minutos

// Roles con acceso a conectores (todos menos USUARIO FREE)
const PRO_ROLES = new Set(['SUPERADMIN', 'ADMINISTRADOR', 'DOCUMENTADOR', 'DOCUMENTADOR_JUNIOR']);

/** Middleware: solo usuarios PRO o roles privilegiados */
function requireConnectorAccess(req, res, next) {
    const user = req.user;
    const isPro = user.tipoSuscripcion === 'PRO';
    const isPrivileged = PRO_ROLES.has(user.rol);

    if (!isPro && !isPrivileged) {
        return res.status(403).json({
            error: 'Acceso restringido',
            message: 'Los conectores externos están disponibles únicamente para usuarios Pro.',
            upgradeRequired: true,
        });
    }
    next();
}

// ─── GET /api/conectores ─────────────────────────────────────────────────────
// Lista los conectores del usuario autenticado
router.get('/', authenticate, requireConnectorAccess, async (req, res) => {
    try {
        const conectores = await prisma.conector.findMany({
            where: { usuarioId: req.user.id },
            select: {
                id: true,
                tipo: true,
                estado: true,
                config: true,
                fechaCreacion: true,
                fechaActualizacion: true,
                tokenExpiracion: true,
            },
        });

        return res.json({ conectores });
    } catch (error) {
        console.error('❌ Error listando conectores:', error);
        return res.status(500).json({ error: 'Error obteniendo conectores' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH 2.0  (Drive + Docs comparten el mismo flujo, distinto tipo/scope)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper interno: genera la URL de autorización Google y redirige.
 * @param {'google-drive'|'google-docs'} connector
 */
function buildGoogleAuthRoute(connector) {
    const tipo = connector === 'google-drive' ? 'GOOGLE_DRIVE' : 'GOOGLE_DOCS';
    const scopes = connector === 'google-drive' ? GOOGLE_DRIVE_SCOPES : GOOGLE_DOCS_SCOPES;
    const redirectUri = connector === 'google-drive' ? GOOGLE_DRIVE_REDIRECT_URI : GOOGLE_DOCS_REDIRECT_URI;

    return (req, res) => {
        if (!GOOGLE_CLIENT_ID) {
            return res.status(503).json({
                error: 'Conector no configurado',
                message: `El conector de ${tipo === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Google Docs'} no está configurado en el servidor.`,
            });
        }

        const state = jwt.sign(
            { userId: req.user.id, connector: tipo },
            JWT_SECRET,
            { expiresIn: OAUTH_STATE_TTL }
        );

        const codeVerifier = generateCodeVerifier();
        const codeChallenge = deriveCodeChallenge(codeVerifier);
        pkceStore.set(state, { codeVerifier, expires: Date.now() + OAUTH_STATE_TTL * 1000 });

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            scope: scopes,
            state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            access_type: 'offline',   // Obtener refresh_token
            prompt: 'consent',         // Forzar pantalla de consentimiento para obtener refresh_token siempre
        });

        logService.logInfo('SISTEMA', `Inicio flujo OAuth ${tipo}`, {
            usuarioId: req.user.id,
            detalles: { connector: tipo },
        });

        return res.json({ authUrl: `${GOOGLE_AUTH_URL}?${params}` });
    };
}

/**
 * Helper interno: procesa el callback OAuth Google.
 * @param {'GOOGLE_DRIVE'|'GOOGLE_DOCS'} tipo
 * @param {string} redirectUri
 */
function buildGoogleCallbackRoute(tipo, redirectUri) {
    return async (req, res) => {
        const { code, state, error: oauthError } = req.query;
        const frontendBase = process.env.FRONTEND_URL || 'https://ia.rpj.es';
        const connectorParam = tipo === 'GOOGLE_DRIVE' ? 'google-drive' : 'google-docs';

        if (oauthError) {
            return res.redirect(`${frontendBase}/?connector=${connectorParam}&status=denied`);
        }
        if (!code || !state) {
            return res.redirect(`${frontendBase}/?connector=${connectorParam}&status=error`);
        }

        let statePayload;
        try {
            statePayload = jwt.verify(String(state), JWT_SECRET);
        } catch {
            return res.redirect(`${frontendBase}/?connector=${connectorParam}&status=invalid_state`);
        }

        const { userId } = statePayload;
        if (!userId) {
            pkceStore.delete(String(state));
            return res.redirect(`${frontendBase}/?connector=${connectorParam}&status=error`);
        }

        const pkceEntry = pkceStore.get(String(state));
        if (!pkceEntry || pkceEntry.expires < Date.now()) {
            pkceStore.delete(String(state));
            return res.redirect(`${frontendBase}/?connector=${connectorParam}&status=invalid_state`);
        }
        const { codeVerifier } = pkceEntry;
        pkceStore.delete(String(state));

        try {
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: redirectUri,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                code_verifier: codeVerifier,
            });

            const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });

            if (!tokenRes.ok) {
                const text = await tokenRes.text();
                console.error(`❌ Error intercambiando token ${tipo}:`, text);
                return res.redirect(`${frontendBase}/?connector=${connectorParam}&status=token_error`);
            }

            const tokenData = await tokenRes.json();
            const expiracion = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

            // Obtener info del perfil Google
            let googleUser = null;
            try {
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                });
                if (profileRes.ok) googleUser = await profileRes.json();
            } catch { /* ignorar si falla */ }

            await prisma.conector.upsert({
                where: { usuarioId_tipo: { usuarioId: userId, tipo } },
                update: {
                    estado: 'ACTIVO',
                    tokenAcceso: encryptToken(tokenData.access_token),
                    tokenActualizacion: tokenData.refresh_token
                        ? encryptToken(tokenData.refresh_token)
                        : undefined,
                    tokenExpiracion: expiracion,
                    config: googleUser
                        ? { googleEmail: googleUser.email, googleName: googleUser.name, googlePicture: googleUser.picture }
                        : undefined,
                },
                create: {
                    usuarioId: userId,
                    tipo,
                    estado: 'ACTIVO',
                    tokenAcceso: encryptToken(tokenData.access_token),
                    tokenActualizacion: tokenData.refresh_token
                        ? encryptToken(tokenData.refresh_token)
                        : null,
                    tokenExpiracion: expiracion,
                    config: googleUser
                        ? { googleEmail: googleUser.email, googleName: googleUser.name, googlePicture: googleUser.picture }
                        : null,
                },
            });

            logService.logInfo('SISTEMA', `Conector ${tipo} conectado correctamente`, {
                usuarioId: userId,
                detalles: { connector: tipo },
            });

            return res.redirect(`${frontendBase}/?connector=${connectorParam}&status=success`);
        } catch (error) {
            console.error(`❌ Error en callback ${tipo}:`, error);
            return res.redirect(`${frontendBase}/?connector=${connectorParam}&status=error`);
        }
    };
}

// ─── GET /api/conectores/google-drive/auth ───────────────────────────────────
router.get('/google-drive/auth', authenticate, requireConnectorAccess, buildGoogleAuthRoute('google-drive'));

// ─── GET /api/conectores/google-drive/callback ───────────────────────────────
router.get('/google-drive/callback', buildGoogleCallbackRoute('GOOGLE_DRIVE', GOOGLE_DRIVE_REDIRECT_URI));

// ─── GET /api/conectores/google-docs/auth ────────────────────────────────────
router.get('/google-docs/auth', authenticate, requireConnectorAccess, buildGoogleAuthRoute('google-docs'));

// ─── GET /api/conectores/google-docs/callback ────────────────────────────────
router.get('/google-docs/callback', buildGoogleCallbackRoute('GOOGLE_DOCS', GOOGLE_DOCS_REDIRECT_URI));

// ─── PATCH /api/conectores/:id ───────────────────────────────────────────────
// Activar o pausar un conector
router.patch('/:id', authenticate, requireConnectorAccess, async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
        return res.status(400).json({ error: 'El campo "activo" debe ser booleano' });
    }

    try {
        const conector = await prisma.conector.findUnique({ where: { id } });

        if (!conector || conector.usuarioId !== req.user.id) {
            return res.status(404).json({ error: 'Conector no encontrado' });
        }

        await prisma.conector.update({
            where: { id },
            data: { estado: activo ? 'ACTIVO' : 'INACTIVO' },
        });

        return res.json({ message: activo ? 'Conector activado' : 'Conector pausado' });
    } catch (error) {
        console.error('❌ Error actualizando conector:', error);
        return res.status(500).json({ error: 'Error actualizando conector' });
    }
});

// ─── DELETE /api/conectores/:id ──────────────────────────────────────────────
// Desconectar y eliminar el conector (borra tokens)
router.delete('/:id', authenticate, requireConnectorAccess, async (req, res) => {
    const { id } = req.params;

    try {
        const conector = await prisma.conector.findUnique({ where: { id } });

        if (!conector || conector.usuarioId !== req.user.id) {
            return res.status(404).json({ error: 'Conector no encontrado' });
        }

        await prisma.conector.delete({ where: { id } });

        logService.logInfo('SISTEMA', 'Conector desconectado', {
            usuarioId: req.user.id,
            detalles: { tipo: conector.tipo },
        });

        return res.json({ message: 'Conector desconectado correctamente' });
    } catch (error) {
        console.error('❌ Error eliminando conector:', error);
        return res.status(500).json({ error: 'Error eliminando conector' });
    }
});

// ─── GET /api/conectores/google-drive/files ──────────────────────────────────
// Listar / buscar archivos del Drive del usuario (para el file picker del frontend)
router.get('/google-drive/files', authenticate, requireConnectorAccess, async (req, res) => {
    try {
        const hasConnector = await hasActiveGoogleConnector(req.user.id, 'GOOGLE_DRIVE');
        if (!hasConnector) {
            return res.status(404).json({ error: 'Google Drive no está conectado' });
        }

        const { query, pageSize, mimeType } = req.query;
        const files = query
            ? await searchFiles(req.user.id, query, parseInt(pageSize) || 20)
            : await listFiles(req.user.id, {
                query: '',
                pageSize: parseInt(pageSize) || 20,
                mimeType: mimeType || '',
            });

        return res.json({ files });
    } catch (error) {
        console.error('❌ Error listando archivos Drive:', error.message);
        return res.status(500).json({ error: error.message || 'Error accediendo a Google Drive' });
    }
});

// ─── GET /api/conectores/google-drive/files/:fileId/content ──────────────────
// Descargar el contenido de texto de un archivo de Drive (para adjuntarlo al chat)
router.get('/google-drive/files/:fileId/content', authenticate, requireConnectorAccess, async (req, res) => {
    try {
        const hasConnector = await hasActiveGoogleConnector(req.user.id, 'GOOGLE_DRIVE');
        if (!hasConnector) {
            return res.status(404).json({ error: 'Google Drive no está conectado' });
        }

        const { fileId } = req.params;
        const token = await getGoogleAccessToken(req.user.id, 'GOOGLE_DRIVE');

        // Primero obtener metadatos del archivo
        const meta = await getFile(req.user.id, fileId);
        const mimeType = meta.mimeType || '';

        let text = '';
        let fileName = meta.name || 'archivo';

        // Para Google Docs nativo, exportar como texto plano
        if (mimeType === 'application/vnd.google-apps.document') {
            const exportRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!exportRes.ok) throw new Error(`Error exportando documento: ${exportRes.status}`);
            text = await exportRes.text();
        }
        // Para Google Sheets, exportar como CSV
        else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            const exportRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!exportRes.ok) throw new Error(`Error exportando hoja: ${exportRes.status}`);
            text = await exportRes.text();
        }
        // Para Google Slides, exportar como texto plano
        else if (mimeType === 'application/vnd.google-apps.presentation') {
            const exportRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!exportRes.ok) throw new Error(`Error exportando presentación: ${exportRes.status}`);
            text = await exportRes.text();
        }
        // Para archivos de texto plano, descargar directamente
        else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            const dlRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!dlRes.ok) throw new Error(`Error descargando archivo: ${dlRes.status}`);
            text = await dlRes.text();
        }
        // PDF y otros — intentar exportar texto si es Google type, o indicar que no es texto
        else {
            return res.status(400).json({
                error: 'Tipo de archivo no soportado para adjuntar como texto',
                mimeType,
                suggestion: 'Solo se pueden adjuntar documentos, hojas de cálculo, presentaciones y archivos de texto.',
            });
        }

        // Contar palabras aproximadas
        const wordCount = text.split(/\s+/).filter(Boolean).length;

        return res.json({
            fileId,
            fileName,
            mimeType,
            text,
            wordCount,
            size: text.length,
        });
    } catch (error) {
        console.error('❌ Error obteniendo contenido Drive:', error.message);
        return res.status(500).json({ error: error.message || 'Error descargando archivo' });
    }
});

export default router;
