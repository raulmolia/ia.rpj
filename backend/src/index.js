import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiRoutes from './routes/index.js';
import chromaService from './services/chromaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde la ruta explícita
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Reconoce cabeceras X-Forwarded-* al estar tras un proxy reverso
app.set('trust proxy', 1);

// Middleware de seguridad
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por ventana de tiempo
    message: {
        error: 'Demasiadas solicitudes desde esta IP, inténtalo de nuevo más tarde.',
    },
    trustProxy: true,
});
app.use('/api/', limiter);

// CORS
const defaultAllowedOrigins = [
    'https://ia.rpj.es',
    'https://www.ia.rpj.es',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

const envAllowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]))
    .map((origin) => origin.replace(/\/$/, ''));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        const normalizedOrigin = origin.replace(/\/$/, '');

        if (allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }

        console.warn(`Origen no permitido por CORS: ${origin}`);
        return callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
}));

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Usar las rutas API
app.use('/api', apiRoutes);

// Ruta 404 para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        message: `La ruta ${req.originalUrl} no existe en esta API`,
        availableEndpoints: ['/api/health', '/api/info'],
    });
});

// Middleware de manejo de errores
app.use((error, req, res, next) => {
    console.error('Error:', error);

    res.status(error.status || 500).json({
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Ha ocurrido un error',
        timestamp: new Date().toISOString(),
    });
});

// Función para inicializar servicios
async function initializeServices() {
    console.log('🔧 Inicializando servicios...');

    // Inicializar ChromaDB
    const chromaInitialized = await chromaService.initialize();

    if (chromaInitialized) {
        console.log('📚 Base vectorial ChromaDB lista');
    } else {
        console.log('⚠️ Funcionando sin base vectorial');
    }
}

// Iniciar servidor
app.listen(PORT, async () => {
    console.log(`🚀 Servidor backend iniciado en puerto ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📋 Info API: http://localhost:${PORT}/api/info`);
    console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);

    // Inicializar servicios después de que el servidor esté en marcha
    await initializeServices();
    console.log('✅ Todos los servicios inicializados');
});

export default app;