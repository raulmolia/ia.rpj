# Integración del chat con Chutes AI

## 1. Preparación y configuración
- [x] Añadir variable de entorno `CHUTES_API_TOKEN` con la clave proporcionada (sin incluirla en el repositorio).
- [x] Documentar en backend/.env.example la nueva variable y valores recomendados (modelo, temperatura, etc.).
- [x] Verificar dependencias necesarias para peticiones fetch/stream en Node (usar `node-fetch` o `undici` si hace falta).

## 2. Diseño funcional
- [x] Definir intenciones del asistente (dinámica, oración, proyecto, general) y la lógica para seleccionarlas.
- [x] Redactar prompts de sistema base por intención, indicando slots para contexto y parámetros.
- [x] Especificar el formato del payload a Chutes (mensajes, opciones `max_tokens`, `temperature`, `stream`).

## 3. Backend: endpoint conversacional
- [x] Crear ruta `POST /api/chat` que reciba historial + mensaje nuevo + metadata de sesión.
- [x] Implementar detección/preselección de intención a partir del mensaje.
- [x] Recuperar contexto desde ChromaDB según intención y fusionarlo con el prompt de sistema.
- [x] Invocar a Chutes AI con el payload completo y gestionar respuesta (streaming o bufferizado).
- [x] Normalizar la respuesta en un formato único (texto principal + puntos clave opcionales).

## 4. Backend: observabilidad y manejo de errores
- [x] Añadir logs estructurados (intención, tokens, duración) y manejo de timeouts/retries.
- [x] Registrar en base de datos cada turno de conversación con metadatos relevantes.
- [x] Implementar respuestas de fallback cuando falle la IA o no haya contexto.

## 5. Frontend: integración con el nuevo endpoint
- [x] Actualizar `/src/app/page.tsx` para consumir el endpoint real en lugar de mocks.
- [x] Mostrar estados de carga, errores y (si se implementa) respuesta en streaming.
- [x] Sincronizar el historial local con el backend y permitir reintentos.

## 6. Validación y despliegue
- [x] Escribir pruebas unitarias/integración para los servicios nuevos (detección de intención, llamada a Chutes, búsqueda vectorial).
- [x] Ejecutar test end-to-end básico desde el frontend.
- [x] Actualizar `.github/registro.md` con el progreso y ejecutar el flujo de despliegue (`npm run deploy`).
