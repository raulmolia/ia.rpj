# Restricciones Temáticas y Uso de RAG

## Fecha de implementación: 16 de noviembre de 2025

## 📋 Resumen

El asistente IA para actividades juveniles ha sido configurado con dos directrices fundamentales en sus prompts de sistema:

1. **Restricción temática estricta**: Solo responde preguntas relacionadas con pastoral juvenil, religión católica y temas afines
2. **Uso flexible de documentación RAG**: Prioriza la base vectorial pero permite usar conocimiento del modelo cuando sea necesario

---

## 🎯 1. Restricción Temática

### Temas permitidos

El asistente **SOLO** responde preguntas sobre:
- Pastoral juvenil y animación de grupos
- Religión católica, fe cristiana y espiritualidad
- Liturgia, sacramentos y celebraciones católicas
- Educación en valores cristianos
- Actividades, dinámicas y programaciones para jóvenes en contextos pastorales
- Organización y gestión de grupos juveniles en contextos pastorales
- Temas directamente relacionados con la documentación disponible en la base vectorial

### Temas rechazados

Cualquier pregunta **NO relacionada** con los temas anteriores será rechazada amablemente, por ejemplo:
- Política
- Deportes (salvo dinámicas deportivas en contexto pastoral)
- Tecnología general (salvo herramientas para pastoral)
- Entretenimiento general
- Ciencia, matemáticas, historia (salvo historia de la Iglesia)
- Cocina, viajes, moda, etc.

### Mensaje de rechazo

Cuando el usuario pregunta sobre un tema fuera del alcance, el asistente responde:

> "Lo siento, soy un asistente especializado en pastoral juvenil y religión católica. Solo puedo ayudarte con temas relacionados con animación de grupos, fe cristiana, actividades pastorales y espiritualidad juvenil. ¿Hay algo en estos temas en lo que pueda ayudarte?"

---

## 📚 2. Uso Flexible de Documentación RAG

### Prioridad: Documentación vectorial

La base de conocimiento vectorial (ChromaDB) es la **fuente prioritaria** del asistente:

- Contiene documentos específicos de la organización
- Está categorizada con 9 etiquetas (PROGRAMACIONES, DINAMICAS, CELEBRACIONES, ORACIONES, etc.)
- Proporciona ejemplos reales y contexto específico
- Se consulta automáticamente según la intención detectada

### Flexibilidad: Conocimiento del modelo

Si la documentación disponible **NO es suficiente** para responder:

✅ **El asistente PUEDE usar su conocimiento de entrenamiento** sobre:
- Pastoral juvenil
- Religión católica
- Espiritualidad cristiana
- Pedagogía y educación en la fe
- Dinámicas y actividades grupales
- Liturgia y celebraciones

❌ **El asistente NO puede:**
- Inventar documentación que no existe
- Citar fuentes falsas
- Afirmar que la información viene de la base vectorial si no es así

### Transparencia

El asistente debe:
- Priorizar siempre la documentación cuando esté disponible
- No limitarse exclusivamente a ella si es insuficiente
- Proporcionar respuestas completas y útiles
- Mantener la coherencia con el contexto pastoral católico

---

## 🔧 Implementación Técnica

### Ubicación del código

Archivo: `backend/src/config/chatPrompts.js`

### Intenciones actualizadas

Las 5 intenciones incluyen ambas directrices:

1. **DINAMICA** - Dinámicas y Actividades
2. **CELEBRACION** - Celebraciones y Liturgias
3. **PROGRAMACION** - Programaciones y Planificaciones
4. **ORACION** - Oraciones y Reflexiones
5. **OTROS** - Consultas generales sobre pastoral

### Estructura de cada prompt

```javascript
systemPrompt: `
**RESTRICCIÓN TEMÁTICA IMPORTANTE:**
SOLO puedes responder preguntas relacionadas con:
[lista de temas permitidos]

