import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prismaPackage from '@prisma/client';
import { authenticate, authorize, getRolePriority } from '../middleware/auth.js';
import { sendWelcomeEmail, generateRandomPassword } from '../services/emailService.js';

const { PrismaClient } = prismaPackage;
const PrismaEnums = prismaPackage.$Enums || {};
const DEFAULT_ROLES = {
    SUPERADMIN: 'SUPERADMIN',
    ADMINISTRADOR: 'ADMINISTRADOR',
    DOCUMENTADOR: 'DOCUMENTADOR',
    USUARIO: 'USUARIO',
};
const Rol = PrismaEnums.Rol || DEFAULT_ROLES;

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

const DEFAULT_PASSWORD_ROUNDS = parseInt(process.env.AUTH_SALT_ROUNDS || '12', 10);
const ALLOWED_ROLES = Object.values(Rol || DEFAULT_ROLES);

function durationToMs(duration) {
    if (!duration) {
        return 12 * 60 * 60 * 1000;
    }

    if (typeof duration === 'number') {
        return duration;
    }

    const match = /^([0-9]+)([smhd])$/i.exec(duration.trim());

    if (!match) {
        return 12 * 60 * 60 * 1000;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 's':
            return value * 1000;
        case 'm':
            return value * 60 * 1000;
        case 'h':
            return value * 60 * 60 * 1000;
        case 'd':
            return value * 24 * 60 * 60 * 1000;
        default:
            return 12 * 60 * 60 * 1000;
    }
}

function sanitizeUser(user) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
}

function resolveRole(rawRole, currentUserRole) {
    if (!rawRole) {
        return Rol.USUARIO || DEFAULT_ROLES.USUARIO;
    }

    const normalized = String(rawRole).trim().toUpperCase();

    if (!ALLOWED_ROLES.includes(normalized)) {
        throw new Error('Rol inválido');
    }

    if (getRolePriority(currentUserRole) < getRolePriority(normalized)) {
        throw new Error('No puedes asignar un rol superior al tuyo');
    }

    return Rol[normalized] || DEFAULT_ROLES[normalized];
}

router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({
            error: 'Datos incompletos',
            message: 'Debes proporcionar email y contraseña',
        });
    }

    try {
        const user = await prisma.usuario.findUnique({ where: { email } });

        if (!user || !user.passwordHash) {
            return res.status(401).json({
                error: 'Credenciales inválidas',
                message: 'Email o contraseña incorrectos',
            });
        }

        if (!user.activo) {
            return res.status(403).json({
                error: 'Usuario inactivo',
                message: 'Contacta con un administrador',
            });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            return res.status(401).json({
                error: 'Credenciales inválidas',
                message: 'Email o contraseña incorrectos',
            });
        }

        const sessionToken = uuidv4();
        const expirationMs = durationToMs(JWT_EXPIRES_IN);
        const expirationDate = new Date(Date.now() + expirationMs);
        const ipHeader = req.headers['x-forwarded-for'];

        await prisma.sesion.create({
            data: {
                usuarioId: user.id,
                token: sessionToken,
                tipoDispositivo: req.headers['user-agent']?.slice(0, 190) || null,
                navegador: req.headers['user-agent']?.slice(0, 190) || null,
                ip: Array.isArray(ipHeader) ? ipHeader[0] : (ipHeader || req.socket.remoteAddress || null),
                activa: true,
                fechaExpiracion: expirationDate,
            },
        });

        const jwtToken = jwt.sign(
            {
                sub: user.id,
                role: user.rol,
                sessionId: sessionToken,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN },
        );

        return res.json({
            token: jwtToken,
            expiresIn: JWT_EXPIRES_IN,
            user: sanitizeUser(user),
            debeCambiarPassword: user.debeCambiarPassword || false,
        });
    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({
            error: 'Error interno',
            message: error.message,
        });
    }
});

