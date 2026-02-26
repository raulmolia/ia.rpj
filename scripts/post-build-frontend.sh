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

# ── Parche del bundle de Next.js ──────────────────────────────────────────────
# El bundle app-page.runtime.prod.js tiene un bug: cuando el error capturado es
# null (puede ocurrir con Server Actions sin header origin), accede a e.message
# sin null check → TypeError. Lo parcheamos aquí para que sobreviva a futuros builds.
BUNDLE=".next/standalone/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js"
if [ -f "$BUNDLE" ]; then
    python3 - "$BUNDLE" << 'PYEOF'
import sys
filepath = sys.argv[1]
with open(filepath) as f:
    content = f.read()
if 'e.message+e.stack' in content:
    content = content.replace(
        'tQ()(e.message+e.stack+(e.digest||"")).toString()',
        'tQ()((e?.message||"")+(e?.stack||"")+(e?.digest||"")).toString()',
        1
    )
    content = content.replace(
        't.setStatus({code:M.SpanStatusCode.ERROR,message:e.message})',
        't.setStatus({code:M.SpanStatusCode.ERROR,message:e?.message})',
        1
    )
    with open(filepath, 'w') as f:
        f.write(content)
    print("  → Parche null-safe aplicado en app-page.runtime.prod.js")
else:
    print("  → Parche ya presente en app-page.runtime.prod.js")
PYEOF
fi
# ──────────────────────────────────────────────────────────────────────────────

echo ""
echo "Ahora puedes reiniciar el frontend con:"
echo "  cd /var/www/vhosts/ia.rpj.es/httpdocs && npx pm2 restart rpjia-frontend"
