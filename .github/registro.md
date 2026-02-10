# Registro de Desarrollo - Asistente IA para Actividades Juveniles

## Actualización 14 de diciembre de 2025 - Ordenamiento alfabético en documentación y fuentes web
- 📚 **Ordenamiento en biblioteca documental**: Añadida funcionalidad de ordenamiento alfabético en columna "Título" de la página documentación
- 🌐 **Ordenamiento en fuentes web**: Implementado ordenamiento en columna "URL / Título" de la tabla de fuentes web
- 🔄 **Tres estados de ordenamiento**: Sin orden (none), ascendente (A-Z), descendente (Z-A) en ambas secciones
- 🖱️ **UX mejorada**: Botones clickeables en encabezados con iconos visuales (ArrowUpDown, ArrowUp, ArrowDown)
- 🌍 **Comparación con localeCompare**: Ordenamiento respeta acentos y caracteres especiales en español
- 🔧 **Criterios mutuamente excluyentes**: Al ordenar por título, desactiva automáticamente el orden por fecha y viceversa
- 📄 **Reset automático**: Al cambiar el criterio de ordenamiento, la paginación vuelve a la página 1
- ✅ **Implementación técnica**: 
  - Estado `titleSortOrder` con tipos `"none" | "asc" | "desc"`
  - Lógica condicional en `useMemo` para optimización de rendimiento
  - Ordenamiento por título usa título o dominio en fuentes web
  - Integración perfecta con sistema de paginación existente
- 📁 **Archivos modificados**: 
  - `frontend/src/app/documentacion/page.tsx`
  - `frontend/src/components/web-sources-table.tsx`
- 🚀 **Despliegue**: Build y reinicio del frontend exitoso, funcionalidad operativa en producción

## Actualización 14 de diciembre de 2025 - Ordenamiento alfabético en guía documental
- 📊 **Ordenamiento en columna "Título"**: Añadida funcionalidad de ordenamiento alfabético en la tabla del repositorio documental
- 🔄 **Tres estados de ordenamiento**: Sin orden (none), ascendente (A-Z), descendente (Z-A)
- 🖱️ **UX mejorada**: Botón clickeable en encabezado con iconos visuales (ArrowUpDown, ArrowUp, ArrowDown)
- 🌍 **Comparación con localeCompare**: Ordenamiento respeta acentos y caracteres especiales en español
- 🔧 **Reset automático**: Al cambiar el orden, la paginación vuelve a la página 1
- ✅ **Implementación**: Estado `sortOrder`, función `toggleSortOrder`, documentos ordenados con `useMemo`
- 🚀 **Despliegue**: Build y reinicio del frontend exitoso

## Actualización 14 de diciembre de 2025 - Selector de idioma funcional y corrección avatar
- 🌐 **Selector de idioma implementado**: Componente LanguageSelector en header junto al botón de tema
- 🎨 **Color de avatar corregido**: Cambiado de #009846 a #94c120 (verde lima) en todas las instancias
- 🐛 **Fix crítico de inicialización**: Corregido problema donde el saludo siempre aparecía en español
- 🔧 **Causa raíz**: LocaleProvider se inicializaba con defaultLocale y solo después cargaba desde localStorage
- ✅ **Solución implementada**: 
  - Modificado locale-context.tsx para leer localStorage síncronamente antes del primer render
  - Creada función getInitialLocale() que verifica localStorage durante inicialización
  - LanguageSelector persiste en localStorage y backend (updateProfile)
  - Recarga completa de página para aplicar cambios de idioma
- 📝 **Traducciones verificadas**: Todos los 10 idiomas (es, en, fr, it, pt, hu, pl, ca, gl, eu) tienen saludos traducidos
- 🚀 **Despliegues**: 9 builds y reinicios durante el desarrollo, sincronizados en ambos repositorios

## Actualización 18 de noviembre de 2025 - Fix creación espontánea de chats
- 🐛 **Problema resuelto**: Múltiples chats se creaban espontáneamente al hacer login debido a condición de carrera
- 🔧 **Causa raíz**: useEffect con dependencias problemáticas (`chats.length`) que se disparaba múltiples veces
- ✅ **Solución implementada**: 
  - Añadido estado `hasInitialLoadCompleted` para controlar flujo de creación
  - Modificado useEffect para crear chat solo después de completar carga inicial de conversaciones
  - Reseteo de flags (`initialChatCreatedRef` y `hasInitialLoadCompleted`) en logout
  - Eliminadas dependencias problemáticas del array de dependencias
  - Limpieza de estados duplicados (`loadingConversations`, `chatError`)
- 📊 **Resultado**: Ahora solo se crea UN chat inicial por sesión, sin duplicados