router.post('/logout', authenticate, async (req, res) => {
    try {
        await prisma.sesion.updateMany({
            where: {
                token: req.user.sessionId,
                usuarioId: req.user.id,
                activa: true,
            },
            data: {
                activa: false,
                fechaExpiracion: new Date(),
            },
        });

        return res.json({
            message: 'Sesión cerrada correctamente',
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Error cerrando sesión',
            message: error.message,
        });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await prisma.usuario.findUnique({ where: { id: req.user.id } });

        if (!user) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
            });
        }

        return res.json({ user: sanitizeUser(user) });
    } catch (error) {
        return res.status(500).json({
            error: 'Error obteniendo el perfil',
            message: error.message,
        });
    }
});

router.patch('/me', authenticate, async (req, res) => {
    const ALLOWED_FIELDS = new Set([
        'nombre',
        'apellidos',
        'telefono',
        'organizacion',
        'cargo',
        'experiencia',
        'avatarUrl',
    ]);

    try {
        const updates = Object.entries(req.body || {}).reduce((acc, [key, value]) => {
            if (ALLOWED_FIELDS.has(key)) {
                if (key === 'experiencia') {
                    const parsed = parseInt(value, 10);
                    if (!Number.isNaN(parsed) && parsed >= 0) {
                        acc[key] = parsed;
                    }
                } else if (typeof value === 'string' || value === null) {
                    acc[key] = value;
                }
            }
            return acc;
        }, {});

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                error: 'Datos inválidos',
                message: 'No se proporcionaron campos válidos para actualizar',
            });
        }

        const updatedUser = await prisma.usuario.update({
            where: { id: req.user.id },
            data: updates,
        });

        return res.json({
            message: 'Perfil actualizado correctamente',
            user: sanitizeUser(updatedUser),
        });
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        return res.status(500).json({
            error: 'Error actualizando perfil',
            message: error.message,
        });
    }
});

router.get('/users', authenticate, authorize(['ADMINISTRADOR']), async (req, res) => {
    try {
        const users = await prisma.usuario.findMany({
            orderBy: { fechaCreacion: 'desc' },
        });

        return res.json({
            users: users.map(sanitizeUser),
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Error listando usuarios',
            message: error.message,
        });
    }
});

