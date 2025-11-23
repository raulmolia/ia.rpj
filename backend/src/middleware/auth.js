import jwt from 'jsonwebtoken';
import prismaPackage from '@prisma/client';

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();

const ROLE_PRIORITY = {
    SUPERADMIN: 4,
    ADMINISTRADOR: 3,
    DOCUMENTADOR: 2,
    USUARIO: 1,
};

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'change-me';

function hasRequiredRole(userRole, allowedRoles) {
    if (!allowedRoles || allowedRoles.length === 0) {
        return true;
    }

    const userRank = ROLE_PRIORITY[userRole] || 0;

    return allowedRoles.some((role) => {
        const requiredRank = ROLE_PRIORITY[role] || 0;
        return userRank >= requiredRank;
    });
}

export async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'No autorizado',
            message: 'Token no proporcionado',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const session = await prisma.sesion.findUnique({
            where: { token: payload.sessionId },
        });

        if (!session || !session.activa) {
            return res.status(401).json({
                error: 'Sesión inválida',
                message: 'La sesión no existe o está inactiva',
            });
        }

        const now = new Date();
        if (session.fechaExpiracion <= now) {
            return res.status(401).json({
                error: 'Sesión expirada',
                message: 'La sesión ha caducado, inicia sesión nuevamente',
            });
        }

        const user = await prisma.usuario.findUnique({ where: { id: payload.sub } });

        if (!user || !user.activo) {
            return res.status(401).json({
                error: 'Usuario no disponible',
                message: 'El usuario asociado al token no está activo',
            });
        }

        await prisma.sesion.update({
            where: { id: session.id },
            data: { ultimoAcceso: now },
        });

        req.user = {
            id: user.id,
            email: user.email,
            rol: user.rol,
            nombre: user.nombre,
            sessionId: session.token,
        };

        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Token inválido',
            message: error.message,
        });
    }
}

export function authorize(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'No autorizado',
                message: 'No se ha autenticado la petición',
            });
        }

        if (!hasRequiredRole(req.user.rol, allowedRoles)) {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'No tienes permisos suficientes para esta acción',
            });
        }

        next();
    };
}

export function getRolePriority(role) {
    return ROLE_PRIORITY[role] || 0;
}
