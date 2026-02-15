# 🚀 Estado actual del proyecto (29 nov 2025)

## ✅ COMPLETADO CON ÉXITO

### Sistema de Internacionalización (i18n) - 29 nov 2025
- ✅ **Soporte multiidioma completo**: 10 idiomas disponibles (es, en, fr, it, pt, hu, pl, ca, gl, eu)
- ✅ **Framework next-intl**: Integración con Next.js 14 para traducciones client-side
- ✅ **LocaleContext**: Contexto React para gestión del idioma con persistencia en localStorage
- ✅ **Archivos de traducción**: 10 archivos JSON en `frontend/src/locales/` con ~150 claves cada uno
- ✅ **Selector de idioma**: Dropdown en header y sidebar con banderas/nombres nativos
- ✅ **Página principal traducida**: Chat, sidebar, modales, botones, placeholders
- ✅ **Página /acerca-de traducida**: Contenido completo movido de markdown a JSON (eliminada dependencia de acercade.md)
- ✅ **Página /contacto traducida**: Formulario y mensajes en todos los idiomas
- ✅ **Página /guia-documental traducida**: Tabla, filtros, paginación, tabs
- ✅ **Categorías traducidas**: Nombres de intenciones/categorías en cada idioma
- ✅ **Mensajes del sistema traducidos**: Errores, confirmaciones, placeholders

### Documentación Actualizada
- ✅ `.github/copilot-instructions.md` - Stack: MariaDB + ChromaDB
- ✅ `.github/registro.md` - Fase 2 documentada completamente
- ✅ `GITHUB_SETUP.md` - Instrucciones para configurar remoto
- ✅ `RESUMEN_SESION.md` - Resumen completo de la sesión
- ✅ `README.md` - Información del proyecto
- ✅ `EMAIL_TROUBLESHOOTING.md` - Guía completa de configuración SMTP/DNS

### Código y Configuración
- ✅ Backend operativo en puerto 5000
- ✅ Frontend operativo en puerto 3000
- ✅ ChromaDB operativo en puerto 8000
- ✅ Base de datos MariaDB `rpjia` con 9 tablas (añadido campo `debeCambiarPassword` y `fechaUltimaActualizacion`)
- ✅ API con endpoints de health check y test
- ✅ Orquestación con PM2 (`ecosystem.config.js`) para backend, frontend, ChromaDB y web-updater
- ✅ Servicio de email configurado con Nodemailer (SMTP port 465, SSL)
- ✅ Variables de entorno cargadas con ruta absoluta en index.js
- ✅ **Fix creación espontánea de chats** (18 nov 2025): Resuelto problema de condición de carrera que causaba múltiples chats al login

### UI/UX Mejorado (15 nov 2025)
- ✅ **Tipografía moderna**: Fuente Inter con pesos 300-700 (similar a Notion/ChatGPT)
- ✅ **Sidebar optimizado**: Ancho compacto w-80 (320px)
- ✅ **Límite de caracteres**: Títulos truncados a 25 caracteres
- ✅ **Botones de opciones**: Diseño compacto y visible en hover
- ✅ **Layout simplificado**: Estructura de una sola línea con justify-between
- ✅ **Renderizado markdown**: react-markdown para formato de mensajes del asistente
- ✅ **Respuestas completas**: Límite de tokens aumentado a 128,000
- ✅ **Scroll nativo**: Página de documentación usa scroll del navegador
- ✅ **Sistema de intenciones**: 5 categorías con prompts especializados y filtrado por tags
- ✅ **Modelo LLM**: Kimi-K2-Instruct-0905 (Moonshot AI) vía Chutes AI

### Gestión Documental Avanzada (15 nov 2025)
- ✅ **9 etiquetas disponibles**: Programaciones, Dinámicas, Celebraciones, Oraciones, Consulta, Pastoral Genérico, Revistas, Contenido Mixto, Otros
- ✅ **Búsqueda contextual**: Filtrado en tiempo real por título, nombre y descripción (sin acentos)
- ✅ **Filtro por etiquetas**: Selector múltiple con badges activos
- ✅ **Ordenamiento**: Por fecha de subida (ascendente/descendente)
- ✅ **Edición inline**: Modificar etiquetas de documentos con actualización en BD y ChromaDB
- ✅ **Eliminación segura**: Confirmación inline, elimina de BD, ChromaDB y sistema de archivos

