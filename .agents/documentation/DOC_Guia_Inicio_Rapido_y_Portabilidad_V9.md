---
tipo: playbook
estado: activo
version: V9 SDLC Git-Native & Harness³ Plugin Ecosystem
tags:
  - guia-inicio
  - portabilidad
  - instalacion
  - prompt-maestro
  - arnes
  - harness3
  - antigravity-cli
  - orca-ide
---

# Guía de Inicio Rápido, Portabilidad e Instalación Multi-Entorno (Arquitectura V9)

Esta guía documenta el protocolo oficial para clonar, portar, configurar y arrancar proyectos nuevos a partir de la **Plantilla Base Agentes V9 (SDLC Git-Native & Harness³)**, optimizada para **Antigravity CLI** y **Orca IDE**.

---

## 🚀 1. Prompt Maestro de Inicio (Master Kickoff Prompt)

Para arrancar un proyecto nuevo desde cero manteniendo la disciplina metodológica V9 (SDD + TDD + ODD), copia y pega el siguiente prompt en el chat raíz con el **Project-Planner** (Tier Pro High):

```markdown
Hola Project-Planner. Vamos a iniciar el desarrollo de un nuevo proyecto a partir de esta plantilla base.

NOMBRE DEL PROYECTO: [Nombre del Proyecto]
VISIÓN Y OBJETIVO DE NEGOCIO: [Breve descripción de lo que hace el producto, su público objetivo y propuesta de valor]
ALCANCE MVP (ITERACIÓN v0.1.0): [Listado de las 2-4 funcionalidades nucleares imprescindibles para este primer release]
STACK TÉCNICO PREFERIDO: [Ej: TypeScript / Node / Bun / Fastify / SQLite / React / Tailwind]

Por favor ejecuta el protocolo de arranque V9:
1. Lee `PROJECT.md` y actualízalo con el alcance real, módulos e inventario funcional de este nuevo proyecto.
2. Actualiza los artefactos vivos en `artifacts/`:
   - `artifacts/project_overview.md`: visión de negocio, versión v0.1.0 e índice de artefactos.
   - `artifacts/architecture/architecture.md`: tech stack y genera el diagrama de arquitectura interactivo `architecture_diagram.html` con Archify.
   - `artifacts/architecture/abstractions.md`: contratos maestros de dominio, interfaces y servicios clave.
   - `artifacts/architecture/api_spec.md`: contratos formales SDD de los endpoints y modelos de base de datos del MVP.
3. Desglosa la iteración v0.1.0 en los artefactos delta:
   - `artifacts/planning/implementation_plan.md`: plan atómico paso a paso bajo principio YAGNI y SDD.
   - `artifacts/planning/task.md`: checklist de tareas asignadas explícitamente a los subagentes responsables.
4. Crea el milestone y los issues iniciales en GitHub mediante GitHub CLI (`gh milestone create`, `gh issue create`).
5. No escribas código de producción en este chat raíz. Una vez estructurada la arquitectura y los contratos, empaqueta las tareas atómicas con el empaquetador de contexto (`bun run pack:task --agent <rol> --slice <nombre>`) para despachar a los subagentes (Backend-Architect, Frontend-UI, Systems-Auditor, DevOps-Engineer) en contextos aislados bajo Tier Flash High.
```

### 🧠 ¿Qué hace el Orquestador al recibir este prompt?
1. **Gobierno Estricto:** Cumple la Regla 2 de `AGENTS.md` (cero código de producción en el chat raíz).
2. **Trazabilidad Git Temprana:** Registra el Milestone y los Issues con `gh` antes de escribir la primera línea de lógica.
3. **Contratos SDD Previos:** Fija la especificación en `api_spec.md` y `abstractions.md` antes de delegar tareas a los subagentes.
4. **Despacho Quirúrgico:** Utiliza `bun run pack:task` para generar resúmenes densos (<100 líneas) que inyectan únicamente lo indispensable a cada subagente.

---

## 💻 2. Guía de Portabilidad e Instalación Multi-Dispositivo

Si deseas transferir esta plantilla a otra computadora, laptop de trabajo, máquina virtual o servidor de CI/CD, sigue estas directrices estrictas:

### 📦 A. Qué Copiar (Archivos Esenciales de la Plantilla)
- `.agents/`: Todo el directorio del arnés (skills, scripts deterministas, `models.yaml`, reglas y esquemas).
- `.agents/plugins/antigravity-harness-core/`: Código fuente del plugin canónico de Harness³.
- `artifacts/`: Plantillas maestras de arquitectura, planificación, especificaciones y reportes de auditoría.
- `scripts/`: Herramientas deterministas de soporte (`worktree.ts`, `lint_contracts.ts`, `pack_task.ts`, `validate_existing_artifacts.ts`, etc.).
- `src/`: Código fuente base o slices iniciales.
- Archivos raíz de configuración y gobernanza:
  - `package.json`, `bun.lock`, `tsconfig.json`
  - `AGENTS.md` (Reglamento rector del ecosistema)
  - `PROJECT.md` (Manifiesto de alcance y módulos)
  - `README.md` (Documentación principal del proyecto)

