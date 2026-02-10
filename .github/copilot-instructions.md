# Instrucciones para Copilot

## DIRECTRICES OBLIGATORIAS

**ESTAS DIRECTRICES SON ABSOLUTAMENTE OBLIGATORIAS Y NO OPCIONALES:**

1. **Idioma**: Siempre hablar en castellano (español). Todas las explicaciones, instrucciones y documentación en castellano, así como nombres de archivos (excepto estándares que requieren inglés)
2. **Herramientas MCP**: Priorizar siempre el uso de herramientas de servidores MCP
3. **Sincronización GitHub**: Tras cada sesión, la aplicación debe estar sincronizada entre servidor y GitHub sin excepción. Ahora implica mantener **dos repos** coordinados (ver sección "Sincronización dual").
4. **Registro de desarrollo**: Mantener `/.github/registro.md` con todas las fases, árbol de directorios y estructura de base de datos

## Descripción del Proyecto

**Asistente IA para Actividades Juveniles** - Aplicación tipo ChatGPT para crear actividades, programaciones, dinámicas y oraciones para grupos de jóvenes de diferentes edades.

### Arquitectura de la Aplicación

```
Base de Datos MariaDB (usuarios/auth) ←→ Backend Node.js/Prisma ←→ Frontend Next.js/TypeScript
                                                    ↕
                                            ChromaDB (base vectorial para IA)
                                                    ↕
                                                API de IA
```

## Configuración del Entorno

### Conexión SSH
- **Servidor**: RPJ (conexión automática con clave de entorno)
- **Desarrollo**: Visual Studio Code a través de SSH
- **Ruta web**: `/var/www/vhosts/practical-chatelet.217-154-99-32.plesk.page/httpdocs`
- **Permisos**: `adminweb:psacln` con permisos web

### Stack Tecnológico

- **Backend**: Node.js con Prisma ORM
- **Frontend**: Next.js con TypeScript
- **Base de datos**: MariaDB (aplicación principal)
- **Base vectorial**: ChromaDB para Node.js (documentación IA)
- **Componentes UI**: Shadcn exclusivamente (sin excepciones salvo petición expresa)
- **Hosting**: Servidor Plesk

## Patrones de Desarrollo

### Estructura de Archivos
```
httpdocs/
├── .github/
│   ├── copilot-instructions.md
│   └── registro.md
├── backend/          # API Node.js/Prisma
├── frontend/         # Next.js/TypeScript
├── database/         # Esquemas y migraciones
└── docs/            # Documentación del proyecto
```

### Flujo de Trabajo
1. **Desarrollo local** vía SSH en VS Code
2. **Base de datos**: MariaDB para usuarios y aplicación principal
3. **Base vectorial**: ChromaDB para búsqueda semántica de documentación IA
4. **Frontend**: Componentes Shadcn únicamente
5. **Sincronización**: GitHub después de cada sesión (repos privado y público)
6. **Registro**: Actualizar `.github/registro.md` con cambios

### Comandos Comunes
```bash
# Configuración inicial
npm install
npx prisma generate
npx prisma migrate dev

# Desarrollo
npm run dev          # Next.js frontend
npm run server       # Backend API
```

## Consideraciones Específicas

### Base de Datos
- **MariaDB**: Usuarios, autenticación, sesiones, actividades, grupos
- **ChromaDB**: Base vectorial para documentación y búsqueda semántica IA
- **Prisma**: ORM para gestión de datos MariaDB y migraciones
- **Credenciales**: Usuario `sa`, contraseña `Servidor2025`, base de datos `rpjia`

### Componentes UI
- **Obligatorio**: Usar únicamente componentes Shadcn
- **Prohibido**: Otros frameworks/librerías de componentes
- **Excepción**: Solo si el usuario lo solicita expresamente

### Integración IA
- API externa para generación de contenido
- Consultas a base vectorial para contexto
- Respuestas personalizadas según edad del grupo

## Notas para Agentes IA

- Mantener siempre las directrices obligatorias
- Priorizar herramientas MCP en todas las operaciones
- Documentar cada cambio en `registro.md`
- Sincronizar con GitHub tras cada sesión de trabajo
- Usar TypeScript y componentes Shadcn exclusivamente

## Sincronización dual (repos privado y público)

> **Objetivo**: mantener el repositorio privado `asistente-ia-juvenil` con **todo** el contenido (código, documentación, tests, tooling) y, en paralelo, publicar un espejo público `ia.rpj` que solo contenga el código ejecutable.

1. **Repo privado (`asistente-ia-juvenil`)**
        - Trabajar siempre sobre `/var/www/vhosts/ia.rpj.es/httpdocs`.
        - Tras cada cambio: `git add`, `git commit`, `git push origin main`.
        - Este repo conserva documentación (`docs/`), `.github/`, `.vscode/`, tests, migraciones completas y cualquier archivo operativo.

2. **Repo público (`ia.rpj`)**
        - El contenido se genera con el script `scripts/publish-public.sh`.
        - El script crea/actualiza `/var/www/vhosts/ia.rpj.es/ia.rpj-public` mediante `rsync`, excluyendo automáticamente: `.git`, `.github`, `.vscode`, `docs/`, `database/`, `backend/prisma/migrations`, tests (`backend/tests`, `frontend/tests`), `test-upload-file.md`, cualquier `.env*`, `node_modules`, `.next` y la propia carpeta `ia.rpj-public`.
        - Tras copiar, el script elimina `node_modules` y `.next` residuales, borra `.gitignore`, quita migraciones y `database/`, inicializa el repo (si hiciera falta), hace commit y ejecuta `git push origin main` hacia `https://github.com/raulmolia/ia.rpj.git`.

3. **Cómo usar el script**
        ```bash
        cd /var/www/vhosts/ia.rpj.es/httpdocs
        ./scripts/publish-public.sh
        ```
        - Variables opcionales: `PUBLIC_EXPORT_DIR` (ruta alternativa para la copia limpia) y `PUBLIC_REMOTE` (URL del repo público).
        - El script aborta si no hay cambios listos para el público, evitando commits vacíos.

4. **Cuando el usuario pida "actualizar el proyecto"**
        - Interpretar como: (a) sincronizar repo privado; (b) ejecutar `publish-public.sh` y confirmar que `ia.rpj` está actualizado.
        - Documentar en la respuesta que ambos repos han sido sincronizados.

5. **Nunca** subir documentación, `.github`, `.vscode`, migraciones ni bases de datos al repo público.