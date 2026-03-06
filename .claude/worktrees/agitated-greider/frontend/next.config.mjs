/** @type {import('next').NextConfig} */
const nextConfig = {
    // Configuración experimental
    experimental: {
        serverComponentsExternalPackages: ['@prisma/client'],
        serverActions: {
            // Permitir orígenes reenviados por el proxy de Plesk/nginx.
            // Sin esto, Next.js rechaza las Server Actions internas (next-intl)
            // porque el proxy elimina el header `origin`, devuelve null y
            // el runtime lanza "Cannot read properties of null (reading 'message')".
            allowedOrigins: [
                'ia.rpj.es',
                'www.ia.rpj.es',
                'https://ia.rpj.es',
                'https://www.ia.rpj.es',
                '217.154.99.32',
                'localhost:3000',
                '127.0.0.1:3000',
                '0.0.0.0:3000',
            ],
        },
    },

    // Configuración de imágenes
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.example.com',
            },
        ],
    },

    // Variables de entorno públicas
    env: {
        APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Asistente IA Juvenil',
        API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    },

    // Configuración de headers de seguridad
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Credentials', value: 'true' },
                    { key: 'Access-Control-Allow-Origin', value: process.env.FRONTEND_URL || '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
                    { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
                ],
            },
        ];
    },

    // Configuración de Webpack
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
            };
        }
        return config;
    },

    // Configuración de salida
    output: 'standalone',

    // Configuración de TypeScript
    typescript: {
        ignoreBuildErrors: false,
    },

    // Configuración de ESLint
    eslint: {
        ignoreDuringBuilds: false,
    },
};

export default nextConfig;