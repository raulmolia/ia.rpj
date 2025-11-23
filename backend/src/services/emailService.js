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
function getLogoBase64() {
    try {
        const logoPath = path.join(__dirname, '../../assets/logo-rpj.png');
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            return `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }
    } catch (error) {
        console.warn('No se pudo cargar el logo RPJ:', error.message);
    }
    return null;
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
    const logoBase64 = getLogoBase64();
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
                            ${logoBase64 ? `<img src="${logoBase64}" alt="Logo RPJ" style="width: 120px; height: 120px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);">` : '<div style="width: 120px; height: 120px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px;"></div>'}
                        </td>
                    </tr>
                    
                    <!-- Título -->
                    <tr>
                        <td align="center" style="padding: 20px 40px 10px 40px;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">
                                ¡Bienvenido a IA RPJ! 🎉
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
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; color: #ffffff;">
                                <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                                    📋 Tus credenciales de acceso
                                </h2>
                                
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
                                            <div style="font-size: 13px; color: rgba(255, 255, 255, 0.8); margin-bottom: 4px;">Email</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #ffffff; font-family: 'Courier New', monospace;">${email}</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
                                            <div style="font-size: 13px; color: rgba(255, 255, 255, 0.8); margin-bottom: 4px;">Usuario</div>
                                            <div style="font-size: 16px; font-weight: 600; color: #ffffff; font-family: 'Courier New', monospace;">${nombreUsuario || email}</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0;">
                                            <div style="font-size: 13px; color: rgba(255, 255, 255, 0.8); margin-bottom: 4px;">Contraseña temporal</div>
                                            <div style="font-size: 18px; font-weight: 700; color: #ffffff; font-family: 'Courier New', monospace; letter-spacing: 1px;">${password}</div>
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
                            <a href="${loginUrl}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
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
                            <p style="margin: 0; font-size: 14px; color: #718096; line-height: 1.6;">
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
            from: `"IA RPJ - Asistente de Pastoral Juvenil" <${process.env.EMAIL_USER || 'noreply@ia.rpj.es'}>`,
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

export default {
    sendWelcomeEmail,
    generateRandomPassword,
    verifyEmailService,
};