## Actualización 16 de noviembre de 2025 - Sistema de fuentes web
- 🌐 **Scraping web integrado**: El asistente ahora puede consultar páginas web además de documentos PDF
- 📄 **Tres tipos de fuente**: PAGINA (URL individual), DOMINIO (crawling completo hasta 50 páginas), SITEMAP (procesamiento de XML)
- 🛠️ **Servicio webScraperService**: Implementado con cheerio para extracción de HTML limpio, límites configurables, timeout 30s
- 🗄️ **Modelo FuenteWeb**: Nueva tabla con campos para URL, dominio, etiquetas, tipo, estado de procesamiento y vectorización
- 🔌 **API REST**: Endpoints en `/api/fuentes-web` para listar, agregar, editar, eliminar y reprocesar fuentes
- 🔍 **Búsqueda combinada**: Chat busca en paralelo en documentos PDF y fuentes web, ordena por relevancia vectorial
- 📦 **Dependencia cheerio**: Versión 1.0.0-rc.12 para parsing HTML avanzado
- ⚙️ **Variables de entorno**: WEB_SCRAPER_MAX_PAGES, WEB_SCRAPER_MAX_SIZE, WEB_SCRAPER_USER_AGENT, WEB_SCRAPER_TIMEOUT_MS, WEB_CHUNK_SIZE, WEB_CHUNK_OVERLAP, WEB_MAX_CHUNKS, CHROMA_COLLECTION_WEB

## Actualización 16 de noviembre de 2025 - Restricciones temáticas y RAG flexible
- 🎯 Restricción temática estricta implementada en todos los prompts del sistema
- 🚫 El asistente SOLO responde preguntas sobre pastoral juvenil, religión católica y temas relacionados
- 💬 Mensaje de rechazo educado para preguntas fuera de tema
- 📚 Uso flexible de documentación RAG: prioritaria pero no exclusiva
- 🧠 El modelo puede usar su conocimiento cuando la documentación es insuficiente
- ✅ Actualizado en las 5 intenciones: DINAMICA, CELEBRACION, PROGRAMACION, ORACION, OTROS
- 📝 Prompts restructurados con secciones claras de restricción temática y uso de documentación

## Actualización 13 de noviembre de 2025 - Corrección UI sidebar
- 🐛 Solucionado problema crítico en panel lateral: títulos largos ocultaban el botón de opciones ("...")
- 🎨 Cambio de grid a flexbox para mejor control del espacio en items de chat
- 📏 Añadido padding-right (pr-10) al botón principal para reservar espacio fijo al botón de opciones
- 🔧 Botón de opciones ahora visible siempre en hover gracias a posicionamiento absoluto mejorado
- 🚫 Prevención de propagación de click para evitar activar chat al abrir menú de opciones
- 📱 Ajustado layout.tsx con altura completa (h-screen) y overflow correcto para contenedor principal

## Actualización 6 de noviembre de 2025 - UX del compositor y despliegues
- 🖥️ El compositor de prompts del chat replica el flujo de ChatGPT: envío con Enter, textarea autoajustable y badges de prompts rápidos.
- 🎨 Paleta oscura (bordes y botones negros) aplicada al cuadro de entrada, al botón `+` y al botón de envío.
- 🧳 Procedimiento manual de copia de artefactos (`.next/static`, `BUILD_ID`, `public/`) hacia `.next/standalone/.next` documentado tras cada build para evitar 404.
- 📚 `docs/RESUMEN_SESION.md` actualizado con pasos de despliegue y próximos ajustes.

## Información del Proyecto
- **Nombre**: Asistente IA para Actividades Juveniles
- **Tipo**: Aplicación web tipo ChatGPT
- **Objetivo**: Generar actividades, programaciones, dinámicas y oraciones para grupos juveniles
- **Inicio del proyecto**: 1 de noviembre de 2025

## Configuración del Entorno
- **Servidor SSH**: RPJ
- **Ruta de desarrollo**: `/var/www/vhosts/practical-chatelet.217-154-99-32.plesk.page/httpdocs`
- **Permisos**: `adminweb:psacln`
- **IDE**: Visual Studio Code (conexión SSH)

## Stack Tecnológico
- **Backend**: Node.js + Express + Prisma ORM
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Base de datos**: MariaDB (aplicación principal)
- **Base vectorial**: ChromaDB para Node.js (búsqueda semántica IA)
- **Componentes UI**: Shadcn/ui (exclusivo)
- **Hosting**: Servidor Plesk

---

## Registro de Fases de Desarrollo

### Fase 1: Configuración Inicial (1 Nov 2025)
**Estado**: ✅ Completada

#### Acciones realizadas:
- [x] Creación de `.github/copilot-instructions.md` con directrices obligatorias
- [x] Creación de `.github/registro.md` para seguimiento del proyecto
- [x] Configuración completa de Visual Studio Code
  - [x] Workspace principal (`asistente-ia-juvenil.code-workspace`)
  - [x] Configuración del proyecto (`.vscode/settings.json`)
  - [x] Tareas automatizadas (`.vscode/tasks.json`)
  - [x] Configuración de debugging (`.vscode/launch.json`)
  - [x] Extensiones recomendadas (`.vscode/extensions.json`)
  - [x] Configuración de conexiones (`.vscode/configuracion-conexiones.json`)
  - [x] Documentación de configuración (`.vscode/README.md`)