### Descarga de Documentos (15 nov 2025)
- ✅ **Formato PDF**: Generación con jsPDF incluyendo logo RPJ (150px), parsing avanzado de markdown con agrupación de listas, limpieza de sintaxis markdown, renderizado de headers (16pt/14pt/12pt), listas con bullets/números, bloques de código con fondo gris y paginación automática
- ✅ **Formato Word**: Generación con HTML + Microsoft Office XML namespace, BOM UTF-8, logo RPJ embebido como base64 (150px), estilos en puntos (pt) para compatibilidad, encoding correcto de caracteres especiales (á, é, í, ó, ú, ñ, ¿, ¡)
- ✅ **UI de descarga**: Dropdown menu en mensajes del asistente con opciones PDF y Word
- ✅ **Nomenclatura**: Archivos nombrados como `respuesta-{messageId}.pdf` o `.doc`

### Interfaz y Navegación (15 nov 2025)
- ✅ **Badges de categorías coloreados**: Sistema de colores distintivos para cada categoría (Dinámicas, Celebraciones, Programaciones, Oraciones, Pastoral, Consulta, Otros) visibles tanto en modo oscuro como claro
- ✅ **Página "Acerca de"**: Nueva página informativa (`/acerca-de`) con logo RPJ centrado, diseño atractivo con degradados, títulos grandes y espaciado generoso, enlaces con iconos externos y efecto hover, renderizado markdown del contenido de `acercade.md`
- ✅ **Navegación mejorada**: Enlace "Acerca de" en header principal alineado a la izquierda, botón "Volver al chat" en páginas secundarias

### Sistema de Gestión de Usuarios con Emails (16 nov 2025)
- ✅ **Servicio de email**: Nodemailer 6.9.7 con SMTP (ia.rpj.es:465, SSL/TLS)
- ✅ **Generación de contraseñas**: Algoritmo seguro de 12 caracteres (uppercase, lowercase, números, símbolos)
- ✅ **Templates HTML premium**: Email de bienvenida con logo RPJ embebido (base64), diseño responsive, gradientes corporativos
- ✅ **Campo debeCambiarPassword**: Migración Prisma añadiendo Boolean default false
- ✅ **API endpoints nuevos**:
  - POST /api/password/change - Cambio de contraseña con validación
  - GET /api/password/must-change - Verificación de flag
  - POST /api/auth/users (modificado) - Auto-generación y envío de email
- ✅ **ChangePasswordModal**: Componente React bloqueante con validación en tiempo real, show/hide toggles, tips de seguridad
- ✅ **Admin UI mejorado**: Checkboxes para auto-generar contraseña y enviar email (defaults: true)
- ✅ **Auth context extendido**: Estado mustChangePassword y función clearPasswordChangeFlag
- ✅ **Flujo completo**: Creación → Email → Login → Modal obligatorio → Cambio → Acceso
- ✅ **SMTP configurado**: Puerto 465 con secure=true, autenticación exitosa
- ✅ **DKIM activado**: Firma de mensajes salientes habilitada en Plesk
- ⏳ **Pendiente DNS**: Registros MX necesarios para entrega de emails (en gestión externa)

### Restricciones Temáticas y Uso de RAG (16 nov 2025)
- ✅ **Restricción temática estricta**: El asistente SOLO responde preguntas sobre pastoral juvenil, religión católica y temas relacionados
- ✅ **Mensaje de rechazo amable**: Preguntas fuera de tema reciben respuesta educada explicando la especialización del asistente
- ✅ **Uso flexible de documentación RAG**: La documentación vectorial es prioritaria pero NO exclusiva
- ✅ **Conocimiento del modelo**: Si no hay suficiente documentación, el modelo puede usar su entrenamiento sobre pastoral y religión católica
- ✅ **Aplicado a todas las intenciones**: DINAMICA, CELEBRACION, PROGRAMACION, ORACION y OTROS incluyen ambas directrices
- ✅ **Prompts actualizados**: Sistema de prompts en `backend/src/config/chatPrompts.js` con secciones claras de restricción temática y uso de documentación

