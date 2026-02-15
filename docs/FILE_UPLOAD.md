# Funcionalidad de Carga de Archivos

## Descripción
Se ha implementado la funcionalidad de carga de archivos adjuntos en el chat, similar a ChatGPT. Los usuarios pueden adjuntar archivos que se procesarán y utilizarán como contexto adicional para las respuestas del modelo de IA.

## Formatos Soportados
- `.txt` - Archivos de texto plano
- `.md` - Archivos Markdown
- `.json` - Archivos JSON
- `.csv` - Archivos CSV
- `.html` - Archivos HTML

## Límites
- **Tamaño máximo por archivo**: 10 MB
- **Número máximo de archivos**: 5 archivos por mensaje
- **Autenticación**: Requerida (token JWT)

## Componentes Backend

### 1. Servicio de Procesamiento de Archivos
**Archivo**: `backend/src/services/fileProcessorService.js`

**Funciones principales**:
- `processFile(buffer, fileName, mimeType)` - Procesa un archivo y extrae su texto
- `extractTextFromTxt(buffer)` - Extrae texto de archivos TXT/MD
- `extractTextFromJson(buffer)` - Extrae texto de archivos JSON (formateado)
- `extractTextFromHtml(buffer)` - Extrae texto de archivos HTML (sin etiquetas)
- `getSupportedFormats()` - Retorna lista de formatos soportados
- `isFileSupported(mimeType)` - Verifica si un tipo MIME es soportado

**Respuesta del servicio**:
```javascript
{
  success: true,
  fileName: "documento.txt",
  mimeType: "text/plain",
  size: 1024,
  text: "Contenido del archivo...",
  wordCount: 150
}
```

### 2. Rutas de API
**Archivo**: `backend/src/routes/files.js`

#### POST `/api/files/upload`
Sube y procesa archivos.

**Headers**:
- `Authorization`: Bearer token

**Body**: `multipart/form-data`
- `files`: Array de archivos (máximo 5)

**Respuesta exitosa**:
```json
{
  "success": true,
  "files": [
    {
      "fileName": "documento.txt",
      "mimeType": "text/plain",
      "size": 1024,
      "text": "Contenido del archivo...",
      "wordCount": 150
    }
  ],
  "errors": [],
  "message": "Archivos procesados correctamente"
}
```

#### GET `/api/files/supported-formats`
Obtiene la lista de formatos soportados.

**Respuesta**:
```json
{
  "formats": [
    { "extension": ".txt", "mimeType": "text/plain", "description": "Texto plano" },
    { "extension": ".md", "mimeType": "text/markdown", "description": "Markdown" },
    { "extension": ".json", "mimeType": "application/json", "description": "JSON" },
    { "extension": ".csv", "mimeType": "text/csv", "description": "CSV" },
    { "extension": ".html", "mimeType": "text/html", "description": "HTML" }
  ],
  "maxFileSize": "10 MB",
  "maxFiles": 5
}
```

### 3. Integración con Chat
**Archivo**: `backend/src/routes/chat.js`

**Cambios**:
1. Acepta parámetro opcional `attachments` en el body del POST
2. Valida que no excedan 5 archivos
3. Almacena metadatos de archivos adjuntos en el mensaje del usuario
4. Prepend el contenido de los archivos al contexto del prompt:

```
=== ARCHIVOS ADJUNTOS POR EL USUARIO ===

--- Archivo: documento.txt ---
[contenido del archivo]

--- Archivo: notas.md ---
[contenido del archivo]

[contexto de ChromaDB]
```

## Componentes Frontend

### 1. Estado y Referencias
**Archivo**: `frontend/src/app/page.tsx`

**Nuevos estados**:
```typescript
const [attachedFiles, setAttachedFiles] = useState<Array<{
  fileName: string
  mimeType: string
  size: number
  text: string
  wordCount: number
}>>([])
const [isUploadingFiles, setIsUploadingFiles] = useState(false)
const fileInputRef = useRef<HTMLInputElement | null>(null)
```

### 2. Funciones de Manejo

#### `handleFileSelect()`
- Abre un selector de archivos nativo
- Valida que no excedan 5 archivos
- Sube archivos a `/api/files/upload`
- Actualiza el estado `attachedFiles` con los archivos procesados
- Muestra errores si algún archivo falla

