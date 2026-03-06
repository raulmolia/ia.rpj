# Asistente IA para Actividades Juveniles

**Aplicación web tipo ChatGPT para la creación de actividades, programaciones, dinámicas y oraciones para grupos de jóvenes de diferentes edades.**

## 🎯 Descripción del Proyecto

Esta aplicación utiliza inteligencia artificial para ayudar a monitores, educadores y responsables de grupos juveniles a crear contenido personalizado según las necesidades específicas de cada grupo de edad.

### 🏗️ Arquitectura

```
Base de Datos MariaDB (usuarios/auth) ←→ Backend Node.js/Prisma ←→ Frontend Next.js/TypeScript
                                                    ↕
                                                ChromaDB (vectores IA)
                                                    ↕
                                                API de IA
```

## 🛠️ Stack Tecnológico

- **Backend**: Node.js + Prisma ORM
- **Frontend**: Next.js + TypeScript  
- **Base de datos**: MariaDB (aplicación principal)
- **Base vectorial**: ChromaDB (documentación IA)
- **Componentes UI**: Shadcn/ui exclusivamente
- **Hosting**: Servidor Plesk con SSH

## 🚀 Configuración del Entorno

### Requisitos Previos
- Node.js 18+
- MariaDB 10.6+ (o compatible)
- Servidor ChromaDB ≥ 0.4 (Docker o binario)
- Visual Studio Code
- Conexión SSH configurada

### Instalación
```bash
# Clonar el repositorio
git clone [URL_DEL_REPOSITORIO]
cd asistente-ia-juvenil

# Abrir con VS Code configurado
code asistente-ia-juvenil.code-workspace

# Instalar dependencias (usar tarea de VS Code)
# Ctrl+Shift+P → "Tasks: Run Task" → "📦 Instalar dependencias"

# Instalación desde la raíz (opcional)
npm install --prefix backend
npm install --prefix frontend
npm install
```

### Variables de Entorno
```env
# backend/.env
DATABASE_URL="mysql://usuario:password@localhost:3306/rpjia"
CHROMA_HOST="127.0.0.1"
CHROMA_PORT="8000"
NEXTAUTH_SECRET="tu-clave-secreta"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="tu-clave-jwt"
JWT_EXPIRES_IN="12h"
AUTH_SALT_ROUNDS="12"
SEED_DEFAULT_PASSWORD="ChangeMe123!"
FRONTEND_URL="http://localhost:3000"
FRONTEND_URLS="http://localhost:3000"
```

Variables opcionales para el seed (solo si se necesitan credenciales personalizadas):

```env
SEED_ADMIN_PASSWORD=""
SEED_DOCUMENTADOR_PASSWORD=""
SEED_USUARIO_PASSWORD=""
SEED_SUPERADMIN_EMAIL=""
SEED_SUPERADMIN_PASSWORD=""
SEED_SUPERADMIN_NAME=""
SEED_SUPERADMIN_LASTNAME=""
SEED_SUPERADMIN_USERNAME=""
SEED_SUPERADMIN_AVATAR=""
SEED_SUPERADMIN_PHONE=""
SEED_SUPERADMIN_BIRTHDATE=""
```

## 📁 Estructura del Proyecto

```
httpdocs/
├── .github/           # Configuración de GitHub y documentación
├── .vscode/           # Configuración completa de VS Code
├── backend/           # API Node.js con Prisma
├── frontend/          # Aplicación Next.js
├── database/          # Esquemas y migraciones
├── docs/             # Documentación del proyecto
└── asistente-ia-juvenil.code-workspace
```

## ⚡ Desarrollo

### Arranque rápido desde la raíz
```bash
# Ejecutar ambos servicios en paralelo desde httpdocs/
npm install            # instala concurrently la primera vez
npm run dev            # lanza backend (3001) y frontend (3000)
```

Scripts útiles:
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run install:all`
- `npm run pm2:start` / `npm run pm2:reload` / `npm run pm2:stop`
- `npm run deploy`

### Tareas Disponibles en VS Code
- **🚀 Ejecutar frontend** - Inicia Next.js en desarrollo
- **⚙️ Ejecutar backend** - Inicia servidor API
- **🔧 Prisma: Generar cliente** - Regenera cliente Prisma
- **🗃️ Prisma: Migrar BD** - Ejecuta migraciones
- **📊 Prisma: Studio** - Interfaz web de base de datos
- **🔄 Sincronizar GitHub** - Commit y push automático

### Flujo de Trabajo
1. Desarrollo en VS Code con conexión SSH
2. Uso exclusivo de componentes Shadcn/ui
3. Sincronización obligatoria con GitHub tras cada sesión
4. Documentación en castellano (excepto estándares)
5. Priorización de herramientas MCP
6. Despliegue productivo: `npm run deploy` (incluye `git pull`, instalación, migraciones, build, reinicio PM2)

### Build y Despliegue Frontend

**Importante:** El build del frontend incluye automáticamente la copia de archivos estáticos necesarios para Next.js standalone.

```bash
# Build automático (recomendado) - copia archivos automáticamente
cd frontend
npm run build