- [x] Configuración inicial del repositorio GitHub
  - [x] Inicialización de git con rama main
  - [x] Configuración de usuario git del proyecto
  - [x] Creación de README.md completo
  - [x] Configuración de .gitignore
  - [x] Primer commit realizado
- [x] Estructura de carpetas del proyecto completa
  - [x] backend/ con subdirectorios src/ y prisma/
  - [x] frontend/ con subdirectorios src/ y public/
  - [x] database/ para esquemas
  - [x] docs/ para documentación

### Fase 2: Backend y Frontend Base (1 Nov 2025)
**Estado**: ✅ Completada

#### Acciones realizadas:
- [x] Configuración completa del backend Node.js
  - [x] Instalación de dependencias (Express.js, Prisma, JWT, etc.)
  - [x] Estructura de directorios backend
  - [x] Configuración de servidor Express.js
  - [x] Middleware de seguridad y CORS
  - [x] Rutas base implementadas
- [x] Configuración completa del frontend Next.js
  - [x] Instalación de dependencias (Next.js 14, TypeScript, Tailwind)
  - [x] Configuración de Shadcn/ui
  - [x] Estructura App Router
  - [x] Configuración de Tailwind CSS
  - [x] Componentes base creados
- [x] Ambos servidores funcionando correctamente
  - [x] Backend en puerto 3001
  - [x] Frontend en puerto 3000

### Fase 3: Base de Datos SQLite (1 Nov 2025)
**Estado**: ✅ Completada

#### Problema PostgreSQL resuelto:
- **Problema identificado**: PostgreSQL RPJIA con autenticación Ident bloqueada
- **Error específico**: "Ident authentication failed for user 'sa'"
- **Diagnóstico**: Configuración Plesk incompatible con autenticación por contraseña
- **Solución implementada**: Migración temporal a SQLite para desarrollo

#### Acciones realizadas:
- [x] Adaptación del esquema Prisma para SQLite
  - [x] Conversión de enums a String con validación en aplicación
  - [x] Conversión de arrays a JSON strings
  - [x] Mantenimiento de relaciones y foreign keys
- [x] Generación exitosa del cliente Prisma
- [x] Creación de migraciones iniciales
- [x] Base de datos SQLite operativa (`dev.db`)
- [x] Prueba de conexión exitosa
- [x] Configuración de Node.js y dependencias
  - [x] package.json backend con todas las dependencias necesarias
  - [x] package.json frontend con Next.js, TypeScript y Shadcn
  - [x] Archivos .env.example para ambos entornos
  - [x] Configuración de TypeScript (tsconfig.json)
  - [x] Configuración de Next.js (next.config.mjs)
  - [x] Configuración de Tailwind CSS y PostCSS
  - [x] Servidor backend básico con Express.js funcionando
- [x] Configuración de PostgreSQL
  - [x] Esquema Prisma completo para base de datos principal
  - [x] Esquema SQL para base de datos vectorial
  - [x] Seed básico con datos de ejemplo
  - [x] Configuración de vector embeddings para IA
- [x] Configuración inicial de Shadcn/ui
  - [x] components.json configurado
  - [x] Utilidades básicas en lib/utils.ts
  - [x] Componente Button base de Shadcn
  - [x] Estructura de directorios para componentes UI
  - [x] Página principal Next.js con diseño responsive

#### Árbol de directorios actual:
```
httpdocs/
├── .github/
│   ├── copilot-instructions.md
│   └── registro.md
├── .vscode/
│   ├── settings.json
│   ├── tasks.json
│   ├── launch.json
│   ├── extensions.json
│   ├── configuracion-conexiones.json
│   ├── formatters.json
│   └── README.md
├── backend/
│   ├── src/
│   │   └── index.js (servidor Express)
│   ├── prisma/
│   │   ├── schema.prisma (esquema completo)
│   │   └── seed.js (datos de ejemplo)
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   └── ui/
│   │   │       └── button.tsx
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── components.json
│   └── .env.example
├── database/
│   └── schema-vectorial.sql
├── docs/
├── asistente-ia-juvenil.code-workspace
├── README.md
├── .gitignore
└── index.html (página por defecto Plesk)
```

