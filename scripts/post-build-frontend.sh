#!/usr/bin/env bash
# Script para ejecutar después de npm run build en frontend
# Copia los archivos estáticos necesarios para Next.js standalone

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../frontend" && pwd)"
cd "$FRONTEND_DIR"

echo "📦 Copiando archivos estáticos a .next/standalone..."

# Limpiar directorios anteriores si existen
rm -rf .next/standalone/.next/static
rm -rf .next/standalone/public

# Copiar archivos estáticos generados por Next.js
if [ -d ".next/static" ]; then
    echo "  → Copiando .next/static..."
    cp -r .next/static .next/standalone/.next/static
else
    echo "  ⚠️  ADVERTENCIA: No se encontró .next/static"
fi

# Copiar archivos públicos
if [ -d "public" ]; then
    echo "  → Copiando public/..."
    cp -r public .next/standalone/public
else
    echo "  ⚠️  ADVERTENCIA: No se encontró public/"
fi

echo "✅ Archivos estáticos copiados correctamente"
echo ""
echo "Ahora puedes reiniciar el frontend con:"
echo "  cd /var/www/vhosts/ia.rpj.es/httpdocs && npx pm2 restart rpjia-frontend"