router.post('/users', authenticate, authorize(['ADMINISTRADOR']), async (req, res) => {
    const {
        email,
        password,
        nombre,
        apellidos,
        nombreUsuario,
        organizacion,
        cargo,
        experiencia,
        rol,
        telefono,
        enviarEmail,
    } = req.body || {};

    if (!email || !nombre) {
        return res.status(400).json({
            error: 'Datos incompletos',
            message: 'Email y nombre son obligatorios',
        });
    }

    try {
        const assignedRole = resolveRole(rol, req.user.rol);
        
        // Si no se proporciona contraseña, generar una aleatoria
        const generatedPassword = password || generateRandomPassword(12);
        const hashedPassword = await bcrypt.hash(generatedPassword, DEFAULT_PASSWORD_ROUNDS);
        
        // Si se genera contraseña automáticamente, el usuario debe cambiarla
        const mustChangePassword = !password;

        const newUser = await prisma.usuario.create({
            data: {
                email,
                passwordHash: hashedPassword,
                nombre,
                apellidos,
                nombreUsuario: nombreUsuario || email.split('@')[0],
                organizacion,
                cargo,
                experiencia,
                telefono,
                rol: assignedRole,
                debeCambiarPassword: mustChangePassword,
            },
        });
        
        // Enviar email de bienvenida si se solicita o si se generó contraseña automática
        if (enviarEmail !== false && mustChangePassword) {
            try {
                await sendWelcomeEmail({
                    nombre: newUser.nombre,
                    email: newUser.email,
                    nombreUsuario: newUser.nombreUsuario || newUser.email,
                    password: generatedPassword,
                    loginUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/auth/login` : 'https://ia.rpj.es/auth/login',
                });
                
                return res.status(201).json({
                    message: 'Usuario creado correctamente. Se ha enviado un email con las credenciales.',
                    user: sanitizeUser(newUser),
                    emailSent: true,
                });
            } catch (emailError) {
                console.error('Error enviando email de bienvenida:', emailError);
                
                // Usuario creado pero email falló - devolver contraseña en respuesta
                return res.status(201).json({
                    message: 'Usuario creado correctamente, pero no se pudo enviar el email.',
                    user: sanitizeUser(newUser),
                    emailSent: false,
                    temporaryPassword: generatedPassword,
                    warning: 'Guarda esta contraseña temporal, no se volverá a mostrar.',
                });
            }
        }

        return res.status(201).json({
            message: 'Usuario creado correctamente',
            user: sanitizeUser(newUser),
            emailSent: false,
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({
                error: 'Duplicado',
                message: 'El email o nombre de usuario ya existe',
            });
        }

        if (error.message === 'Rol inválido') {
            return res.status(400).json({
                error: 'Rol inválido',
                message: 'Debes proporcionar un rol válido',
            });
        }

        if (error.message === 'No puedes asignar un rol superior al tuyo') {
            return res.status(403).json({
                error: 'Rol no permitido',
                message: 'No puedes asignar un rol superior al tuyo',
            });
        }

        const message = error.message || 'Error creando usuario';

        return res.status(500).json({
            error: 'Error creando usuario',
            message,
        });
    }
});

router.patch('/users/:id/role', authenticate, authorize(['ADMINISTRADOR']), async (req, res) => {
    const { id } = req.params;
    const { rol } = req.body || {};

    if (!rol) {
        return res.status(400).json({
            error: 'Datos incompletos',
            message: 'Debes indicar un rol destino',
        });
    }

    try {
        const targetRole = resolveRole(rol, req.user.rol);

        const updated = await prisma.usuario.update({
            where: { id },
            data: { rol: targetRole },
        });

        return res.json({
            message: 'Rol actualizado correctamente',
            user: sanitizeUser(updated),
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({
                error: 'Usuario no encontrado',
            });
        }

        if (error.message === 'Rol inválido') {
            return res.status(400).json({
                error: 'Rol inválido',
                message: 'Debes proporcionar un rol válido',
            });
        }

        if (error.message === 'No puedes asignar un rol superior al tuyo') {
            return res.status(403).json({
                error: 'Rol no permitido',
                message: 'No puedes asignar un rol superior al tuyo',
            });
        }

        return res.status(500).json({
            error: 'Error actualizando rol',
            message: error.message,
        });
    }
});

router.patch('/users/:id/status', authenticate, authorize(['ADMINISTRADOR']), async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body || {};

    if (typeof activo !== 'boolean') {
        return res.status(400).json({
            error: 'Datos inválidos',
            message: 'Debes indicar el estado activo como booleano',
        });
    }

    try {
        const updated = await prisma.usuario.update({
            where: { id },
            data: { activo },
        });

        return res.json({
            message: 'Estado actualizado correctamente',
            user: sanitizeUser(updated),
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({
                error: 'Usuario no encontrado',
            });
        }

        return res.status(500).json({
            error: 'Error actualizando estado',
            message: error.message,
        });
    }
});

router.delete('/users/:id', authenticate, authorize(['ADMINISTRADOR']), async (req, res) => {
    const { id } = req.params;

    if (req.user.id === id) {
        return res.status(400).json({
            error: 'Operación no permitida',
            message: 'No puedes eliminar tu propio usuario',
        });
    }

    try {
        const targetUser = await prisma.usuario.findUnique({ where: { id } });

        if (!targetUser) {
            return res.status(404).json({
                error: 'Usuario no encontrado',
            });
        }

        const currentPriority = getRolePriority(req.user.rol);
        const targetPriority = getRolePriority(targetUser.rol);

        if (currentPriority <= targetPriority) {
            return res.status(403).json({
                error: 'Rol no permitido',
                message: 'No puedes eliminar un usuario con un rol igual o superior al tuyo',
            });
        }

        await prisma.usuario.delete({ where: { id } });

        return res.json({
            message: 'Usuario eliminado correctamente',
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Error eliminando usuario',
            message: error.message,
        });
    }
});

export default router;