#### Estructura de base de datos:
```
PostgreSQL Principal (asistente_ia_juvenil):
├── usuarios (id, email, nombre, organizacion, configuraciones...)
├── sesiones (id, usuarioId, token, metadatos...)
├── actividades (id, usuarioId, titulo, contenido, clasificacion...)
├── actividades_favoritas (usuarioId, actividadId)
└── configuraciones_usuario (usuarioId, clave, valor)

PostgreSQL Vectorial (asistente_ia_vectorial):
├── documentos_vectoriales (id, contenido, embedding, clasificacion...)
├── ejemplos_actividades (id, documento_id, detalles_actividad...)
├── plantillas_actividades (id, estructura, variables...)
├── contenido_inspiracional (id, tipo, contenido, tematica...)
└── conocimiento_juventud (id, tema, rango_edad, aplicacion...)

Funcionalidades implementadas:
- Vector embeddings para búsqueda semántica
- Clasificación por edad, tipo y dificultad
- Sistema de tags y categorización
- Métricas de uso y calificaciones
- Plantillas reutilizables
```

---

### Configuraciones Completadas

#### Visual Studio Code
- **Workspace completo** configurado con todas las herramientas necesarias
- **Extensiones automáticas** para desarrollo con Node.js, TypeScript, PostgreSQL
- **Tareas predefinidas** para build, desarrollo, debugging y sincronización
- **Debugging configurado** para frontend, backend y tests
- **Conexiones preparadas** para bases de datos PostgreSQL y SSH
- **Formateo automático** y linting configurado

---

## Resumen de la Fase 1 - COMPLETADA ✅

### 🎯 Objetivos Alcanzados
- **Configuración completa de Visual Studio Code** con workspace, tareas, debugging y extensiones
- **Repositorio Git inicializado** con estructura profesional y documentación completa
- **Backend Node.js/Express** configurado con middlewares de seguridad y rutas básicas
- **Frontend Next.js/TypeScript** con App Router, Tailwind CSS y configuración responsive
- **Esquemas de base de datos** completos para PostgreSQL principal y vectorial
- **Shadcn/ui configurado** como librería de componentes UI obligatoria
- **Estructura de proyecto** organizada según la arquitectura definida

### 📊 Métricas del Proyecto
- **Archivos creados**: 29 archivos de configuración y código
- **Commits realizados**: 2 commits con mensajes descriptivos
- **Líneas de código**: ~1,500+ líneas entre configuración, esquemas y código base
- **Dependencias configuradas**: 40+ paquetes NPM entre frontend y backend

### 🚀 Estado Actual
El proyecto está **100% listo para desarrollo** con:
- VS Code configurado para conexión SSH automática
- Todas las herramientas de desarrollo funcionando
- Estructura de base de datos diseñada
- Componentes UI base implementados
- Documentación completa y actualizada

---

## Próximas Acciones Planificadas

1. **Configuración del repositorio GitHub remoto**
   - Crear repositorio en GitHub
   - Configurar origin remoto
   - Subir código al repositorio

2. **Instalación de dependencias**
   - npm install en backend y frontend
   - Verificar instalación de Shadcn/ui
   - Configurar variables de entorno

3. **Configuración de bases de datos**
   - Crear bases de datos PostgreSQL
   - Ejecutar migraciones Prisma
   - Poblar base vectorial con datos de ejemplo

4. **Desarrollo de funcionalidades core**
   - Sistema de autenticación
   - Interfaz de chat con IA
   - Generador de actividades

5. **Deploy y producción**
   - Configuración de producción en Plesk
   - Variables de entorno de producción
   - Testing y optimización

---

### Fase 2: Migración a MariaDB y Configuración ChromaDB (1-2 Nov 2025)
**Estado**: ✅ Completada

#### Problema identificado:
- PostgreSQL configurado con autenticación `ident` en lugar de `password`
- Imposibilidad de conectar con credenciales usuario/contraseña
- Error: `FATAL: Ident authentication failed for user`
- Decisión: Migrar a MariaDB que no presenta problemas de autenticación en Plesk

#### Acciones realizadas:
- [x] **Migración de PostgreSQL a MariaDB**
  - [x] Creación de base de datos `rpjia` en MariaDB
  - [x] Configuración de usuario `sa` con contraseña `Servidor2025`
  - [x] Actualización de schema Prisma de `postgresql` a `mysql`
  - [x] Corrección de campos incompatibles (String[] a String separados por comas)
  - [x] Generación de cliente Prisma para MariaDB
  - [x] Ejecución exitosa de `prisma db push` - Todas las tablas creadas

- [x] **Configuración de ChromaDB**
  - [x] Instalación de paquete `chromadb` para Node.js
  - [x] Creación de servicio ChromaDB (`src/services/chromaService.js`)
  - [x] Configuración de estructura para base vectorial
  - [x] Implementación de métodos: initialize, addDocument, searchSimilar, getDocumentCount
  - [x] Modo fallback sin vectores para desarrollo inicial

- [x] **Actualización de configuración**
  - [x] `.env` actualizado con credenciales MariaDB
  - [x] Configuración de ChromaDB en variables de entorno
  - [x] Actualización de `src/index.js` con inicialización de servicios
  - [x] Creación de rutas API (`src/routes/index.js`)

