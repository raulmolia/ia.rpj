# Sistema de Filtrado por Etiquetas en el Chat

## Descripción General

El asistente ahora permite delimitar la búsqueda en la base vectorial mediante la selección de categorías/etiquetas a través del botón "+" en el chat. Cuando el usuario selecciona una o más categorías, el LLM buscará **únicamente** en los documentos que tengan esas etiquetas específicas.

## Etiquetas Disponibles

Las siguientes categorías están disponibles para filtrar la búsqueda:

| Categoría | Etiqueta Técnica | Descripción |
|-----------|------------------|-------------|
| **Dinámicas y Actividades** | `DINAMICAS` | Juegos, actividades grupales, icebreakers |
| **Celebraciones** | `CELEBRACIONES` | Liturgias, eucaristías, celebraciones especiales |
| **Programaciones** | `PROGRAMACIONES` | Planificaciones de actividades, campamentos, encuentros |
| **Oraciones** | `ORACIONES` | Reflexiones, momentos de oración, textos espirituales |
| **Otros** | `OTROS`, `CONTENIDO_MIXTO` | Material general y documentos con contenido mixto |

Además, existen etiquetas adicionales que se pueden asignar a documentos:
- `CONSULTA`: Material de referencia general
- `PASTORAL_GENERICO`: Contenido pastoral sin categoría específica
- `REVISTAS`: Publicaciones periódicas, boletines

## Flujo de Funcionamiento

### 1. Interfaz de Usuario (Frontend)

**Ubicación del Botón "+":**
- Aparece en el compositor de mensajes (tanto en la versión inferior como central)
- Al hacer clic, se despliega un menú con las categorías disponibles

**Selección de Categorías:**
```typescript
// El usuario puede seleccionar una o más categorías
// Cada categoría tiene asociadas sus etiquetas
const quickPrompts = [
    {
        label: "Dinámicas y Actividades",
        icon: Activity,
        intent: "DINAMICA",
        tags: ["DINAMICAS"],
    },
    {
        label: "Celebraciones",
        icon: PartyPopper,
        intent: "CELEBRACION",
        tags: ["CELEBRACIONES"],
    },
    // ... más categorías
]
```

**Visualización:**
- Las categorías seleccionadas aparecen como badges de colores encima del área de texto
- Cada categoría tiene un color distintivo:
  - 🟢 Dinámicas: Verde esmeralda
  - 💗 Celebraciones: Rosa
  - 🔵 Programaciones: Azul
  - 🟣 Oraciones: Violeta
  - 🟡 Pastoral: Ámbar
  - 🔷 Consulta: Cian
  - ⚫ Otros: Gris

### 2. Envío al Backend

Cuando el usuario envía un mensaje con categorías seleccionadas:

```javascript
// Frontend envía los tags al backend
const response = await fetch(buildApiUrl("/api/chat"), {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
        conversationId: previousConversationId,
        message: prompt,
        intent: intentToSend,
        tags: tagsToSend, // Array de etiquetas: ["DINAMICAS", "CELEBRACIONES"]
    }),
})
```

**Lógica de Tags:**
- Si el usuario selecciona múltiples categorías, se recopilan **todos los tags únicos**
- Se eliminan duplicados usando `Set`
- Si no hay categorías seleccionadas, se usa el comportamiento por defecto del intent

### 3. Procesamiento en el Backend

**Recepción de Tags:**
```javascript
router.post('/', authenticate, async (req, res) => {
    const { message, conversationId, intent: rawIntent, tags: clientTags } = req.body || {};
    // ...
})
```

**Priorización:**
```javascript
// Los tags del cliente tienen prioridad sobre los del intent
const tagsToSearch = (clientTags && Array.isArray(clientTags) && clientTags.length > 0)
    ? clientTags
    : (detectedIntent?.tags || null);
```

### 4. Búsqueda en ChromaDB

**Filtrado por Etiquetas:**
```javascript
// chromaService.js
async searchSimilar(query, limit = 5, collectionName = null, tags = null) {
    // ...
    
    // Construir filtro para ChromaDB
    if (tags && Array.isArray(tags) && tags.length > 0) {
        const tagFilters = tags.map(tag => ({ 
            etiquetas: { $contains: tag } 
        }));
        
        // Un solo tag: filtro simple
        // Múltiples tags: usar $or (busca documentos con cualquiera de los tags)
        queryParams.where = tags.length === 1 
            ? tagFilters[0] 
            : { $or: tagFilters };
    }
    
    const result = await targetCollection.query(queryParams);
}
```

**Sintaxis de ChromaDB:**
- **Un tag:** `{ etiquetas: { $contains: "DINAMICAS" } }`
- **Múltiples tags:** `{ $or: [{ etiquetas: { $contains: "DINAMICAS" }}, { etiquetas: { $contains: "CELEBRACIONES" }}] }`

## Ejemplos de Uso

### Ejemplo 1: Una Sola Categoría

**Usuario selecciona:** `Dinámicas y Actividades`

**Request enviado:**
```json
{
    "message": "Necesito una actividad para romper el hielo",
    "intent": "DINAMICA",
    "tags": ["DINAMICAS"]
}
```

**Búsqueda en ChromaDB:**
- Solo busca en documentos con etiqueta `DINAMICAS`
- Ignora documentos con otras etiquetas (CELEBRACIONES, PROGRAMACIONES, etc.)

