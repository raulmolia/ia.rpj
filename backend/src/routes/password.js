import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import prismaPackage from '@prisma/client';

const { PrismaClient } = prismaPackage;
const router = express.Router();
const prisma = new PrismaClient();

const DEFAULT_PASSWORD_ROUNDS = parseInt(process.env.AUTH_SALT_ROUNDS || '12', 10);

/**
 * POST /api/password/change
 * Cambiar contraseña (primer login o cambio voluntario)
 */
router.post('/change', authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (!newPassword) {
        return res.status(400).json({
            error: 'Datos incompletos',
            message: 'Debes proporcionar una nueva contraseña',
        });
    }

    // Validar longitud mínima
    if (newPassword.length < 8) {
        return res.status(400).json({
            error: 'Contraseña débil',
            message: 'La contraseña debe tener al menos 8 caracteres',
        });
    }

    try {
        const user = await prisma.usuario.findUnique({
            where: { id: req.user.id },
        });

        if (!user || !user.passwordHash) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
            });
        }

        // Si no es primer login, verificar contraseña actual
        if (!user.debeCambiarPassword && currentPassword) {
            const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
            
            if (!validPassword) {
                return res.status(401).json({
                    error: 'Contraseña incorrecta',
                    message: 'La contraseña actual es incorrecta',
                });
            }
        }

        // Hash de la nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, DEFAULT_PASSWORD_ROUNDS);

        // Actualizar contraseña y desactivar flag de cambio obligatorio
        await prisma.usuario.update({
            where: { id: req.user.id },
            data: {
                passwordHash: hashedPassword,
                debeCambiarPassword: false,
            },
        });

        return res.json({
            message: 'Contraseña actualizada correctamente',
        });
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        return res.status(500).json({
            error: 'Error cambiando contraseña',
            message: error.message,
        });
    }
});

/**
 * GET /api/password/must-change
 * Verificar si el usuario debe cambiar su contraseña
 */
router.get('/must-change', authenticate, async (req, res) => {
    try {
        const user = await prisma.usuario.findUnique({
            where: { id: req.user.id },
            select: { debeCambiarPassword: true },
        });

        if (!user) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
            });
        }

        return res.json({
            mustChange: user.debeCambiarPassword || false,
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Error verificando estado',
            message: error.message,
        });
    }
});

export default router;
