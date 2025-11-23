// Rutas principales de la API
import express from 'express';
import prismaPackage from '@prisma/client';
import chromaService from '../services/chromaService.js';
import authRoutes from './auth.js';
import documentosRoutes from './documentos.js';
import fuentesWebRoutes from './fuentesWeb.js';
import chatRoutes from './chat.js';
import passwordRoutes from './password.js';
import filesRoutes from './files.js';

const { PrismaClient } = prismaPackage;

const router = express.Router();
const prisma = new PrismaClient();

// Subrutas
router.use('/auth', authRoutes);
router.use('/documentos', documentosRoutes);
router.use('/fuentes-web', fuentesWebRoutes);
router.use('/chat', chatRoutes);
router.use('/password', passwordRoutes);
router.use('/files', filesRoutes);

// Ruta de health check
router.get('/health', async (req, res) => {
    try {
        // Verificar conexión a MariaDB
        await prisma.$queryRaw`SELECT 1`;

        // Verificar ChromaDB
        const chromaCount = await chromaService.getDocumentCount();

        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            services: {
                database: 'MariaDB conectado',
                vector_db: chromaCount >= 0 ? 'ChromaDB conectado' : 'ChromaDB no disponible',
                documents: chromaCount
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Ruta de información de la API
router.get('/info', (req, res) => {
    res.json({
        name: 'Asistente IA para Actividades Juveniles',
        version: '1.0.0',
        description: 'API backend para generar actividades, dinámicas y oraciones para grupos juveniles',
        stack: {
            database: 'MariaDB',
            vector_db: 'ChromaDB',
            framework: 'Express.js',
            orm: 'Prisma'
        },
        endpoints: {
            health: '/api/health',
            info: '/api/info',
            auth: '/api/auth',
            documentos: '/api/documentos',
            chat: '/api/chat'
        }
    });
});

// Ruta para probar inserción en base de datos
router.post('/test-db', async (req, res) => {
    try {
        // Solo crear un registro de prueba si no existe
        const testUser = await prisma.usuario.upsert({
            where: { email: 'test@rpjia.com' },
            update: {},
            create: {
                email: 'test@rpjia.com',
                nombre: 'Usuario',
                apellidos: 'Prueba',
                nombreUsuario: 'test_user'
            }
        });

        res.json({
            message: 'Base de datos funcionando correctamente',
            user: testUser
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error en base de datos',
            details: error.message
        });
    }
});

export default router;