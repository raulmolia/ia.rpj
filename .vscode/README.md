# Configuración de Visual Studio Code - Asistente IA Juvenil

## 🚀 Configuración Automática del Proyecto

Este proyecto incluye toda la configuración necesaria para trabajar de forma eficiente en Visual Studio Code.

### 📁 Archivos de Configuración Incluidos

- **`asistente-ia-juvenil.code-workspace`** - Workspace principal del proyecto
- **`.vscode/settings.json`** - Configuración específica del proyecto
- **`.vscode/tasks.json`** - Tareas automatizadas (build, run, deploy)
- **`.vscode/launch.json`** - Configuración de debugging
- **`.vscode/extensions.json`** - Extensiones recomendadas
- **`.vscode/configuracion-conexiones.json`** - Configuración de bases de datos y SSH

### 🔧 Instrucciones de Configuración

#### 1. Abrir el Proyecto
```bash
# Abrir VS Code con el workspace
code asistente-ia-juvenil.code-workspace
```

#### 2. Instalar Extensiones Recomendadas
Al abrir el proyecto, VS Code sugerirá instalar las extensiones recomendadas:
- **Remote SSH** - Para conexión al servidor RPJ
- **Prisma** - Soporte para esquemas de base de datos
- **PostgreSQL Client** - Cliente de PostgreSQL integrado
- **GitHub Copilot** - Asistente IA para desarrollo
- **Tailwind CSS** - IntelliSense para Tailwind
- **TypeScript** - Soporte completo para TypeScript/Next.js

#### 3. Configurar Conexión SSH
El proyecto está configurado para conectarse automáticamente al servidor **RPJ**. Asegúrate de tener configurado el SSH:

```bash
# Archivo ~/.ssh/config
Host RPJ
    HostName tu-servidor.com
    User adminweb
    IdentityFile ~/.ssh/id_rsa
```

#### 4. Configurar Variables de Entorno
Crea los archivos `.env` necesarios:

```env
# backend/.env
DATABASE_URL="postgresql://user:password@localhost:5432/asistente_ia_juvenil"
VECTOR_DATABASE_URL="postgresql://user:password@localhost:5432/asistente_ia_vectorial"
```

### ⚡ Tareas Disponibles

Usa `Ctrl+Shift+P` → "Tasks: Run Task" para ejecutar:

- **📦 Instalar dependencias** - Instala todas las dependencias NPM
- **🚀 Ejecutar frontend** - Inicia Next.js en modo desarrollo
- **⚙️ Ejecutar backend** - Inicia el servidor Node.js/API
- **🔧 Prisma: Generar cliente** - Regenera el cliente Prisma
- **🗃️ Prisma: Migrar BD** - Ejecuta migraciones de base de datos
- **📊 Prisma: Studio** - Abre la interfaz web de Prisma
- **🔄 Sincronizar GitHub** - Commit y push automático
- **🏗️ Construir proyecto** - Ejecuta todo el proceso de build

### 🐛 Debugging Configurado

Configuraciones de debug disponibles:
- **Debug Next.js** - Debugging del frontend
- **Debug Backend API** - Debugging del servidor Node.js
- **Debug Tests** - Debugging de pruebas unitarias

### 🔗 Conexiones de Base de Datos

El proyecto incluye configuración para dos bases de datos PostgreSQL:
1. **Principal** - Usuarios, autenticación, datos de aplicación
2. **Vectorial** - Documentación y contexto para IA

Usa la extensión PostgreSQL Client para conectarte directamente desde VS Code.

### 📝 Configuraciones Específicas

- **Formateo automático** al guardar archivos
- **ESLint** y **Prettier** configurados
- **IntelliSense** completo para TypeScript y Tailwind
- **Exclusión automática** de node_modules, .next, dist
- **Autocompletado** de imports y rutas

### 🎯 Flujo de Trabajo Recomendado

1. **Abrir workspace** → `code asistente-ia-juvenil.code-workspace`
2. **Instalar extensiones** cuando VS Code lo solicite
3. **Ejecutar tarea de build** → `Ctrl+Shift+P` → "Construir proyecto completo"
4. **Iniciar desarrollo** → Ejecutar tareas de frontend y backend
5. **Sincronizar cambios** → Usar tarea de sincronización GitHub

### 🔄 Sincronización Automática

Recuerda usar la tarea **"Sincronizar con GitHub"** al final de cada sesión para mantener el servidor y GitHub sincronizados según las directrices del proyecto.

---

**💡 Tip**: Todas estas configuraciones están diseñadas para seguir las directrices obligatorias del proyecto y facilitar el desarrollo con las herramientas MCP priorizadas.