### 🚫 B. Qué NO Copiar (Archivos a Excluir / Ignorar)
Al migrar de entorno, **OMITE** copiar los siguientes directorios y archivos temporales para evitar bloqueos NTFS, corrupción de punteros SQLite o residuos de sesiones anteriores:
- `node_modules/`, `vendor/`, `.venv/`, `.dart_tool/`: Se reconstruyen en destino mediante los gestores de paquetes nativos.
- `_workspace/`: Contiene el estado del Circuit Breaker (`tool_counter.json`) y reportes de fricción efímeros de la máquina original.
- `${PLUGIN_DATA}/telemetry.db*` o `.agents/plugins/antigravity-harness-core/telemetry.db*`: La base de datos SQLite de telemetría se inicializa automáticamente en el nuevo entorno.
- `.gemini/antigravity-cli/brain/`: Transcripciones y memoria de trabajo de sesiones pasadas de la máquina de origen.
- `.git/`: Si vas a iniciar un repositorio totalmente nuevo y desacoplado, borra `.git` y ejecuta `git init`. Si es el mismo repositorio, clónalo normalmente vía `git clone`.

---

## 🔌 3. Instalación y Registro del Plugin `antigravity-harness-core`

El plugin **Harness³** proporciona las 3 dimensiones de auto-mejora: sanitización in-flight (`PreToolUse`), inyección efímera Zero-Prompt-Bloat (`PreInvocation`) y telemetría con Quality Gate Stop Guardian (`PostToolUse` / `Stop`).

### Opción 1: Enfoque Local al Proyecto (Recomendado por Defecto)
El plugin ya viene preconfigurado dentro del repositorio en `.agents/plugins/antigravity-harness-core/`. Antigravity CLI y Orca IDE lo reconocen de inmediato al abrir la carpeta del proyecto sin requerir instalación adicional.

### Opción 2: Instalación Global en el Sistema Operativo
Si deseas que el plugin `antigravity-harness-core` esté disponible globalmente para todos tus proyectos de Antigravity CLI en tu máquina:

```powershell
# En Windows (PowerShell):
$targetDir = "$HOME\.gemini\config\plugins\antigravity-harness-core"
if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir }
Copy-Item -Recurse -Force .agents/plugins/antigravity-harness-core/* $targetDir

# En macOS / Linux (Bash):
mkdir -p ~/.gemini/config/plugins/antigravity-harness-core
cp -r .agents/plugins/antigravity-harness-core/* ~/.gemini/config/plugins/antigravity-harness-core/
```

### Verificación de Instalación del Plugin:
Ejecuta la suite de pruebas unitarias dedicada del plugin para certificar su correcto funcionamiento:
```powershell
bun test ./.agents/plugins/antigravity-harness-core/tests
```

---

## ⚙️ 4. Prerrequisitos en la Nueva Máquina

Asegúrate de contar con las siguientes herramientas instaladas en el sistema anfitrión:

1. **Bun Runtime (>= 1.1):** Motor de ejecución ultra-rápido para scripts, linters y suites de tests.
   ```powershell
   bun --version
   ```
2. **Git & GitHub CLI (`gh`):** Control de versiones y automatización de gates, milestones y releases.
   ```powershell
   git --version
   gh --version
   gh auth status   # Si no está autenticado: gh auth login
   ```
3. **Antigravity CLI (`agy`):** CLI nativo de agentes IA de Google DeepMind.
   ```powershell
   agy --version
   ```

---

## 🚦 5. Protocolo de Verificación del Arnés (Sanity Check en 4 Pasos)

Tras clonar o copiar la plantilla a tu nuevo entorno, valida la integridad de todos los subsistemas ejecutando secuencialmente estos 4 comandos:

```powershell
# 1. Instalar dependencias limpias
bun install

# 2. Ejecutar la suite completa de pruebas unitarias (157 tests, 100% verde)
bun run test

# 3. Validar artefactos, heurísticas FIFO y SDD Contract Drift Guard
bun run validate

# 4. Verificar el bucle de auto-mejora recursiva del arnés (Harness² Loop)
bun run verify:loop
```

Si los 4 comandos finalizan con código de salida `0`, tu entorno está **100% operativo y certificado** para iniciar el desarrollo agéntico asistido.

---

## 🧰 6. Comandos Operativos de Uso Frecuente

| Comando | Propósito |
| :--- | :--- |
| `bun run validate` | Valida los 9 artefactos canónicos, las 6 heurísticas y audita paridad de contratos SDD. |
| `bun run lint:contracts` | Detecta desalineamiento entre `api_spec.md` y endpoints en código fuente. |
| `bun run pack:task --agent <rol> --slice <slice>` | Empaqueta contexto ultra-denso (<100 líneas) para despacho de subagentes. |
| `bun scripts/worktree.ts add <dominio>` | Crea un git worktree efímero con enlaces NTFS para concurrencia de subagentes. |
| `bun scripts/worktree.ts remove <dominio>` | Desmonta de forma segura y no destructiva el worktree efímero. |
| `powershell scripts/agy-safe.ps1` | Inicia sesión en Antigravity CLI con reseteo automático de contadores del Circuit Breaker. |
| `powershell scripts/agy-safe.ps1 -Status` | Consulta métricas en tiempo real del Circuit Breaker (llamadas, lecturas, fallos). |
| `bun run verify:loop` | Demostración reproducible del diagnóstico y aprendizaje recursivo en 2 turnos. |