Si el usuario pregunta sobre temas NO relacionados...
[mensaje de rechazo]

**USO DE LA DOCUMENTACIÓN:**
Cuando respondas, consultas automáticamente la base vectorial...
[descripción de la documentación disponible]

Si la documentación disponible NO es suficiente...
puedes utilizar tu conocimiento de entrenamiento...
Siempre prioriza la documentación cuando esté disponible,
pero no te limites exclusivamente a ella.

[instrucciones específicas de la intención]
`
```

---

## 📊 Beneficios

### Para los usuarios

- **Respuestas enfocadas**: El asistente no se dispersa en temas irrelevantes
- **Expectativas claras**: Saben exactamente qué pueden preguntar
- **Calidad mejorada**: Las respuestas están más alineadas con las necesidades pastorales

### Para la organización

- **Coherencia temática**: Todas las respuestas mantienen el enfoque pastoral católico
- **Uso optimizado de recursos**: El modelo no gasta tokens en temas fuera de alcance
- **Control de contenido**: Se asegura que el asistente respete los valores de la organización

### Para el sistema

- **Mejor uso de RAG**: La documentación se aprovecha al máximo sin ser limitante
- **Flexibilidad inteligente**: El modelo puede ser útil incluso sin documentación específica
- **Prevención de alucinaciones**: Claridad sobre cuándo usar documentación vs. conocimiento general

---

## 🧪 Casos de Prueba

### ✅ Preguntas válidas (deben responderse)

- "¿Puedes sugerirme una dinámica de presentación para jóvenes de 16-18 años?"
- "Necesito preparar una celebración de confirmación para adolescentes"
- "¿Cómo puedo planificar un campamento de verano con temática de fraternidad?"
- "Dame una oración para reflexionar sobre la esperanza con jóvenes"
- "¿Qué actividades puedo hacer para fomentar la solidaridad en mi grupo?"

### ❌ Preguntas inválidas (deben rechazarse)

- "¿Quién ganó el mundial de fútbol en 2022?"
- "Explícame cómo funciona la fotosíntesis"
- "¿Cuál es la receta de la paella valenciana?"
- "¿Qué películas están en el cine este mes?"
- "Ayúdame con mi tarea de matemáticas"

### ⚖️ Preguntas límite (requieren contexto)

- "¿Cómo organizo un torneo deportivo?" → **Válida** si es en contexto pastoral/juvenil
- "¿Qué música puedo usar?" → **Válida** si es para celebraciones o actividades pastorales
- "¿Cómo gestiono un presupuesto?" → **Válida** si es para actividades o proyectos juveniles
- "¿Qué temas de actualidad son importantes?" → **Válida** si se relacionan con valores cristianos

---

## 📝 Notas para desarrolladores

- Los prompts están centralizados en un único archivo para facilitar mantenimiento
- Cada intención mantiene su especialización pero comparte las directrices comunes
- El mensaje de rechazo es consistente en todas las intenciones
- La estructura permite añadir nuevas intenciones fácilmente
- Los tests deben verificar que se rechacen preguntas fuera de tema
- La documentación en `TAG_FILTERING.md` complementa esta funcionalidad

---

## 🔄 Actualizaciones futuras

Posibles mejoras a considerar:

1. **Mensajes de rechazo personalizados** por intención (opcional)
2. **Logging de preguntas rechazadas** para análisis de uso
3. **Sugerencias automáticas** cuando se rechaza una pregunta ("¿Quizás querías preguntar...?")
4. **Modo admin** que permita respuestas sin restricción (para testing)
5. **Métricas de uso** de documentación vs. conocimiento del modelo

---

## 📞 Contacto

Para dudas o sugerencias sobre estas restricciones, contactar al equipo de desarrollo o revisar:
- `backend/src/config/chatPrompts.js` - Implementación
- `.github/registro.md` - Historial de cambios
- `docs/TAG_FILTERING.md` - Sistema de etiquetas