### Sistema de Fuentes Web (17 nov 2025)
- ✅ **Modelo FuenteWeb**: Tabla en base de datos con campos para URL, dominio, título, descripción, etiquetas, tipo de fuente, estado de procesamiento, contenido extraído y fechaUltimaActualizacion
- ✅ **Tipos de fuente**: PAGINA (URL individual), DOMINIO (crawling completo hasta 50 páginas), SITEMAP (procesamiento de XML sitemap)
- ✅ **Servicio de scraping**: `webScraperService.js` con cheerio para extracción de HTML, límites configurables, timeout de 30 segundos, tamaño máximo 5MB, filtrado de contenidos no-HTML (PDFs, imágenes, audio)
- ✅ **API REST completa**: Endpoints CRUD en `/api/fuentes-web` (GET etiquetas, GET listar, POST agregar, PATCH actualizar, DELETE eliminar, POST reprocesar)
- ✅ **Vectorización corregida**: Corrección crítica del formato de entries para `chromaService.addDocuments()` - ahora usa formato `[{id, document, metadata}]` en lugar de parámetros separados
- ✅ **Helper convertToChromaEntries**: Función auxiliar para convertir chunks, metadatas e IDs al formato correcto de ChromaDB
- ✅ **Integración con chat**: Búsqueda paralela en documentos PDF y fuentes web, combinación por relevancia (distancia vectorial), contexto enriquecido con URLs de origen
- ✅ **Procesamiento en background**: Scraping y vectorización no bloquean la respuesta HTTP, actualización de estado en BD
- ✅ **Logs detallados**: Mensajes "✅ Vectorizados X chunks de URL" para cada página procesada, logs de error si addDocuments falla
- ✅ **Colección ChromaDB**: 56 documentos vectorizados en `rpjia-fuentes-web` (30 páginas del dominio escolapiosemaus.org, 1 página de pastoralbetania.org)
- ✅ **Búsqueda semántica verificada**: Queries como "escolapios" devuelven resultados relevantes con URLs de origen
- ✅ **Script de reprocesamiento**: `backend/reprocesar_fuentes_web.js` para vectorizar fuentes existentes que no fueron procesadas correctamente
- ✅ **UI completa**: Interfaz de administración integrada en página de documentación con selector de tipo de fuente (radio buttons negros), tabla de fuentes con edición/eliminación, confirmación inline para borrado
- ✅ **Tema consistente**: Iconos y controles en negro/blanco siguiendo el esquema de color de la aplicación
- ✅ **Actualización automática 24h**: Sistema cron que re-scrapea fuentes diariamente a las 2 AM, detecta contenido nuevo y lo añade incrementalmente a ChromaDB sin duplicar
- ✅ **Migración BD**: Campo `fechaUltimaActualizacion` añadido para tracking de última actualización
- ✅ **Job automático**: `backend/jobs/actualizarFuentesWeb.js` ejecutado por PM2 (proceso `rpjia-web-updater`) con cron `0 2 * * *`
- ✅ **Actualización incremental**: Compara contenido actual vs contenido extraído anterior, solo vectoriza diferencias, usa IDs únicos con timestamp para evitar duplicados
- ✅ **Dependencia cheerio**: Versión 1.0.0-rc.12 instalada para parsing HTML avanzado
- ✅ **Variables de entorno**: WEB_SCRAPER_MAX_PAGES, WEB_SCRAPER_MAX_SIZE, WEB_SCRAPER_USER_AGENT, WEB_SCRAPER_TIMEOUT_MS, WEB_CHUNK_SIZE, WEB_CHUNK_OVERLAP, WEB_MAX_CHUNKS, CHROMA_COLLECTION_WEB

## Panorama general

- Plataforma conversacional operativa en producción (`https://ia.rpj.es`)
- Backend Express + Prisma conectado a MariaDB y ChromaDB con historial de conversaciones persistente
- Integración con Chutes AI (`POST /api/chat`) que incluye detección de intención, contexto documental dinámico y mensajes de fallback cuando la IA no responde
- Observabilidad reforzada con logs estructurados, métricas básicas de tokens/duración y reintentos configurables
- Suites de pruebas activas: Vitest (backend) y Vitest + Testing Library (frontend E2E)
- Despliegue orquestado con PM2 y script `scripts/deploy.sh` actualizado

