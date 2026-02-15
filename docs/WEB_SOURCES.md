# Sistema de Fuentes Web

## Descripción General

El sistema de fuentes web permite al asistente consultar páginas web, dominios completos y sitemaps como fuentes adicionales de información, complementando los documentos PDF ya existentes.

## Características Principales

### Tipos de Fuentes

1. **PAGINA**: Scraping de una URL individual
   - Extrae título, descripción y contenido textual
   - Limpia el HTML y obtiene texto plano
   - Vectoriza el contenido completo

2. **DOMINIO**: Crawling completo de un dominio
   - Sigue enlaces internos del mismo dominio
   - Límite configurable (default: 50 páginas)
   - Evita duplicados y enlaces externos
   - Respeta robots.txt implícitamente

3. **SITEMAP**: Procesamiento de sitemap XML
   - Lee el sitemap XML estándar
   - Procesa todas las URLs listadas
   - Ideal para sitios con sitemaps bien estructurados

### Sistema de Etiquetas

Las fuentes web utilizan el mismo sistema de etiquetas que los documentos PDF:
- PROGRAMACIONES
- DINAMICAS
- CELEBRACIONES
- ORACIONES
- CONSULTA
- PASTORAL_GENERICO
- REVISTAS
- CONTENIDO_MIXTO
- OTROS

## Arquitectura Técnica

### Base de Datos

Modelo `FuenteWeb` en Prisma:

```prisma
model FuenteWeb {
  id                    String                @id @default(uuid())
  usuarioId             String
  usuario               Usuario               @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  url                   String
  dominio               String
  titulo                String?
  descripcion           String?               @db.Text
  etiquetas             Json                  @default("[]")
  tipoFuente            TipoFuenteWeb
  estadoProcesamiento   EstadoProcesamiento   @default(PENDIENTE)
  mensajeError          String?               @db.Text
  fechaProcesamiento    DateTime?
  contenidoExtraido     String?               @db.Text
  vectorDocumentoId     String?
  coleccionVectorial    String?
  activa                Boolean               @default(true)
  fechaCreacion         DateTime              @default(now())
  fechaActualizacion    DateTime              @updatedAt

  @@index([dominio])
  @@index([estadoProcesamiento])
  @@index([activa])
}

enum TipoFuenteWeb {
  PAGINA
  DOMINIO
  SITEMAP
}
```

### Servicio de Scraping

`backend/src/services/webScraperService.js`

**Métodos principales:**

- `fetchUrl(url)`: Descarga HTML con límites de tamaño y timeout
- `extractTextFromHtml(html, url)`: Extrae texto limpio con cheerio
- `extractLinks(html, baseUrl)`: Encuentra enlaces internos
- `scrapePage(url)`: Procesa una página individual
- `scrapeDomain(url, maxPages)`: Crawlea un dominio completo
- `scrapeSitemap(sitemapUrl)`: Procesa sitemap XML

**Límites configurables:**

```env
WEB_SCRAPER_MAX_PAGES=50          # Páginas máximas por dominio
WEB_SCRAPER_MAX_SIZE=5242880      # 5MB tamaño máximo de respuesta
WEB_SCRAPER_USER_AGENT="Mozilla/5.0 (compatible; RPJ-Pastoral-Bot/1.0; +https://ia.rpj.es)"
WEB_SCRAPER_TIMEOUT_MS=30000      # 30 segundos timeout
```

### Vectorización

El contenido extraído se divide en chunks y se vectoriza en ChromaDB:

```env
WEB_CHUNK_SIZE=1500              # Tamaño de cada chunk
WEB_CHUNK_OVERLAP=200            # Overlap entre chunks
WEB_MAX_CHUNKS=200               # Máximo de chunks por fuente
CHROMA_COLLECTION_WEB="rpjia-fuentes-web"
```

**Metadatos almacenados:**

