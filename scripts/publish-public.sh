#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="${PUBLIC_EXPORT_DIR:-$ROOT_DIR/../ia.rpj-public}"
PUBLIC_REMOTE="${PUBLIC_REMOTE:-https://github.com/raulmolia/ia.rpj.git}"

EXCLUDES=(
    '.git'
    '.github'
    '.vscode'
    'docs'
    'backend/tests'
    'frontend/tests'
    'test-upload-file.md'
    '.env'
    '.env.*'
    'backend/.env'
    'backend/.env.*'
    'frontend/.env'
    'frontend/.env.*'
    'backend/prisma/migrations'
    'database'
    'node_modules'
    '.next'
    'frontend/.next'
    'backend/.next'
    'ia.rpj-public'
)

mkdir -p "$PUBLIC_DIR"

RSYNC_ARGS=(-av --delete)
for pattern in "${EXCLUDES[@]}"; do
    RSYNC_ARGS+=("--exclude=${pattern}")
done

rsync "${RSYNC_ARGS[@]}" "$ROOT_DIR/" "$PUBLIC_DIR/"

pushd "$PUBLIC_DIR" >/dev/null
rm -rf node_modules backend/node_modules frontend/node_modules .next frontend/.next backend/.next
rm -f .gitignore
rm -rf backend/prisma/migrations database

if [ ! -d .git ]; then
    git init
    git branch -m main || true
    git remote add origin "$PUBLIC_REMOTE"
    git config user.name "${GIT_AUTHOR_NAME:-Desarrollador Asistente IA}"
    git config user.email "${GIT_AUTHOR_EMAIL:-dev@asistente-ia-juvenil.com}"
else
    git remote set-url origin "$PUBLIC_REMOTE"
fi

git add -A
if git diff --cached --quiet; then
    echo "No hay cambios para publicar en el repositorio público."
else
    git commit -m "chore: publish $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    git push origin main
fi
popd >/dev/null