## Hitos recientes

1. **API de chat completa**
   - Rutas REST (`GET /api/chat`, `GET /api/chat/:id`, `POST /api/chat`, `DELETE /api/chat/:id`)
   - Conversaciones ligadas al usuario con saneado de títulos y timestamps
   - Registro de metadatos (tokens, intentos, contexto documental utilizado)

2. **Prompts e intenciones centralizadas** en `backend/src/config/chatPrompts.js` (DINAMICA, ORACION, PROGRAMACION, CELEBRACION, OTROS)

3. **Servicio LLM robusto** (`backend/src/services/llmService.js`) con AbortController, reintentos y gestión de errores

4. **Integración Chroma** mejorada (`backend/src/services/chromaService.js`) con fallback si el servicio no está disponible

5. **Sistema de fuentes web completo** (17 nov 2025):
   - Scraping de páginas individuales, dominios completos y sitemaps XML
   - Vectorización automática en ChromaDB con corrección crítica de formato
   - Actualización automática cada 24 horas con cron job
   - UI de administración integrada con tema consistente
   - Búsqueda semántica funcional verificada

6. **Experiencia de usuario afinada**: 
   - Tipografía Inter sans-serif moderna
   - Sidebar compacto con límite de 25 caracteres en títulos
   - Input con estilo corporativo
   - Eliminación de chats desde la interfaz
   - Feedback visual mejorado
   - **Renderizado markdown** en mensajes del asistente (negrita, listas, código)
   - **Respuestas completas** sin cortes (límite 128K tokens)
   - **Scroll optimizado** en página de documentación

7. **Sistema de gestión de usuarios con emails** (16 nov 2025):
   - Servicio completo de email con Nodemailer y templates HTML premium
   - Generación automática de contraseñas seguras
   - Campo debeCambiarPassword en base de datos
   - Modal de cambio obligatorio en primer login
   - Panel de administración con opciones de auto-generación
   - SMTP configurado y DKIM activado

8. **Sistema de internacionalización** (29 nov 2025):
   - Framework next-intl integrado con Next.js 14
   - 10 idiomas: español, inglés, francés, italiano, portugués, húngaro, polaco, catalán, gallego, euskera
   - LocaleContext con persistencia en localStorage
   - Selector de idioma en header y sidebar con banderas
   - Todas las páginas traducidas (chat, acerca-de, contacto, guía documental)
   - ~150 claves de traducción por idioma

9. **Documentación y tareas** sincronizadas (`docs/task.md`, `.github/registro.md`)

## Stack actualizado

```
Backend   : Node.js 24, Express 4, Prisma 5, Vitest 1, Nodemailer 6.9.7, Cheerio 1.0.0-rc.12
Frontend  : Next.js 14, React 18, Tailwind, Shadcn/ui, Vitest + Testing Library, next-intl
Tipografía: Inter (Google Fonts) - Sans-serif moderna
Markdown  : react-markdown + remark-gfm para renderizado de contenido
i18n      : next-intl con 10 idiomas (es, en, fr, it, pt, hu, pl, ca, gl, eu)
Persistencia: MariaDB (prisma), ChromaDB (vectores persistidos en database/chroma)
Email     : SMTP ia.rpj.es:465 SSL, DKIM, templates HTML responsive
Infraestructura: PM2 (backend, frontend, chroma, web-updater) + proxy Apache
IA        : Chutes AI (https://llm.chutes.ai/v1/chat/completions)
Modelo    : Kimi-K2-Instruct-0905 (Moonshot AI)
Max tokens: 128,000 (128K)
Intenciones: 5 categorías con prompts especializados y filtrado por tags ChromaDB
Etiquetas : 9 opciones para clasificación documental
Web Scraping: Cheerio para HTML, 50 páginas/dominio, chunks 1500 chars, overlap 200
Cron Jobs : Actualización automática de fuentes web cada 24h (2 AM)
```

