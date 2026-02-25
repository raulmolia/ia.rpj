import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del transportador de email
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ia.rpj.es',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true', // true para puerto 465, false para otros puertos
    auth: {
        user: process.env.EMAIL_USER || 'noreply@ia.rpj.es',
        pass: process.env.EMAIL_PASSWORD || '',
    },
    tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
});

/**
 * Genera una contraseña aleatoria segura
 * @param {number} length - Longitud de la contraseña (por defecto 12)
 * @returns {string} Contraseña generada
 */
export function generateRandomPassword(length = 12) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%&*-_+=';

    const allChars = uppercase + lowercase + numbers + symbols;

    // Asegurar al menos un carácter de cada tipo
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Completar el resto de la longitud
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Mezclar los caracteres
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Carga el logo de RPJ en base64
 * @returns {string|null} Logo en formato base64 o null si no se encuentra
 */
function getLogoUrl() {
    // Use public URL - Gmail and most email clients block data URIs (base64 inline images)
    const baseUrl = process.env.FRONTEND_URL || 'https://ia.rpj.es';
    return `${baseUrl}/Logotipo%20RPJ.jpg`;
}

/**
 * Genera el template HTML para el email de bienvenida
 * @param {Object} params - Parámetros del email
 * @param {string} params.nombre - Nombre del usuario
 * @param {string} params.email - Email del usuario
 * @param {string} params.nombreUsuario - Nombre de usuario
 * @param {string} params.password - Contraseña temporal
 * @param {string} params.loginUrl - URL de login
 * @returns {string} HTML del email
 */
function getWelcomeEmailTemplate({ nombre, email, nombreUsuario, password, loginUrl }) {
    const logoUrl = getLogoUrl();
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a IA RPJ</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header con logo -->
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px;">
                            <img src="${logoUrl}" alt="Red Pastoral Juvenil" style="width: 200px; height: auto; border-radius: 8px;">
                        </td>
                    </tr>
                    
                    <!-- Título -->
                    <tr>
                        <td align="center" style="padding: 20px 40px 10px 40px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">
                                ¡Bienvenido a IA RPJ!
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Saludo personalizado -->
                    <tr>
                        <td style="padding: 10px 40px 30px 40px;">
                            <p style="margin: 0; font-size: 16px; color: #4a5568; line-height: 1.6; text-align: center;">
                                Hola <strong style="color: #1a1a1a;">${nombre}</strong>, tu cuenta ha sido creada exitosamente.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Credenciales en caja destacada -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <div style="background-color: #f2f2f2; border-radius: 12px; padding: 30px; color: #1a1a1a;">
                                <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">
                                    Tus credenciales de acceso
                                </h2>
                                
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #dcdcdc;">
                                            <div style="font-size: 13px; color: #666666; margin-bottom: 4px;">Email</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #1a1a1a; font-family: 'Courier New', monospace;">${email}</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #dcdcdc;">
                                            <div style="font-size: 13px; color: #666666; margin-bottom: 4px;">Usuario</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #1a1a1a; font-family: 'Courier New', monospace;">${nombreUsuario || email}</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0;">
                                            <div style="font-size: 13px; color: #666666; margin-bottom: 4px;">Contraseña temporal</div>
                                            <div style="font-size: 18px; font-weight: 700; color: #1a1a1a; font-family: 'Courier New', monospace; letter-spacing: 1px;">${password}</div>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Alerta de seguridad -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px 20px; border-radius: 8px;">
                                <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                                    <strong>⚠️ Importante:</strong> Por tu seguridad, deberás cambiar esta contraseña temporal en tu primer inicio de sesión.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Botón de acción -->
                    <tr>
                        <td align="center" style="padding: 0 40px 40px 40px;">
                            <a href="${loginUrl}" style="display: inline-block; padding: 16px 48px; background-color: #8DC63F; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(141, 198, 63, 0.4);">
                                Iniciar Sesión →
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Información adicional -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
                                    ¿Qué puedes hacer con IA RPJ?
                                </h3>
                                <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                                    <li>Chat conversacional con IA especializada en pastoral juvenil</li>
                                    <li>Búsqueda semántica en documentos RPJ</li>
                                    <li>Generación de dinámicas, celebraciones y programaciones</li>
                                    <li>Descarga de contenido en PDF y Word</li>
                                    <li>Gestión de documentación institucional</li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Ayuda -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 14px; color: #1a1a1a; line-height: 1.6;">
                                ¿Necesitas ayuda? Contacta con el administrador o visita nuestra documentación.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
                            <p style="margin: 0; font-size: 12px; color: #a0aec0; text-align: center; line-height: 1.6;">
                                © ${currentYear} Red de Pastoral Juvenil (RPJ). Todos los derechos reservados.<br>
                                Este es un correo automático, por favor no respondas a este mensaje.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Envía un email de bienvenida con credenciales temporales
 * @param {Object} params - Parámetros del email
 * @param {string} params.nombre - Nombre del usuario
 * @param {string} params.email - Email del destinatario
 * @param {string} params.nombreUsuario - Nombre de usuario
 * @param {string} params.password - Contraseña temporal
 * @param {string} params.loginUrl - URL de login (por defecto: https://ia.rpj.es/auth/login)
 * @returns {Promise<Object>} Resultado del envío
 */
export async function sendWelcomeEmail({ nombre, email, nombreUsuario, password, loginUrl = 'https://ia.rpj.es/auth/login' }) {
    try {
        const html = getWelcomeEmailTemplate({
            nombre,
            email,
            nombreUsuario,
            password,
            loginUrl,
        });

        const info = await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || 'IA RPJ - Asistente de Pastoral Juvenil'}" <${process.env.EMAIL_USER || 'noreply@rpj.es'}>`,
            to: email,
            subject: '🎉 Bienvenido a IA RPJ - Tus credenciales de acceso',
            html,
            text: `
Bienvenido a IA RPJ - Asistente de Pastoral Juvenil

Hola ${nombre},

Tu cuenta ha sido creada exitosamente. Aquí están tus credenciales de acceso:

Email: ${email}
Usuario: ${nombreUsuario || email}
Contraseña temporal: ${password}

IMPORTANTE: Por tu seguridad, deberás cambiar esta contraseña temporal en tu primer inicio de sesión.

Inicia sesión aquí: ${loginUrl}

¿Qué puedes hacer con IA RPJ?
- Chat conversacional con IA especializada en pastoral juvenil
- Búsqueda semántica en documentos RPJ
- Generación de dinámicas, celebraciones y programaciones
- Descarga de contenido en PDF y Word
- Gestión de documentación institucional

¿Necesitas ayuda? Contacta con el administrador.

© ${new Date().getFullYear()} Red de Pastoral Juvenil (RPJ). Todos los derechos reservados.
Este es un correo automático, por favor no respondas a este mensaje.
            `.trim(),
        });

        console.log('✅ Email enviado:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error('❌ Error al enviar email:', error);
        throw new Error(`Error al enviar email: ${error.message}`);
    }
}

