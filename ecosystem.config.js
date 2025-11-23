module.exports = {
    apps: [
        {
            name: "rpjia-backend",
            cwd: "./backend",
            script: "node",
            args: "src/index.js",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: "3001"
            },
            autorestart: true,
            max_restarts: 5,
            restart_delay: 5000
        },
        {
            name: "rpjia-frontend",
            cwd: "./frontend/.next/standalone",
            script: "node",
            args: "server.js",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: "3000",
                HOSTNAME: "127.0.0.1",
                HOST: "127.0.0.1"
            },
            autorestart: true,
            max_restarts: 5,
            restart_delay: 5000
        },
        {
            name: "rpjia-chromadb",
            cwd: "./",
            script: "python3",
            args: "backend/scripts/run_chromadb.py",
            watch: false,
            env: {
                CHROMA_HOST: process.env.CHROMA_HOST || "127.0.0.1",
                CHROMA_PORT: process.env.CHROMA_PORT || "8000",
                CHROMA_PERSIST_PATH: process.env.CHROMA_PERSIST_PATH || "./database/chroma",
                CHROMA_TELEMETRY: process.env.CHROMA_TELEMETRY || "false"
            },
            autorestart: true,
            max_restarts: 5,
            restart_delay: 5000
        },
        {
            name: "rpjia-web-updater",
            cwd: "./backend",
            script: "node",
            args: "jobs/actualizarFuentesWeb.js",
            watch: false,
            autorestart: false,
            cron_restart: "0 2 * * *", // Ejecutar cada día a las 2:00 AM
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};
