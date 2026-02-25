// Rutas para compartir conversaciones
import express from 'express';
import prismaPackage from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { sendSharedConversationEmail } from '../services/emailService.js';

const { PrismaClient } = prismaPackage;
const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/share/user
 * Compartir un mensaje con otro usuario de la aplicación
 * Body: { email, messageContent, conversationTitle }
 */
router.post('/user', authenticate, async (req, res) => {
    try {
        const { email, messageContent, conversationTitle } = req.body;
        const senderId = req.user.id;

        if (!email || !messageContent) {
            return res.status(400).json({ error: 'Se requiere email y contenido del mensaje.' });
        }

        // Buscar al destinatario
        const destinatario = await prisma.usuario.findUnique({
            where: { email: email.trim().toLowerCase() },
            select: { id: true, nombre: true, email: true, activo: true },
        });

        if (!destinatario) {
            return res.status(404).json({ error: 'No se encontró ningún usuario con ese correo electrónico.' });
        }

        if (!destinatario.activo) {
            return res.status(403).json({ error: 'El usuario destinatario no está activo.' });
        }

        if (destinatario.id === senderId) {
            return res.status(400).json({ error: 'No puedes compartir contigo mismo.' });
        }

        // Obtener datos del remitente
        const remitente = await prisma.usuario.findUnique({
            where: { id: senderId },
            select: { nombre: true, apellidos: true, email: true },
        });

        const nombreRemitente = remitente.apellidos
            ? `${remitente.nombre} ${remitente.apellidos}`
            : remitente.nombre;

        // Crear conversación compartida para el destinatario
        const titulo = conversationTitle
            ? `📩 ${conversationTitle}`
            : `📩 Compartido por ${nombreRemitente}`;

        const conversacion = await prisma.conversacion.create({
            data: {
                usuarioId: destinatario.id,
                titulo,
                esCompartida: true,
                compartidaPor: senderId,
                compartidaDesde: remitente.email,
                compartidaNombre: nombreRemitente,
            },
        });

        // Crear el mensaje del sistema informando del compartido
        await prisma.mensajeConversacion.create({
            data: {
                conversacionId: conversacion.id,
                rol: 'SISTEMA',
                contenido: `📩 Contenido compartido por **${nombreRemitente}** (${remitente.email})`,
            },
        });

        // Crear el mensaje con el contenido compartido
        await prisma.mensajeConversacion.create({
            data: {
                conversacionId: conversacion.id,
                rol: 'ASISTENTE',
                contenido: messageContent,
            },
        });

        res.json({
            success: true,
            message: `Conversación compartida con ${destinatario.nombre} (${destinatario.email}).`,
            destinatario: {
                nombre: destinatario.nombre,
                email: destinatario.email,
            },
        });
    } catch (error) {
        console.error('❌ Error al compartir conversación:', error);
        res.status(500).json({ error: 'Error al compartir la conversación.' });
    }
});

/**
 * POST /api/share/email
 * Compartir un mensaje por correo electrónico (formateado HTML)
 * Body: { email, messageContent, conversationTitle }
 */
router.post('/email', authenticate, async (req, res) => {
    try {
        const { email, messageContent, conversationTitle } = req.body;

        if (!email || !messageContent) {
            return res.status(400).json({ error: 'Se requiere email y contenido del mensaje.' });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
        }

        // Obtener datos del remitente
        const remitente = await prisma.usuario.findUnique({
            where: { id: req.user.id },
            select: { nombre: true, apellidos: true, email: true },
        });

        const nombreRemitente = remitente.apellidos
            ? `${remitente.nombre} ${remitente.apellidos}`
            : remitente.nombre;

        // Enviar email formateado
        const result = await sendSharedConversationEmail({
            to: email.trim(),
            fromName: nombreRemitente,
            fromEmail: remitente.email,
            title: conversationTitle || 'Contenido generado por IA RPJ',
            markdownContent: messageContent,
        });

        res.json({
            success: true,
            message: `Email enviado correctamente a ${email}.`,
            messageId: result.messageId,
        });
    } catch (error) {
        console.error('❌ Error al enviar email compartido:', error);
        res.status(500).json({ error: 'Error al enviar el correo electrónico.' });
    }
});

export default router;
