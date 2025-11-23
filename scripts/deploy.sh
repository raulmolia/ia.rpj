#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

step() {
  echo "[deploy] $1"
}

step "Actualizando repositorio"
git pull --rebase

step "Instalando dependencias backend"
npm install --prefix backend

step "Instalando dependencias frontend"
npm install --prefix frontend

step "Aplicando migraciones Prisma"
(
  cd backend
  if [ ! -f .env ]; then
    echo "[deploy] ERROR: falta backend/.env con DATABASE_URL" >&2
    exit 1
  fi
  if ls prisma/migrations/*/migration.sql >/dev/null 2>&1; then
    npx prisma migrate deploy
  else
    echo "[deploy] Sin migraciones pendientes; se omite prisma migrate deploy"
  fi
)

step "Compilando frontend"
npm run build --prefix frontend

step "Preparando artefactos frontend standalone"
# Asegurar que el directorio standalone tiene todos los archivos necesarios
rm -rf frontend/.next/standalone/.next/static frontend/.next/standalone/public
cp -R frontend/.next/static frontend/.next/standalone/.next/
cp -R frontend/public frontend/.next/standalone/

step "Reiniciando orquestación PM2"
npx pm2 start ecosystem.config.js --update-env
npx pm2 save

LOGGER_ENTRY="\n### Despliegue automatizado ${TIMESTAMP}\n- git pull --rebase\n- npm install --prefix backend\n- npm install --prefix frontend\n- prisma migrate deploy (condicional)\n- npm run build --prefix frontend\n- npx pm2 start ecosystem.config.js --update-env && npx pm2 save\n"

printf "%b" "$LOGGER_ENTRY" >> .github/registro.md

step "Despliegue completado"