#### `handleRemoveFile(fileName)`
- Elimina un archivo de la lista de archivos adjuntos

#### `submitPrompt()` (modificado)
- Incluye `attachments` en el body del POST a `/api/chat`
- Limpia `attachedFiles` después de enviar el mensaje exitosamente

### 3. UI Components

#### Botón Paperclip (Clip)
- **Ubicación**: Barra de botones debajo del textarea
- **Estado**: Habilitado (antes estaba deshabilitado)
- **Tooltip**: "Adjuntar archivos (.txt, .md, .json, .csv, .html)"
- **onClick**: Llama a `handleFileSelect()`
- **Disabled**: Si `isThinking` o `isUploadingFiles` es true

#### Badges de Archivos Adjuntos
- **Ubicación**: Debajo del textarea, antes de la barra de botones
- **Visibilidad**: Solo cuando `attachedFiles.length > 0`
- **Contenido**: 
  - Icono de archivo (FileText)
  - Nombre del archivo (truncado a 200px)
  - Contador de palabras
  - Botón × para eliminar
- **Estilo**: Badge azul con borde

## Flujo de Uso

1. **Usuario selecciona archivos**:
   - Click en botón Paperclip
   - Selecciona uno o más archivos (máx. 5)

2. **Frontend sube archivos**:
   - POST a `/api/files/upload` con FormData
   - Muestra estado de carga (`isUploadingFiles`)

3. **Backend procesa archivos**:
   - Valida tipo MIME y tamaño
   - Extrae texto de cada archivo
   - Retorna array de archivos procesados

4. **Frontend muestra badges**:
   - Badges aparecen debajo del textarea
   - Usuario puede eliminar archivos antes de enviar

5. **Usuario envía mensaje**:
   - Click en botón Send o Enter
   - Frontend incluye `attachments` en request

6. **Backend genera respuesta**:
   - Prepend contenido de archivos al contexto
   - Busca información relevante en ChromaDB
   - Envía todo al modelo LLM
   - Retorna respuesta

7. **Frontend limpia archivos**:
   - Badges desaparecen después de envío exitoso

## Ejemplos de Uso

### Caso 1: Analizar un documento
1. Usuario adjunta `proyecto.txt`
2. Escribe: "Resume los puntos principales de este documento"
3. El modelo recibe el contenido completo del archivo como contexto
4. Genera un resumen basado en el contenido

### Caso 2: Múltiples archivos relacionados
1. Usuario adjunta `datos.csv` y `notas.md`
2. Escribe: "Crea una presentación con estos datos"
3. El modelo recibe ambos archivos como contexto
4. Genera una propuesta integrando información de ambos

### Caso 3: Código o configuración
1. Usuario adjunta `config.json`
2. Escribe: "¿Qué problemas tiene esta configuración?"
3. El modelo analiza el JSON formateado
4. Identifica problemas y sugiere mejoras

## Consideraciones de Seguridad

1. **Autenticación**: Todas las rutas requieren token JWT válido
2. **Validación de tamaño**: Multer rechaza archivos > 10 MB
3. **Validación de tipo**: Solo se aceptan formatos especificados
4. **Sanitización**: El texto HTML se limpia de etiquetas
5. **Límite de archivos**: Máximo 5 por solicitud
6. **Almacenamiento temporal**: Multer usa `memoryStorage` (no persiste en disco)

## Mejoras Futuras

1. **Soporte para más formatos**:
   - PDF (requiere librería pdf-parse)
   - DOCX (requiere mammoth)
   - XLSX (requiere xlsx)

2. **Procesamiento avanzado**:
   - OCR para imágenes escaneadas
   - Extracción de tablas estructuradas
   - Análisis de código con syntax highlighting

3. **Gestión de archivos**:
   - Persistir archivos adjuntos en mensajes
   - Permitir reutilizar archivos en conversación
   - Compartir archivos entre usuarios

4. **UX mejorada**:
   - Vista previa de archivos
   - Drag & drop para adjuntar
   - Progress bar para uploads grandes
   - Preview del texto extraído

## Deployment

Los cambios ya están desplegados en producción:

```bash
# Backend reiniciado con PM2
npx pm2 restart rpjia-backend

# Frontend rebuildeado y reiniciado
cd frontend && npm run build
npx pm2 restart rpjia-frontend
```

**Estado**: ✅ Funcionalidad completamente operativa en producción