## API pública (resumen)

| Método | Endpoint | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado de servicios (MariaDB & Chroma) |
| GET | `/api/info` | Metadatos de la API y rutas disponibles |
| POST | `/api/test-db` | Inserción de prueba en MariaDB |
| POST | `/api/auth/login` | Autenticación (JWT) |
| GET | `/api/documentos` | Repositorio documental |
| POST | `/api/documentos` | Subida y vectorización de documentos |
| PATCH | `/api/documentos/:id` | Actualizar etiquetas de un documento |
| DELETE | `/api/documentos/:id` | Eliminar documento (BD, ChromaDB y archivo) |
| GET | `/api/documentos/etiquetas` | Obtener etiquetas disponibles |
| GET | `/api/fuentes-web` | Listar fuentes web del usuario |
| GET | `/api/fuentes-web/etiquetas` | Obtener etiquetas para fuentes web |
| POST | `/api/fuentes-web` | Agregar fuente web (scrapea y vectoriza en background) |
| PATCH | `/api/fuentes-web/:id` | Actualizar etiquetas/descripción de fuente web |
| DELETE | `/api/fuentes-web/:id` | Eliminar fuente web (BD, ChromaDB) |
| POST | `/api/fuentes-web/:id/reprocesar` | Re-scrapear y re-vectorizar fuente web |
| GET | `/api/chat` | Listado de conversaciones del usuario |
| GET | `/api/chat/:id` | Recuperar mensajes ordenados |
| POST | `/api/chat` | Enviar mensaje al asistente (Chutes AI) |
| DELETE | `/api/chat/:id` | Eliminar conversación + mensajes |
| POST | `/api/password/change` | Cambiar contraseña |
| GET | `/api/password/must-change` | Verificar si debe cambiar contraseña |

> Los prompts de sistema y palabras clave para detección de intención están documentados en `backend/src/config/chatPrompts.js`.

## Testing & QA

- `npm run test --prefix backend`: Pruebas unitarias (prompts, servicio LLM, Chroma fallback) usando Vitest.
- `npm run test:e2e --prefix frontend`: Flujo de login validado con Vitest + Testing Library (jsdom).
- Cobertura manual: Eliminación de conversaciones, fallback IA y logs verificados en PM2.

## Despliegue

1. `npm run build --prefix frontend`
2. Copia de artefactos a `frontend/.next/standalone` (automático en `scripts/deploy.sh`).
3. `scripts/deploy.sh` ejecuta pull, dependencias, migraciones Prisma, build y `pm2 start --update-env`.
4. Reinicios puntuales: `pm2 restart rpjia-backend` / `pm2 restart rpjia-frontend` / `pm2 restart rpjia-chromadb` / `pm2 restart rpjia-web-updater`.
5. **PM2 ecosystem**: 4 procesos gestionados:
   - `rpjia-backend` (puerto 5000)
   - `rpjia-frontend` (puerto 3000)
   - `rpjia-chromadb` (puerto 8000)
   - `rpjia-web-updater` (cron: `0 2 * * *`)
6. **Persistencia PM2**: `pm2 save` para guardar configuración, `pm2 startup` para auto-inicio tras reinicio del VPS.

## Bases de Datos

### MariaDB
- Host: 127.0.0.1:3306
- Database: rpjia
- User: sa
- Status: ✅ OPERATIVA
- Tablas: 9 (Usuario, Conversacion, Mensaje, Documento, FuenteWeb, etc.)

### ChromaDB
- Modo: Servidor dedicado (puerto 8000)
- Colecciones: `rpjia-actividades`, `rpjia-documentos`, `rpjia-fuentes-web`
- Status: ✅ OPERATIVO
- Documentos vectorizados: 56 en `rpjia-fuentes-web`

## Métricas

- Commits totales: **40+**
- Últimos relevantes: 
  - `aa87575` - Fix página /acerca-de totalmente traducida (29 nov 2025)
  - `23c7231` - Traducir páginas secundarias (29 nov 2025)
  - `b8080e7` - Implementar soporte multiidioma 10 idiomas (29 nov 2025)
  - `f997d91` - Sistema automático actualización fuentes web 24h (17 nov 2025)