### Ejemplo 2: Múltiples Categorías

**Usuario selecciona:** `Celebraciones` + `Oraciones`

**Request enviado:**
```json
{
    "message": "Necesito una celebración con oraciones para jóvenes",
    "intent": "CELEBRACION",
    "tags": ["CELEBRACIONES", "ORACIONES"]
}
```

**Búsqueda en ChromaDB:**
- Busca en documentos con etiqueta `CELEBRACIONES` **O** `ORACIONES`
- Devuelve documentos que tengan al menos una de estas etiquetas

### Ejemplo 3: Sin Categorías Seleccionadas

**Usuario no selecciona nada**

**Request enviado:**
```json
{
    "message": "Necesito ayuda con una actividad",
    "intent": "OTROS"
}
```

**Búsqueda en ChromaDB:**
- Usa las etiquetas por defecto del intent `OTROS`
- Busca en: `["OTROS", "CONTENIDO_MIXTO", "CONSULTA", "PASTORAL_GENERICO", "REVISTAS"]`

## Beneficios del Sistema

1. **Búsquedas Más Precisas**: El LLM encuentra contenido más relevante al limitar el scope
2. **Resultados Más Rápidos**: Menos documentos que procesar = respuestas más rápidas
3. **Mejor UX**: El usuario tiene control sobre qué tipo de contenido quiere consultar
4. **Menos Ruido**: Evita que se mezclen documentos de categorías no relacionadas
5. **Flexibilidad**: Permite combinar múltiples categorías según la necesidad

## Prompts del Sistema Actualizados

Cada intent ahora incluye información sobre el filtrado de etiquetas en su system prompt:

```javascript
systemPrompt: `Eres un asistente experto en animación juvenil.
// ...

Cuando respondas, consultas automáticamente la base de conocimiento vectorial buscando documentos
etiquetados como "DINAMICAS" (juegos, actividades grupales, icebreakers). Usa esta información
para enriquecer tus respuestas con ejemplos y contenido específico de la organización.

// ...`
```

Esto hace que el LLM sea consciente de:
- Qué etiquetas está consultando
- Qué tipo de contenido contienen esas etiquetas
- Cómo usar ese contenido para mejorar sus respuestas

## Archivos Modificados

### Frontend
- `frontend/src/app/page.tsx`:
  - Modificado para recopilar tags de los quickPrompts seleccionados
  - Envía array de tags al backend en el request

### Backend
- `backend/src/routes/chat.js`:
  - Acepta parámetro `tags` en el request
  - Prioriza tags del cliente sobre tags del intent
  - Pasa tags al servicio de ChromaDB

- `backend/src/services/chromaService.js`:
  - Ya tenía soporte para filtrado por tags
  - Usa sintaxis `$or` para múltiples tags
  - Usa `$contains` para buscar en arrays de etiquetas

- `backend/src/config/chatPrompts.js`:
  - Añadida documentación de etiquetas en `DOCUMENT_TAGS`
  - Actualizados system prompts para mencionar el filtrado
  - Expandidos tags en el intent `OTROS`

## Notas Técnicas

### Estructura de Metadata en ChromaDB

Los documentos en ChromaDB tienen este formato:
```javascript
{
    id: "uuid-documento",
    document: "Contenido del chunk...",
    metadata: {
        titulo: "Nombre del documento",
        source: "documento-original.pdf",
        etiquetas: ["DINAMICAS", "CELEBRACIONES"], // Array de strings
        // ... otros campos
    }
}
```

### Operador $contains de ChromaDB

ChromaDB usa `$contains` para buscar en arrays:
- `{ etiquetas: { $contains: "DINAMICAS" } }` → encuentra documentos donde el array `etiquetas` contiene el string "DINAMICAS"
- Funciona con arrays de cualquier longitud
- Case-sensitive (debe coincidir exactamente)

### Operador $or de ChromaDB

Para múltiples condiciones:
```javascript
{
    $or: [
        { etiquetas: { $contains: "DINAMICAS" }},
        { etiquetas: { $contains: "CELEBRACIONES" }}
    ]
}
```
- Devuelve documentos que cumplan **al menos una** condición
- Equivalente a un OR lógico

## Testing

Para probar el filtrado:

1. **Crear documentos con etiquetas diferentes** en `/documentacion`
2. **Iniciar un chat** y hacer clic en el botón "+"
3. **Seleccionar una categoría** (ej: Dinámicas)
4. **Escribir un mensaje** genérico (ej: "dame ejemplos")
5. **Verificar que el LLM solo use** documentos con esa etiqueta

Puedes verificar los logs del backend para ver la consulta a ChromaDB:
```bash
npx pm2 logs rpjia-backend --lines 50
```

## Futuras Mejoras

Posibles mejoras al sistema:

1. **Operador AND**: Permitir buscar documentos que tengan TODAS las etiquetas seleccionadas
2. **Exclusión de Tags**: Permitir excluir etiquetas específicas de la búsqueda
3. **Tags Personalizados**: Permitir al usuario crear tags temporales para una sesión
4. **Memoria de Preferencias**: Recordar las categorías favoritas del usuario
5. **Sugerencia Automática**: Sugerir categorías basándose en el contenido del mensaje