- [x] **Endpoints API implementados**
  - [x] `/api/health` - Health check con estado de MariaDB y ChromaDB
  - [x] `/api/info` - Información del stack tecnológico
  - [x] `/api/test-db` - Prueba de inserción en base de datos

#### Tests realizados:
```bash
# Test de conexión MariaDB
✅ npx prisma generate - Cliente generado correctamente
✅ npx prisma db push - Base de datos sincronizada
✅ Tablas creadas: Usuario, Grupo, ParticipacionGrupo, Actividad, 
   ActividadGenerada, Programacion, SesionUsuario

# Test de servidor
✅ Servidor iniciado en puerto 3001
✅ Servicios inicializados correctamente
✅ ChromaDB en modo sin vectores (pendiente configuración completa)
```

#### Estructura de Base de Datos MariaDB:
```
rpjia/
├── Usuario (usuarios del sistema)
├── Grupo (grupos juveniles)
├── ParticipacionGrupo (relación usuarios-grupos)
├── Actividad (catálogo de actividades)
├── ActividadGenerada (actividades creadas por IA)
├── Programacion (programaciones de actividades)
└── SesionUsuario (sesiones y autenticación)
```

#### Archivos modificados/creados:
- `.github/copilot-instructions.md` - Actualizado a MariaDB + ChromaDB
- `backend/prisma/schema.prisma` - Migrado a MySQL
- `backend/.env` - Credenciales MariaDB
- `backend/src/services/chromaService.js` - Nuevo servicio vectorial
- `backend/src/routes/index.js` - Rutas API actualizadas
- `backend/src/index.js` - Inicialización de servicios
- `backend/package.json` - Dependencia ChromaDB añadida

#### Configuración técnica final:
```javascript
Stack de Base de Datos:
- MariaDB: mysql://sa:Servidor2025@127.0.0.1:3306/rpjia
- ChromaDB: Preparado para búsqueda semántica (modo desarrollo)
- Prisma Client: Generado y funcionando
```

#### Problemas resueltos:
1. ✅ Autenticación PostgreSQL (migrado a MariaDB)
2. ✅ Arrays incompatibles en MySQL (convertidos a String con separadores)
3. ✅ Conexión base de datos verificada
4. ✅ Schema sincronizado correctamente

### 🎯 Estado Actual del Proyecto
- **Backend**: ✅ Funcional con MariaDB
- **Base de datos**: ✅ Operativa con todas las tablas
- **ChromaDB**: ⚠️ Preparado pero no activo (modo desarrollo)
- **Frontend**: ✅ Funcional en puerto 3000
- **API**: ✅ Endpoints básicos operativos

---

## Próximas Acciones Planificadas

1. **Activación completa de ChromaDB**
   - Configurar servidor ChromaDB dedicado
   - Implementar embeddings para búsqueda semántica
   - Poblar con documentación de actividades

2. **Población de base de datos**
   - Crear seed con datos de ejemplo
   - Usuarios de prueba
   - Actividades base para testeo

3. **Desarrollo de funcionalidades core**
   - Sistema de autenticación con JWT
   - Interfaz de chat con IA
   - Generador de actividades con contexto vectorial

4. **Testing e integración**
   - Tests unitarios de servicios
   - Tests de integración API
   - Tests end-to-end frontend-backend

5. **Deploy y producción**
   - Optimización de rendimiento
   - Variables de entorno de producción
   - Documentación de deploy

---

*Última actualización: 2 de noviembre de 2025 - Fase 2 completada exitosamente*

---

## Actualización 2 de noviembre de 2025 - Integración ChromaDB & Seed

- 📄 README principal actualizado con arquitectura MariaDB + ChromaDB y requisitos revisados
- 🔗 Repositorio sincronizado con remoto GitHub (`origin`)
- 🌱 Script `backend/prisma/seed.js` ampliado con sincronización automática a ChromaDB
- 🤖 Servicio `backend/src/services/chromaService.js` conectado a ChromaDB mediante cliente oficial
- ⚙️ Variables de entorno de ejemplo adaptadas a MariaDB y configuración vectorial

## Actualización 2 de noviembre de 2025 - Sistema de Usuarios y Roles

- 🔐 Añadido enum `Rol` en Prisma y campo `rol` para usuarios con niveles jerárquicos
- 🔑 Campo `passwordHash` y gestión de contraseñas seguras con bcrypt
- 🛣️ Nuevas rutas `/api/auth/*` para login, logout, perfil y administración de usuarios
- 🧩 Middleware de autenticación JWT con verificación de sesiones en MariaDB
- 🌱 Seed ampliado con usuarios de ejemplo para los cuatro roles configurables mediante variables de entorno
- 📘 README actualizado con las variables JWT y la descripción del sistema de usuarios

## Actualización 2 de noviembre de 2025 - Seed Idempotente

## Actualización 3 de noviembre de 2025 - Gestión Documental y Migraciones

