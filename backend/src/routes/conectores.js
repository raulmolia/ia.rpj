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

const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID || '';
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET || '';
const CANVA_REDIRECT_URI = process.env.CANVA_REDIRECT_URI || 'https://ia.rpj.es/api/conectores/canva/callback';
const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize';
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

// Scopes necesarios para las herramientas implementadas
const CANVA_SCOPES = [
    'design:meta:read',
    'design:content:read',
    'design:content:write',
    'asset:read',
].join(' ');

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
const GOOGLE_DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'openid',
    'email',
    'profile',
].join(' ');

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

// ─── GET /api/conectores/canva/auth ──────────────────────────────────────────
// Genera la URL de autorización OAuth de Canva y redirige al usuario
router.get('/canva/auth', authenticate, requireConnectorAccess, (req, res) => {
    if (!CANVA_CLIENT_ID) {
        return res.status(503).json({
            error: 'Conector no configurado',
            message: 'El conector de Canva no está configurado en el servidor.',
        });
    }

    // Generar state JWT de corta duración (anti-CSRF)
    const state = jwt.sign(
        { userId: req.user.id, connector: 'CANVA' },
        JWT_SECRET,
        { expiresIn: OAUTH_STATE_TTL }
    );

    // PKCE: generar code_verifier y code_challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = deriveCodeChallenge(codeVerifier);

    // Guardar code_verifier en el store temporal (TTL 10 min)
    pkceStore.set(state, { codeVerifier, expires: Date.now() + OAUTH_STATE_TTL * 1000 });

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CANVA_CLIENT_ID,
        redirect_uri: CANVA_REDIRECT_URI,
        scope: CANVA_SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });

    const authUrl = `${CANVA_AUTH_URL}?${params}`;
    logService.logInfo('SISTEMA', 'Inicio flujo OAuth Canva', {
        usuarioId: req.user.id,
        detalles: { connector: 'CANVA' },
    });

    return res.json({ authUrl });
});

// ─── GET /api/conectores/canva/callback ──────────────────────────────────────
// Recibe el código de autorización de Canva, intercambia por token y guarda en BD
router.get('/canva/callback', async (req, res) => {
    const { code, state, error: oauthError } = req.query;

    // Redirigir al frontend con error si Canva denegó el acceso
    const frontendBase = process.env.FRONTEND_URL || 'https://ia.rpj.es';

    if (oauthError) {
        return res.redirect(`${frontendBase}/?connector=canva&status=denied`);
    }

    if (!code || !state) {
        return res.redirect(`${frontendBase}/?connector=canva&status=error`);
    }

    // Verificar state JWT
    let statePayload;
    try {
        statePayload = jwt.verify(String(state), JWT_SECRET);
    } catch {
        return res.redirect(`${frontendBase}/?connector=canva&status=invalid_state`);
    }

    const { userId } = statePayload;
    if (!userId) {
        pkceStore.delete(String(state));
        return res.redirect(`${frontendBase}/?connector=canva&status=error`);
    }

    // Recuperar code_verifier PKCE
    const pkceEntry = pkceStore.get(String(state));
    if (!pkceEntry || pkceEntry.expires < Date.now()) {
        pkceStore.delete(String(state));
        console.error('❌ PKCE: code_verifier no encontrado o expirado');
        return res.redirect(`${frontendBase}/?connector=canva&status=invalid_state`);
    }
    const { codeVerifier } = pkceEntry;
    pkceStore.delete(String(state)); // uso único

    try {
        // Intercambiar code por tokens (PKCE + Basic auth recomendado por Canva)
        const credentials = Buffer.from(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`).toString('base64');
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
            redirect_uri: CANVA_REDIRECT_URI,
            code: String(code),
        });

        const tokenRes = await fetch(CANVA_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${credentials}`,
            },
            body: params.toString(),
        });

        if (!tokenRes.ok) {
            const text = await tokenRes.text();
            console.error('❌ Error intercambiando token Canva:', text);
            return res.redirect(`${frontendBase}/?connector=canva&status=token_error`);
        }

        const tokenData = await tokenRes.json();
        const expiracion = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

        // Obtener info básica del usuario de Canva
        let canvaUser = null;
        try {
            const meRes = await fetch('https://api.canva.com/rest/v1/users/me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (meRes.ok) canvaUser = await meRes.json();
        } catch { /* ignorar si falla */ }

        // Guardar/actualizar conector en BD (upsert)
        await prisma.conector.upsert({
            where: { usuarioId_tipo: { usuarioId: userId, tipo: 'CANVA' } },
            update: {
                estado: 'ACTIVO',
                tokenAcceso: encryptToken(tokenData.access_token),
                tokenActualizacion: tokenData.refresh_token
                    ? encryptToken(tokenData.refresh_token)
                    : undefined,
                tokenExpiracion: expiracion,
                config: canvaUser
                    ? { canvaUserId: canvaUser.user?.user_id, canvaTeamId: canvaUser.user?.team_id }
                    : undefined,
            },
            create: {
                usuarioId: userId,
                tipo: 'CANVA',
                estado: 'ACTIVO',
                tokenAcceso: encryptToken(tokenData.access_token),
                tokenActualizacion: tokenData.refresh_token
                    ? encryptToken(tokenData.refresh_token)
                    : null,
                tokenExpiracion: expiracion,
                config: canvaUser
                    ? { canvaUserId: canvaUser.user?.user_id, canvaTeamId: canvaUser.user?.team_id }
                    : null,
            },
        });

        logService.logInfo('SISTEMA', 'Conector Canva conectado correctamente', {
            usuarioId: userId,
            detalles: { connector: 'CANVA' },
        });

        return res.redirect(`${frontendBase}/?connector=canva&status=success`);
    } catch (error) {
        console.error('❌ Error en callback Canva:', error);
        logService.logError('SISTEMA', 'Error en callback OAuth Canva', {
            usuarioId: userId,
            detalles: { error: error.message },
        });
        return res.redirect(`${frontendBase}/?connector=canva&status=error`);
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

export default router;