```javascript
{
  tipo: 'fuente_web',
  etiquetas: 'PROGRAMACIONES,DINAMICAS',
  etiquetas_json: '["PROGRAMACIONES","DINAMICAS"]',
  url: 'https://example.com',
  dominio: 'example.com',
  titulo: 'Título de la página',
  fechaRegistro: '2025-11-16T23:00:00.000Z',
  fuenteWebId: 'uuid',
  pagina_url: 'https://example.com/pagina',  // Para DOMINIO/SITEMAP
  pagina_titulo: 'Título específico',        // Para DOMINIO/SITEMAP
  pagina_descripcion: 'Descripción'          // Para DOMINIO/SITEMAP
}
```

### API REST

Endpoints en `/api/fuentes-web`:

1. **GET /api/fuentes-web/etiquetas**
   - Rol requerido: DOCUMENTADOR o DOCUMENTADOR_JUNIOR
   - Retorna lista de etiquetas disponibles

2. **GET /api/fuentes-web**
   - Rol requerido: DOCUMENTADOR o DOCUMENTADOR_JUNIOR
   - Lista todas las fuentes web activas

3. **POST /api/fuentes-web**
   - Rol requerido: DOCUMENTADOR o DOCUMENTADOR_JUNIOR
   - Crea nueva fuente web
   - Body: `{ url, etiquetas, tipoFuente, descripcion }`
   - Inicia procesamiento en background

4. **PATCH /api/fuentes-web/:id**
   - Rol requerido: DOCUMENTADOR
   - Actualiza etiquetas, descripción o estado activo
   - Body: `{ etiquetas?, descripcion?, activa? }`

5. **DELETE /api/fuentes-web/:id**
   - Rol requerido: DOCUMENTADOR
   - Elimina fuente web de BD y ChromaDB

6. **POST /api/fuentes-web/:id/reprocesar**
   - Rol requerido: DOCUMENTADOR
   - Reinicia el procesamiento de una fuente

### Integración con Chat

En `backend/src/routes/chat.js`:

```javascript
// Búsqueda paralela en documentos PDF y fuentes web
const [documentResults, webResults] = await Promise.all([
    chromaService.searchSimilar(message, 3, CHROMA_COLLECTION_DOCUMENTOS, tags),
    chromaService.searchSimilar(message, 2, CHROMA_COLLECTION_WEB, tags),
]);

// Combinar y ordenar por relevancia (distancia vectorial)
const contextResults = [...documentResults, ...webResults]
    .sort((a, b) => (a.distance || 999) - (b.distance || 999))
    .slice(0, 5);
```

El contexto se construye incluyendo:
- Título de la fuente
- Etiquetas asociadas
- Fragmento de contenido (max 1200 caracteres)
- Referencia (URL para fuentes web, nombre de archivo para PDFs)

## Flujo de Procesamiento

1. **Usuario agrega fuente web** vía API POST
2. **Validación inicial**: URL, dominio, tipo de fuente
3. **Creación en BD** con estado `PENDIENTE`
4. **Respuesta inmediata** al usuario
5. **Procesamiento background**:
   - Cambio a estado `PROCESANDO`
   - Scraping según tipo (PAGINA/DOMINIO/SITEMAP)
   - División en chunks (1500 caracteres, overlap 200)
   - Vectorización en ChromaDB colección `rpjia-fuentes-web`
   - Actualización de BD con contenido extraído y estado `COMPLETADO`
6. **En caso de error**:
   - Estado `ERROR`
   - Mensaje de error almacenado
   - Posibilidad de reprocesar

## Casos de Uso

### Agregar una página individual

```bash
POST /api/fuentes-web
{
  "url": "https://www.vatican.va/content/francesco/es/messages/youth.html",
  "tipoFuente": "PAGINA",
  "etiquetas": ["PASTORAL_GENERICO"],
  "descripcion": "Mensajes del Papa a los jóvenes"
}
```

### Crawlear un dominio completo