- ⚠️ Intento de ejecutar `npx prisma migrate dev --name add_documentos` bloqueado por falta de permisos para crear base de datos sombra con el usuario `sa`; pendiente definir `shadowDatabaseUrl` con credenciales que permitan creación temporal o aplicar la migración desde un entorno con privilegios ampliados.
- 🔁 Se verificó nuevamente la ejecución de la migración forzando `PRISMA_MIGRATE_DEV_SKIP_SHADOW_DATABASE`, pero Prisma siguió intentando crear la base sombra y devolvió el mismo error P3014.
- 🛠️ Ajustado el componente `frontend/src/app/documentacion/page.tsx` sustituyendo el icono inexistente `CloudUpload` por `UploadCloud` de `lucide-react`, corrigiendo el error de compilación en la línea 10.
- ✅ Compilación del frontend (`npm run build`) completada correctamente tras la corrección del icono.
- 🔍 Resultado pendiente: completar la migración `add_documentos` cuando se disponga de permisos adecuados o configuración alternativa de shadow database.

- ✅ Ejecutado `npx prisma db push` para sincronizar el esquema con MariaDB sin necesidad de shadow database, habilitando la tabla `documentos` y las relaciones requeridas.
- 📦 Generada la migración `20251103_add_documentos` mediante `prisma migrate diff` (sin usar shadow DB) y marcada como aplicada con `prisma migrate resolve --applied`, dejando el historial listo para `migrate deploy` en otros entornos.
- 🔁 Regenerado Prisma Client (`npx prisma generate`) tras la sincronización para asegurar que el backend use los tipos actualizados.
- ⚙️ Actualizado `backend/.env` con `CHROMA_COLLECTION`, `CHROMA_COLLECTION_DOCUMENTOS`, `DOCUMENTS_STORAGE_PATH` y `DOCUMENTS_MAX_SIZE` para que las rutas de documentación funcionen sin configuraciones adicionales.
- 📂 Verificado el directorio de almacenamiento `backend/storage/documentos` como destino por defecto de los PDF cargados.
- 🧠 Instalado `@chroma-core/default-embed` y reejecutado el seed para dejar preparada la generación automática de embeddings cuando el servidor de Chroma esté disponible.
- 🔄 Ajustadas las importaciones de Prisma en `backend/src/routes/*.js` y `src/middleware/auth.js` para compatibilidad con Node 24 (CommonJS vs ESM), añadiendo *fallbacks* para enums cuando `$Enums` no está presente.
- ▶️ Reiniciado el backend con PM2 (`./node_modules/.bin/pm2 start ecosystem.config.js --only rpjia-backend`) verificando que queda en estado `online` y permitiendo de nuevo las llamadas a `/api/documentos`.

## Actualización 3 de noviembre de 2025 - Páginas de Documentación y Administración

- 📚 Creada `frontend/src/app/documentacion/page.tsx` con control de acceso por roles (SUPERADMIN, ADMINISTRADOR, DOCUMENTADOR) y enlaces directos a la documentación interna del proyecto y al repositorio GitHub.
- 🛡️ Creada `frontend/src/app/admin/page.tsx` con control de acceso exclusivo para SUPERADMIN y ADMINISTRADOR, introduciendo tablero informativo para futuras herramientas de gestión.
- 🔁 Ambas vistas redirigen al panel principal en caso de acceso no autorizado y muestran indicadores de carga mientras se verifica la sesión desde el contexto de autenticación.
- 🌗 Integrado botón de alternancia claro/oscuro (`frontend/src/components/theme-toggle.tsx`) visible en el encabezado principal y gestionado por `next-themes` a través del proveedor global.
- 👥 Panel `/admin` evolucionado a gestor de usuarios con creación, asignación de roles y eliminación directa (solo roles inferiores) consumiendo el endpoint `GET/POST/PATCH/DELETE` de `api/auth/users`.
- 🧰 Backend amplía `backend/src/routes/auth.js` con `DELETE /api/auth/users/:id`, validando jerarquía de roles y evitando la autoeliminación de la cuenta activa.
- 🔁 Eliminada redirección legacy en `frontend/next.config.mjs` que llevaba `/admin` a `/dashboard/admin`, permitiendo acceder directamente al nuevo panel sin errores 404.
- 🗂️ Ajustado `frontend/src/app/page.tsx` para que los chats archivados se oculten del panel lateral, se gestionen desde el diálogo dedicado y vuelvan al listado principal al desarchivarse.
- 🗑️ Añadida confirmación visual para eliminar chats, evitando borrados accidentales mediante un diálogo de advertencia.

- 👤 Seed preparado para superadministradores adicionales configurables mediante variables de entorno (sin credenciales embebidas)
- ♻️ Seed reorganizado con identificadores deterministas (upsert) para evitar duplicados en reejecuciones
- 🔄 Hashes de contraseñas precalculados por rol para mantener coherencia entre ejecuciones

