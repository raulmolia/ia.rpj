# Plan: Implementación del Modo Lienzo (Canvas Mode)

Implementar un modo lienzo inspirado en ChatGPT Canvas y Gemini que permita editar respuestas del asistente en un panel dividido (1/3 chat + 2/3 editor), con capacidad de seleccionar texto y iterar sobre fragmentos específicos mediante un popover contextual. Incluye soporte responsive desde el inicio, internacionalización y exportación a Word/PDF.

## Steps

1. **Crear componentes base del Canvas** en [`frontend/src/components/canvas/`](frontend/src/components/)
   - `CanvasDialog.tsx`: Dialog con layout dividido (1/3 chat, 2/3 editor) usando `react-resizable-panels`; en móvil, pantalla completa con tabs para alternar chat/editor
   - `CanvasEditor.tsx`: Editor de texto rico con TipTap (Markdown, formato básico)
   - `CanvasToolbar.tsx`: Barra superior con navegación de versiones, botón "Mostrar cambios", exportar (PDF/Word), copiar, cerrar
   - `SelectionPopover.tsx`: Popover contextual que aparece al seleccionar texto con input para instrucciones

2. **Añadir traducciones del Canvas** a los archivos de idiomas en [`frontend/src/locales/*.json`](frontend/src/locales/)
   - Nueva sección `"canvas"` con claves: `title`, `editPlaceholder`, `selectionInstruction`, `versions`, `showChanges`, `exportPdf`, `exportWord`, `copy`, `close`, `applyChanges`, `tabChat`, `tabEditor`
   - Traducir a los 10 idiomas existentes (es, en, fr, it, pt, hu, pl, ca, gl, eu)

3. **Añadir opción "Lienzo" al toolbox de herramientas** en [`page.tsx`](frontend/src/app/page.tsx)
   - Agregar icono `Layout` al dropdown de herramientas junto a Deep Think y Dictado
   - Estado `canvasMode: boolean` para indicar que el próximo mensaje debe abrir el canvas
   - Badge visual cuando el modo lienzo está activado
   - Usar `useTranslations('tools')` para etiqueta traducida

4. **Implementar lógica de apertura del Canvas** en [`page.tsx`](frontend/src/app/page.tsx)
   - Al recibir respuesta del asistente con `canvasMode=true`, abrir `CanvasDialog` automáticamente
   - Pasar la respuesta como contenido inicial del editor
   - Mantener mini-chat funcional dentro del dialog (panel izquierdo) para iterar sobre el contenido

5. **Implementar sistema de versiones** en `CanvasEditor.tsx`
   - Estado `versions: CanvasVersion[]` con historial de cambios locales
   - Navegación entre versiones con flechas `<` `>` en toolbar
   - Botón "Mostrar cambios" usando librería `diff` para visualizar diferencias

6. **Implementar selección de texto e iteración** en `CanvasEditor.tsx` + `SelectionPopover.tsx`
   - Detectar selección con `window.getSelection()` y posicionar popover debajo
   - Input en popover para escribir instrucción sobre el fragmento seleccionado
   - Al enviar: llamar backend, obtener transformación, reemplazar solo el fragmento, crear nueva versión

7. **Implementar exportación PDF/Word** en `CanvasToolbar.tsx`
   - Reutilizar funciones `downloadAsPDF` y `downloadAsWord` de [`lib/document-generator.ts`](frontend/src/lib/document-generator.ts)
   - Dropdown con opciones PDF y Word como en los mensajes del chat actual

8. **Crear endpoint de transformación en backend** en [`backend/src/routes/canvas.js`](backend/src/routes/)
   - `POST /api/canvas/transform`: recibe `{ content, selection?, instruction, language }` y devuelve contenido transformado
   - Reutilizar `llmService` con prompt especializado para edición (respeta idioma del usuario)
   - Registrar en rutas principales [`backend/src/routes/index.js`](backend/src/routes/index.js)

9. **Actualizar modelo de mensaje para persistir canvas** en [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)
   - Añadir campo opcional `canvasContent String? @db.LongText` al modelo `MensajeConversacion`
   - Ejecutar migración Prisma

## Further Considerations

1. **Atajos predefinidos (Fase 2)**: Añadir menú flotante con acciones rápidas contextuales (Alargar/Acortar, Cambiar tono, Añadir citas bíblicas) en una segunda fase de desarrollo
2. **Sincronización en tiempo real**: Evaluar si implementar auto-guardado del canvas o solo guardar al cerrar el dialog