- Cambios recientes: Sistema i18n completo con 10 idiomas

## Próximos pasos

1. Monitoreo de actualizaciones automáticas (verificar logs de cron job)
2. Extender pruebas E2E para cubrir el ciclo completo del chat y el módulo de documentación
3. Añadir seeds para disponer de conversaciones y documentos de ejemplo en entornos nuevos
4. Exponer métricas en dashboards (Prometheus/Grafana) reutilizando los logs estructurados
5. Evaluar respuestas en streaming desde Chutes para mejorar la experiencia

## Referencias rápidas

- Prompts e intenciones: `backend/src/config/chatPrompts.js`
- Servicio LLM con reintentos: `backend/src/services/llmService.js`
- Servicio vectorial: `backend/src/services/chromaService.js`
- Servicio scraping: `backend/src/services/webScraperService.js`
- Job actualización web: `backend/jobs/actualizarFuentesWeb.js`
- Rutas API: `backend/src/routes/*.js`
- Pruebas: `backend/tests/*.test.js`, `frontend/tests/auth-login.e2e.test.tsx`
- Deploy: `scripts/deploy.sh`, `ecosystem.config.js`

## Estructura del proyecto

```
httpdocs/
├── .github/          (Documentación)
├── .vscode/          (Configuración VS Code)
├── backend/          (API Node.js)
│   ├── src/
│   │   ├── index.js
│   │   ├── config/
│   │   │   └── chatPrompts.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── chat.js
│   │   │   ├── documentos.js
│   │   │   ├── fuentesWeb.js
│   │   │   └── password.js
│   │   └── services/
│   │       ├── chromaService.js
│   │       ├── emailService.js
│   │       ├── llmService.js
│   │       └── webScraperService.js
│   ├── jobs/
│   │   └── actualizarFuentesWeb.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   ├── scripts/
│   │   └── run_chromadb.py
│   ├── storage/
│   │   └── documentos/
│   ├── tests/
│   └── package.json
├── frontend/         (Next.js App)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── acerca-de/
│   │   │   ├── administracion/
│   │   │   └── documentacion/
│   │   ├── components/
│   │   │   ├── change-password-modal.tsx
│   │   │   ├── web-sources-table.tsx
│   │   │   └── ...
│   │   └── lib/
│   ├── public/
│   │   └── acercade.md
│   ├── tests/
│   └── package.json
├── database/
│   └── chroma/
├── docs/
│   ├── DEPLOYMENT.md
│   ├── EMAIL_TROUBLESHOOTING.md
│   ├── ESTADO_FINAL.md
│   ├── GITHUB_SETUP.md
│   └── README.md
├── scripts/
│   └── deploy.sh
└── ecosystem.config.js
```

## 🎯 PUNTOS DE RESTAURACIÓN

### Checkpoint actual (v1.15.0-i18n-complete)
- Tag: `v1.15.0-i18n-complete`
- Commit: `aa87575`
- Descripción: Sistema de internacionalización completo con 10 idiomas
- Fecha: 2025-11-29
- Incluye:
  - Soporte multiidioma (es, en, fr, it, pt, hu, pl, ca, gl, eu)
  - Todas las páginas traducidas (chat, acerca-de, contacto, guía documental)
  - Selector de idioma en header y sidebar
  - ~1500 claves de traducción totales

### Checkpoints anteriores
- Tag: `v1.14.0-i18n` - Implementación inicial i18n (29 nov 2025)
- Tag: `v1.13.0-pre-i18n` - Estado pre-internacionalización (18 nov 2025)
- Tag: `checkpoint-20251117-013227` - Sistema fuentes web automático (17 nov 2025)

Para restaurar:
```bash
git checkout v1.15.0-i18n-complete
# o cualquier tag anterior
git checkout v1.14.0-i18n
git checkout v1.13.0-pre-i18n
```

---

**Estado**: ✅ PLATAFORMA FUNCIONANDO EN PRODUCCIÓN CON SISTEMA MULTIIDIOMA COMPLETO

**Fecha de actualización**: 29 de Noviembre de 2025  
**Próxima acción**: Añadir más idiomas según demanda de usuarios