## Actualización 3 de noviembre de 2025 - Dominio ia.rpj.es operativo

- 🌐 Proxy inverso configurado (`httpdocs/.htaccess`) para servir el frontend de Next.js en `https://ia.rpj.es` y reenviar `/api` al backend en `127.0.0.1:3001`.
- 🛡️ Middleware CORS del backend (`backend/src/index.js`) ahora acepta dinámicamente `https://ia.rpj.es`, `https://www.ia.rpj.es` y los orígenes definidos en `FRONTEND_URLS`.
- 🔐 Variables de entorno actualizadas en `backend/.env`, `backend/.env.example` y `frontend/.env.local` para reflejar URLs HTTPS y el nuevo flujo de autenticación.
- 🧱 Reconstruido el frontend (`npm run build`), sincronizados los assets con el bundle `standalone` y reiniciados los procesos PM2 (`rpjia-frontend`, `rpjia-backend`) con `--update-env`.
- 🔍 Verificación del bundle resultante (`grep -R "localhost:3001" frontend/.next/standalone`) confirmando la eliminación de referencias a `http://localhost:3001`.
- 📚 Documentación actualizada (`README.md`, `docs/README.md`, `docs/RESUMEN_SESION.md`) con el dominio productivo y los requisitos del proxy Apache.

## Actualización 2 de noviembre de 2025 - Login inicial

- 🖥️ Página principal reemplazada por formulario de acceso minimalista con fondo blanco
- 🧩 Componentes shadcn añadidos (`Input`, `Label`) reutilizables para formularios
- 🔐 Formulario con campos de usuario/contraseña y enlace de recuperación sin lógica todavía

## Actualización 2 de noviembre de 2025 - Script `npm run dev`

- 🧵 Configurado script raíz `npm run dev` que lanza backend y frontend simultáneamente con `concurrently`
- 🧰 Scripts auxiliares `dev:backend` y `dev:frontend` accesibles desde la raíz del proyecto
- 📦 Dependencia de desarrollo `concurrently` añadida al `package.json` raíz

## Actualización 2 de noviembre de 2025 - Servidor ChromaDB dedicado

- 🧱 Creada carpeta de persistencia `database/chroma` con `.gitignore` para almacenar vectores sin versionarlos
- 🐍 Instalado entorno Python local con `pip`, `chromadb==0.4.24` y `pysqlite3-binary` para superar la limitación de sqlite del sistema
- 🚀 Script `backend/scripts/run_chromadb.py` que parchea `sqlite3` y arranca el servidor oficial vía `uvicorn`
- 🔧 Variables en `.env.example`: `CHROMA_PERSIST_PATH` y `CHROMA_TELEMETRY` para configurar ruta de datos y telemetría
- 📒 Documentado flujo de arranque manual: `python3 backend/scripts/run_chromadb.py` (requiere entorno Python con dependencias)

## Actualización 2 de noviembre de 2025 - Orquestación con PM2 y despliegue automatizado

- ⚙️ Definido PM2 como gestor de procesos con `ecosystem.config.js` para backend, frontend y ChromaDB
- 🗂️ Creado script `scripts/deploy.sh` que actualiza, instala dependencias, aplica migraciones, compila frontend y reinicia PM2
- 📦 Añadido `pm2` como dependencia de desarrollo y scripts npm para administrar los procesos (`pm2:start`, `pm2:reload`, `pm2:stop`, `deploy`)
- 📝 El script de despliegue anota automáticamente cada ejecución en `.github/registro.md`
### Despliegue automatizado 2025-11-02 20:52:56
- git pull --rebase
- npm install --prefix backend
- npm install --prefix frontend
- prisma migrate deploy (condicional)
- npm run build --prefix frontend
- npx pm2 start ecosystem.config.js --update-env && npx pm2 save

## Actualización 2 de noviembre de 2025 - Autenticación completa y panel inicial

- 🔐 Cierre del flujo JWT end-to-end: login, validación de sesión y cierre de sesión integrados con el backend (`/api/auth/*`).
- 🌐 Nuevo `AuthProvider` React (`frontend/src/lib/auth-context.tsx`) con persistencia en `localStorage`, refresco automático del perfil y hook `useAuth` reutilizable.
- 🔑 Página de acceso dedicada en `frontend/src/app/auth/login/page.tsx` con feedback de estado, validación y redirección automática tras iniciar sesión.
- 💬 Página principal `frontend/src/app/page.tsx` transformada en un clon inspiracional de ChatGPT para actividades juveniles, accesible solo para usuarios autenticados y con botón de cierre de sesión.
- 🧩 Componentes Shadcn añadidos (`textarea`, `avatar`) para construir la interfaz de chat respetando las directrices de UI establecidas.
- 🔁 Redirecciones gestionadas desde el frontend: usuarios no autenticados se envían a `/auth/login`, mientras que las sesiones válidas se conducen al panel principal inmediatamente.
- 🛠️ Ajuste de metadatos en `frontend/src/app/layout.tsx` para cumplir con la exportación `viewport` de Next.js 14 y eliminar advertencias en el build.