/**
 * Genera el template HTML para el email de recuperación de contraseña
 */
function getPasswordResetEmailTemplate({ nombre, email, password, loginUrl }) {
    const logoUrl = getLogoUrl();
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperación de contraseña - IA RPJ</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header con logo -->
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px;">
                            <img src="${logoUrl}" alt="Red Pastoral Juvenil" style="width: 200px; height: auto; border-radius: 8px;">
                        </td>
                    </tr>
                    
                    <!-- Título -->
                    <tr>
                        <td align="center" style="padding: 20px 40px 10px 40px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">
                                Recuperación de contraseña
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Saludo personalizado -->
                    <tr>
                        <td style="padding: 10px 40px 30px 40px;">
                            <p style="margin: 0; font-size: 16px; color: #4a5568; line-height: 1.6; text-align: center;">
                                Hola <strong style="color: #1a1a1a;">${nombre}</strong>, hemos recibido una solicitud para restablecer tu contraseña.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Credenciales en caja destacada -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <div style="background-color: #f2f2f2; border-radius: 12px; padding: 30px; color: #1a1a1a;">
                                <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">
                                    Tu nueva contraseña temporal
                                </h2>
                                
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #dcdcdc;">
                                            <div style="font-size: 13px; color: #666666; margin-bottom: 4px;">Email</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #1a1a1a; font-family: 'Courier New', monospace;">${email}</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0;">
                                            <div style="font-size: 13px; color: #666666; margin-bottom: 4px;">Contraseña temporal</div>
                                            <div style="font-size: 18px; font-weight: 700; color: #1a1a1a; font-family: 'Courier New', monospace; letter-spacing: 1px;">${password}</div>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Alerta de seguridad -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px 20px; border-radius: 8px;">
                                <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                                    <strong>⚠️ Importante:</strong> Por tu seguridad, deberás cambiar esta contraseña temporal en tu próximo inicio de sesión.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Botón de acción -->
                    <tr>
                        <td align="center" style="padding: 0 40px 30px 40px;">
                            <a href="${loginUrl}" style="display: inline-block; padding: 16px 48px; background-color: #8DC63F; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(141, 198, 63, 0.4);">
                                Iniciar Sesión →
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Nota de seguridad -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 14px; color: #1a1a1a; line-height: 1.6;">
                                Si no solicitaste este cambio, ignora este correo. Tu contraseña anterior seguirá siendo válida solo si no usas la nueva.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f9fa; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
                            <p style="margin: 0; font-size: 12px; color: #a0aec0; text-align: center; line-height: 1.6;">
                                © ${currentYear} Red de Pastoral Juvenil (RPJ). Todos los derechos reservados.<br>
                                Este es un correo automático, por favor no respondas a este mensaje.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Envía un email de recuperación de contraseña
 * @param {Object} params - Parámetros del email
 * @param {string} params.nombre - Nombre del usuario
 * @param {string} params.email - Email del destinatario
 * @param {string} params.password - Nueva contraseña temporal
 * @param {string} params.loginUrl - URL de login
 * @returns {Promise<Object>} Resultado del envío
 */
export async function sendPasswordResetEmail({ nombre, email, password, loginUrl = 'https://ia.rpj.es/auth/login' }) {
    try {
        const html = getPasswordResetEmailTemplate({ nombre, email, password, loginUrl });

        const info = await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || 'IA RPJ - Asistente de Pastoral Juvenil'}" <${process.env.EMAIL_USER || 'noreply@rpj.es'}>`,
            to: email,
            subject: 'Recuperación de contraseña - IA RPJ',
            html,
            text: `
Recuperación de contraseña - IA RPJ

Hola ${nombre},

Hemos recibido una solicitud para restablecer tu contraseña.

Tu nueva contraseña temporal: ${password}

IMPORTANTE: Por tu seguridad, deberás cambiar esta contraseña temporal en tu próximo inicio de sesión.

Inicia sesión aquí: ${loginUrl}

Si no solicitaste este cambio, ignora este correo.

© ${new Date().getFullYear()} Red de Pastoral Juvenil (RPJ). Todos los derechos reservados.
            `.trim(),
        });

        console.log('✅ Email de recuperación enviado:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error('❌ Error al enviar email de recuperación:', error);
        throw new Error(`Error al enviar email de recuperación: ${error.message}`);
    }
}