```bash
POST /api/fuentes-web
{
  "url": "https://www.pastoraluniversitaria.es",
  "tipoFuente": "DOMINIO",
  "etiquetas": ["PASTORAL_GENERICO", "PROGRAMACIONES"],
  "descripcion": "Sitio web de Pastoral Universitaria"
}
```

### Procesar un sitemap

```bash
POST /api/fuentes-web
{
  "url": "https://www.iglesiacatolica.org.es/sitemap.xml",
  "tipoFuente": "SITEMAP",
  "etiquetas": ["CELEBRACIONES", "ORACIONES"],
  "descripcion": "Sitemap de contenido litúrgico"
}
```

## Consideraciones de Rendimiento

- **Rate limiting**: El servicio no implementa rate limiting automático, pero el procesamiento es secuencial
- **Timeout**: 30 segundos por página (configurable)
- **Tamaño máximo**: 5MB por respuesta HTTP (configurable)
- **Límite de páginas**: 50 páginas por dominio (configurable)
- **Procesamiento asíncrono**: No bloquea la respuesta HTTP inicial

## Monitoreo y Debugging

### Logs estructurados

```javascript
console.log(`✅ Fuente web procesada: ${url}`);
console.error(`❌ Error procesando fuente web ${url}:`, error);
console.warn('Error buscando en fuentes web:', error.message);
```

### Estados de procesamiento

- `PENDIENTE`: Fuente creada, esperando procesamiento
- `PROCESANDO`: Scraping y vectorización en curso
- `COMPLETADO`: Procesamiento exitoso, vectorizado en ChromaDB
- `ERROR`: Fallo en el procesamiento, ver `mensajeError`

### Verificación de vectorización

```javascript
// Verificar que la colección existe
await chromaService.getOrCreateCollection('rpjia-fuentes-web');

// Buscar documentos de una fuente específica
const results = await chromaService.searchSimilar(
    'test query',
    10,
    'rpjia-fuentes-web',
    null
);
```

## Seguridad

- **Autenticación**: Todos los endpoints requieren usuario autenticado
- **Autorización**: Roles DOCUMENTADOR y DOCUMENTADOR_JUNIOR para lectura/escritura
- **Validación**: URLs validadas antes de scraping
- **Límites**: Tamaño, timeout y número de páginas limitados
- **User-Agent**: Identificación clara como bot de RPJ
- **Sanitización**: Contenido HTML limpiado y convertido a texto plano

## Mejoras Futuras

### Backend (completado)
- ✅ Modelo de base de datos
- ✅ Servicio de scraping
- ✅ API REST completa
- ✅ Integración con ChromaDB
- ✅ Integración con chat

### Frontend (pendiente)
- ⏳ Página `/fuentes-web` similar a `/documentacion`
- ⏳ Formulario para agregar URLs
- ⏳ Selector de tipo de fuente (radio buttons)
- ⏳ Selector de etiquetas múltiple
- ⏳ Tabla con lista de fuentes
- ⏳ Estados visuales (pendiente, procesando, completado, error)
- ⏳ Botones de editar/eliminar/reprocesar
- ⏳ Filtrado y ordenamiento
- ⏳ Protección de ruta (solo roles DOCUMENTADOR)

### Optimizaciones
- ⏳ Cache de contenido web
- ⏳ Actualización programada de fuentes
- ⏳ Detección de cambios en páginas
- ⏳ Rate limiting inteligente
- ⏳ Paralelización de scraping
- ⏳ Soporte para JavaScript renderizado (puppeteer/playwright)
- ⏳ Respeto explícito de robots.txt
- ⏳ Manejo de redirecciones
- ⏳ Detección de idioma
- ⏳ Extracción de metadatos estructurados (OpenGraph, Schema.org)

## Referencias

- **Cheerio**: https://cheerio.js.org/
- **ChromaDB**: https://docs.trychroma.com/
- **Prisma**: https://www.prisma.io/docs/
- **Web Scraping Best Practices**: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