# Si la aplicación se queda en "Preparando tu espacio de trabajo..."
bash ../scripts/post-build-frontend.sh
npx pm2 restart rpjia-frontend
```

Ver documentación completa en [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## 🗃️ Base de Datos

### MariaDB Principal
- Usuarios y autenticación
- Sesiones y perfiles
- Actividades y programaciones generadas por IA

## 🔐 Sistema de Usuarios

- **Roles disponibles**: Superadmin, Administrador, Documentador y Usuario (jerárquicos)
- **Autenticación**: credenciales email + contraseña con hash bcrypt y tokens JWT
- **Endpoints clave**:
    - `POST /api/auth/login` / `POST /api/auth/logout`
    - `GET /api/auth/me`
    - `GET /api/auth/users`
    - `POST /api/auth/users`
    - `PATCH /api/auth/users/:id/role`
    - `PATCH /api/auth/users/:id/status`
- **Gestión de sesiones**: tabla `sesiones` con control de expiración y revocación
- **Seed inicial**: crea usuarios de ejemplo para cada rol con contraseñas de desarrollo

### ChromaDB (Base Vectorial)
- Documentación y ejemplos para IA
- Contexto semántico para generación
- Consultas vectoriales para recomendaciones
- Servidor Python dedicado: `python3 backend/scripts/run_chromadb.py` (requiere `pip install --user chromadb pysqlite3-binary`)

## 🤖 Funcionalidades IA

- **Generación de actividades** personalizadas por edad
- **Creación de programaciones** para eventos y campamentos
- **Dinámicas de grupo** adaptadas al contexto
- **Oraciones y reflexiones** según temáticas
- **Recomendaciones inteligentes** basadas en historial
- **Restricción temática**: Solo responde sobre pastoral juvenil, religión católica y temas relacionados
- **RAG flexible**: Prioriza documentación vectorial pero usa conocimiento del modelo cuando es necesario
- **Fuentes web**: Consulta páginas web, dominios completos y sitemaps como fuentes adicionales de información

## 👤 Interfaz de Usuario

- Panel estilo ChatGPT con chats anclados y archivados
- Menú de usuario contextual con acceso a perfil, administración y documentación
- Botón superior para alternar entre modo claro y oscuro gestionado por `next-themes`
- Panel de administración con alta de usuarios, asignación de roles y eliminación segura según jerarquía
- Gestión documental desde `/documentacion` con subida de PDFs, etiquetado y biblioteca enlazada a la base vectorial
- Gestión de fuentes web desde `/fuentes-web` con scraping de URLs, dominios y sitemaps

## 📋 Directrices de Desarrollo

### Obligatorias
- ✅ Toda documentación en castellano
- ✅ Priorizar herramientas MCP
- ✅ Sincronización GitHub tras cada sesión
- ✅ Mantener registro en `.github/registro.md`
- ✅ Componentes Shadcn/ui exclusivamente

### Recomendadas
- Usar TypeScript en todo el código
- Mantener arquitectura modular
- Documentar cambios importantes
- Realizar pruebas antes de deploy

## 🌐 Despliegue en producción (ia.rpj.es)

1. Compilar el frontend: `npm run build --prefix frontend` (usa `.env.local` con `NEXT_PUBLIC_API_URL=https://ia.rpj.es`).
2. Sincronizar recursos con el bundle `standalone`:
    ```bash
    rsync -a --delete frontend/.next/static/ frontend/.next/standalone/.next/static/
    rsync -a --delete frontend/public/ frontend/.next/standalone/public/
    ```
3. Reiniciar procesos PM2 con las variables actualizadas:
    ```bash
    cd httpdocs
    npx pm2 restart rpjia-frontend --update-env
    npx pm2 restart rpjia-backend --update-env
    ```
4. Verificar el proxy Apache (`httpdocs/.htaccess`) para asegurar que `/api` apunta a `http://127.0.0.1:3001` y el resto sirve el frontend.
5. Confirmar que el bundle no contiene referencias a `http://localhost:3001` (`grep -R "localhost:3001" frontend/.next/standalone || true`).

Si se requiere permitir dominios adicionales en CORS, añadirlos a `FRONTEND_URLS` (lista separada por comas) y reiniciar `rpjia-backend` con `--update-env`.

## 🔧 Configuración SSH

```bash
# ~/.ssh/config
Host RPJ
    HostName your-server.com
    User adminweb
    IdentityFile ~/.ssh/id_rsa
```

## 📄 Licencia

[Definir licencia según necesidades del proyecto]

## 👥 Contribuciones

Las contribuciones deben seguir las directrices obligatorias del proyecto y mantener la sincronización con GitHub.

---

**Nota**: Este proyecto sigue directrices específicas de desarrollo. Consultar `.github/copilot-instructions.md` para detalles completos.