## Actualización 2 de noviembre de 2025 - Sidebar tipo ChatGPT y gestión de chats

- 📁 Logotipo corporativo `logo.png` reubicado en `frontend/public/logo.png` para servirlo desde Next.js.
- 🗂️ Panel lateral inspirando en ChatGPT con modo colapsable por iconos, botón de “Nuevo chat” integrado en el logotipo y listado dinámico de conversaciones.
- 💬 Gestión de conversaciones por usuario en `frontend/src/app/page.tsx`: selector de chat, creación rápida, archivado, eliminación y copia al portapapeles.
- 🎛️ Opciones contextualizadas mediante menú desplegable (`DropdownMenu` Shadcn) y desplazamiento suave (`ScrollArea` Shadcn) para el listado de chats.
- 🙋 Avatar inferior fijo con iniciales del usuario y color corporativo, cumpliendo con el diseño solicitado.
- ⚙️ Menú contextual del avatar con opciones de usuario, chats archivados (limitado a tres), submenú condicional para documentación/administración según rol y acción de salida.
- 🪟 Diálogos modales (`frontend/src/components/ui/dialog.tsx`) para mostrar/editar información del usuario y consultar los chats archivados con avisos de capacidad.

### Despliegue automatizado 2025-11-02 21:11:11
- git pull --rebase
- npm install --prefix backend
- npm install --prefix frontend
- prisma migrate deploy (condicional)
- npm run build --prefix frontend
- npx pm2 start ecosystem.config.js --update-env && npx pm2 save

## Actualización 2 de noviembre de 2025 - Gestión documental vectorial

- 📁 Nuevo modelo Prisma `Documento` con seguimiento de origen, estado de procesamiento, descripción y vínculos vectoriales.
- 📦 Endpoint `/api/documentos` (POST) permite subir PDFs etiquetados, extrae el contenido y lo almacena en MariaDB + ChromaDB; `/api/documentos` (GET) lista la biblioteca; `/api/documentos/etiquetas` expone el catálogo disponible.
- 🧠 Integración opcional con OpenAI (`OPENAI_API_KEY` + `OPENAI_MODEL`) para generar descripciones breves; fallback heurístico cuando no hay clave.
- 🗄️ Archivos físicos almacenados en `backend/storage/documentos` (configurable vía `DOCUMENTS_STORAGE_PATH` y `DOCUMENTS_MAX_SIZE`).
- 🧩 Servicio `chromaService` actualizado para gestionar múltiples colecciones y corregido el log de conexión.
- 💻 Página `/documentacion` rediseñada con carga vía drag & drop, selección de etiquetas, seguimiento de estado y tabla con badges de colores.
- 🪪 Acceso limitado a roles `SUPERADMIN`, `ADMINISTRADOR` y `DOCUMENTADOR`, reutilizando el contexto de autenticación existente.

## Actualización 5 de noviembre de 2025 - Ingesta completa en ChromaDB

- 📄 El procesamiento de subida de PDFs guarda ahora el contenido íntegro en la base vectorial, dividiendo el texto en fragmentos solapados para evitar pérdidas por truncado.
- 🧱 Cada fragmento se almacena con metadatos enriquecidos (`documentoId`, `chunkIndex`, `totalChunks`, `etiquetas`, `nombreOriginal`, tamaño y resumen generado) para facilitar búsquedas semánticas precisas.
- 🧮 Nuevo soporte en `chromaService` para inserciones masivas (`addDocuments`) reutilizado por el flujo documental.
- ⚙️ Variables de entorno añadidas (`CHROMA_DOCUMENT_CHUNK_SIZE`, `CHROMA_DOCUMENT_CHUNK_OVERLAP`) para ajustar tamaño y solapamiento de fragmentos según necesidades del entorno.
- 🗃️ El campo `contenidoExtraido` en MariaDB conserva el texto completo normalizado del PDF, garantizando trazabilidad fuera de Chroma.

### Fase 4: Integración del chat IA (5 nov 2025)
- Implementación completa de la API de chat (`GET/POST/DELETE /api/chat`) con detección de intención y saneado de conversaciones.
- Nuevo módulo de prompts (`backend/src/config/chatPrompts.js`) y servicio LLM con reintentos configurables.
- Logs estructurados con duración, tokens y número de intentos; mensajes de fallback cuando Chutes AI no responde.
- Eliminación de conversaciones desde la UI enlazada al backend; input con estilo corporativo en modo claro/oscuro.
- Suite de pruebas automatizadas (Vitest backend + Vitest E2E frontend) documentada y ejecutada.
- Despliegue actualizado: rebuild del frontend, copia de artefactos standalone y reinicio de PM2.

*Última actualización: 5 de noviembre de 2025 - Integración del chat IA completada*