/**
 * Verifica la configuración del servicio de email
 * @returns {Promise<boolean>} True si la configuración es válida
 */
export async function verifyEmailService() {
    try {
        await transporter.verify();
        console.log('✅ Servicio de email configurado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error en configuración de email:', error);
        return false;
    }
}

// ────────────────────────────────────────────────
// Compartir conversación por email (formateado)
// ────────────────────────────────────────────────

/**
 * Convierte Markdown a HTML para emails
 * @param {string} md - Texto en Markdown
 * @returns {string} HTML formateado
 */
function markdownToEmailHtml(md) {
    if (!md) return '';
    let html = md;

    // Code blocks (antes de inline code)
    html = html.replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
        return `<pre style="font-family:'Courier New',monospace;background-color:#f3f4f6;padding:16px;border:1px solid #d1d5db;border-radius:8px;white-space:pre-wrap;word-wrap:break-word;font-size:13px;color:#374151;margin:12px 0;line-height:1.5;">${escapeHtmlEmail(code)}</pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="font-family:\'Courier New\',monospace;background-color:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>');

    // Headers (h1-h4)
    html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;color:#64748b;margin:16px 0 8px 0;">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;color:#475569;margin:18px 0 8px 0;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:700;color:#334155;margin:20px 0 10px 0;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:700;color:#1e293b;margin:24px 0 12px 0;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">$1</h1>');

    // Bold, italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    html = html.replace(/~~(.+?)~~/g, '<del style="color:#94a3b8;">$1</del>');

    // Blockquotes
    html = html.replace(/^>\s*(.+)$/gm, '<blockquote style="margin:12px 0;padding:10px 16px;border-left:4px solid #6366f1;background-color:#f8fafc;color:#475569;font-style:italic;border-radius:0 8px 8px 0;">$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">');

    // Bullets: agrupar líneas consecutivas de `- ` en un solo <ul>
    html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
        const items = block.trim().split('\n').map(line => {
            const content = line.replace(/^- /, '');
            return `<li style="margin-bottom:6px;line-height:1.6;">${content}</li>`;
        }).join('');
        return `<ul style="margin:10px 0;padding-left:24px;color:#1e293b;">${items}</ul>`;
    });

    // Numbered lists
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
        const items = block.trim().split('\n').map(line => {
            const content = line.replace(/^\d+\. /, '');
            return `<li style="margin-bottom:6px;line-height:1.6;">${content}</li>`;
        }).join('');
        return `<ol style="margin:10px 0;padding-left:24px;color:#1e293b;">${items}</ol>`;
    });

    // Paragraphs: wrap remaining lines that aren't already HTML tags
    html = html.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<')) return line;
        return `<p style="margin:8px 0;line-height:1.7;color:#1e293b;">${trimmed}</p>`;
    }).join('\n');

    return html;
}

/**
 * Escapa caracteres HTML
 */
function escapeHtmlEmail(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Genera el template HTML para compartir conversación
 */
function getSharedConversationTemplate({ fromName, fromEmail, title, htmlContent }) {
    const logoUrl = getLogoUrl();
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - IA RPJ</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 700px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header con logo -->
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px;">
                            <img src="${logoUrl}" alt="Red Pastoral Juvenil" style="width: 180px; height: auto; border-radius: 8px;">
                        </td>
                    </tr>
                    
                    <!-- Info de compartido -->
                    <tr>
                        <td style="padding: 10px 40px 20px 40px;">
                            <div style="background-color: #f0fdf4; border-left: 4px solid #8DC63F; padding: 14px 18px; border-radius: 0 10px 10px 0;">
                                <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.5;">
                                    📩 <strong>${fromName}</strong> (${fromEmail}) ha compartido contigo el siguiente contenido:
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Título -->
                    <tr>
                        <td style="padding: 0 40px 10px 40px;">
                            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1e293b; line-height: 1.3;">
                                ${title}
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Separador -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0;">
                        </td>
                    </tr>
                    
                    <!-- Contenido formateado -->
                    <tr>
                        <td style="padding: 20px 40px 30px 40px; font-size: 15px; line-height: 1.7; color: #1e293b;">
                            ${htmlContent}
                        </td>
                    </tr>
                    
                    <!-- Separador -->
                    <tr>
                        <td style="padding: 0 40px;">
                            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0;">
                        </td>
                    </tr>
                    
                    <!-- CTA -->
                    <tr>
                        <td align="center" style="padding: 30px 40px;">
                            <p style="margin: 0 0 16px; font-size: 14px; color: #64748b;">
                                Generado con el asistente de IA de la Red de Pastoral Juvenil
                            </p>
                            <a href="https://ia.rpj.es" style="display: inline-block; padding: 12px 36px; background-color: #8DC63F; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(141, 198, 63, 0.3);">
                                Visitar IA RPJ →
                            </a>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 40px; background-color: #f8f9fa; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
                            <p style="margin: 0; font-size: 12px; color: #a0aec0; text-align: center; line-height: 1.6;">
                                © ${currentYear} Red de Pastoral Juvenil (RPJ). Todos los derechos reservados.<br>
                                Este contenido fue compartido por un usuario de IA RPJ.
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Envía una conversación compartida por email con formato HTML
 * @param {Object} params
 * @param {string} params.to - Email del destinatario
 * @param {string} params.fromName - Nombre del remitente
 * @param {string} params.fromEmail - Email del remitente
 * @param {string} params.title - Título de la conversación
 * @param {string} params.markdownContent - Contenido en Markdown
 * @returns {Promise<Object>} Resultado del envío
 */
export async function sendSharedConversationEmail({ to, fromName, fromEmail, title, markdownContent }) {
    try {
        const htmlContent = markdownToEmailHtml(markdownContent);

        const html = getSharedConversationTemplate({
            fromName,
            fromEmail,
            title,
            htmlContent,
        });

        // Texto plano como fallback
        const plainText = `
${fromName} (${fromEmail}) ha compartido contigo el siguiente contenido:

${title}
${'─'.repeat(40)}

${markdownContent}

${'─'.repeat(40)}
Generado con IA RPJ - https://ia.rpj.es
© ${new Date().getFullYear()} Red de Pastoral Juvenil (RPJ).
        `.trim();

        const info = await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME || 'IA RPJ - Asistente de Pastoral Juvenil'}" <${process.env.EMAIL_USER || 'noreply@rpj.es'}>`,
            replyTo: fromEmail,
            to,
            subject: `📩 ${fromName} ha compartido: ${title}`,
            html,
            text: plainText,
        });

        console.log('✅ Email de conversación compartida enviado:', info.messageId);

        return {
            success: true,
            messageId: info.messageId,
        };
    } catch (error) {
        console.error('❌ Error al enviar email de conversación compartida:', error);
        throw new Error(`Error al enviar email: ${error.message}`);
    }
}

export default {
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendSharedConversationEmail,
    generateRandomPassword,
    verifyEmailService,
};
