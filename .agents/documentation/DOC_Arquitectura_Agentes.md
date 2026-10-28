---
tipo: playbook
estado: activo
version: V9 SDLC Git-Native & Harness³ Plugin Ecosystem
tags:
  - agentes
  - sdlc
  - calidad
  - qa
  - subagentes
  - orquestacion
  - archify
  - playwright
  - context7
  - modelos
  - sdd
  - tdd
  - odd
  - vsa
  - harness2
  - harness3
  - git-gates
---

# Ecosistema de Agentes: Arquitectura V9 (SDLC Git-Native, SDD+TDD+ODD & Harness³ Plugin Ecosystem)

Hemos consolidado la **Arquitectura V9 de Agentes (Harness³)**, transformando el modelo multiagente en un sistema **100% integrado con Git/GitHub CLI (`gh`)**, articulado por el triángulo metodológico **SDD + TDD + ODD**, estructurado mediante **Vertical Slice Architecture (VSA)**, respaldado por una **Pirámide de Testing Escalonada de 3 Niveles**, la **Política de Artefactos Vivos vs. Deltas (Zero-Touch)**, el **Criterio de Ramas Secuenciales vs. Worktrees Efímeros**, el **Protocolo Anti-Loop** y el **Arnés de Auto-Mejora Tridimensional (Harness³)**.

---

## 🧠 1. Matriz de Modelos de Inteligencia Artificial y Autoload Skills
*(Centralizado en `.agents/models.yaml` como Single Source of Truth)*

| Agente / Rol | Tipo de Ejecución | Tier & Modelo Asignado | Autoload Skills Vitales |
| :--- | :--- | :--- | :--- |
| **Project-Planner** | **Agente Principal (Orquestador & Harness Director)** | **Tier Pro (High)** (`pro` / Gemini Pro High) | `archify`, `artifact-standards`, `improve-codebase-architecture`, `lean-ux` |
| **Backend-Architect** | **Subagente Autónomo (VSA & SDD/TDD)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `improve-codebase-architecture`, `sqlite-local-first-flutter`, `artifact-standards` |
| **Frontend-UI** | **Subagente Autónomo (UI/UX & Dials)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `ui-ux-pro-max`, `design-taste-frontend`, `artifact-standards` (on-demand: `refactoring-ui`, `redesign-existing-projects`, `vercel-react-best-practices`, `flutter-production-engineering`, `web-typography`, `microinteractions`, `top-design`, `design-everyday-things`) |
| **Systems-Auditor** | **Subagente Autónomo (QA Gatekeeper & Arnés)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `ux-heuristics`, `vercel-react-best-practices`, `design-everyday-things`, `artifact-standards` |
| **DevOps-Engineer** | **Subagente Autónomo (Release & Infra)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `artifact-standards` |

---

## 📐 2. Triángulo Metodológico: SDD + TDD + ODD

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                       TRIÁNGULO METODOLÓGICO: SDD + TDD + ODD EN AGENTES                         │
├──────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┤
│ 1. SDD (Spec-Driven Dev)     │ 2. TDD (Test-Driven Dev)        │ 3. ODD (Observability/Outcome)  │
├──────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ • Contrato formal previo en  │ • Fase Red -> Green -> Refactor │ • Código instrumentado desde el │
│   api_spec.md y              │   guiado por tests del slice.   │   origen (logs estructurados,   │
│   abstractions.md.           │ • Los tests se generan antes    │   tiempos, healthchecks /healthz│
│ • Define el "QUÉ" y las      │   o a la par del código.        │   y cero consultas N+1).        │
│   fronteras de Vertical      │ • El agente escribe el código   │ • Outcome verificable: nodos    │
│   Slice Architecture (VSA).  │   mínimo para poner tests en    │   DOM (<800 warning, <1400 err),│
│                              │   verde (runner nativo <500ms). │   cero errores en consola web.  │
└──────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

1. **SDD (Spec-Driven Development):** Todo requerimiento se formaliza primero en contratos de interfaz y modelos en `artifacts/architecture/api_spec.md`, `artifacts/architecture/abstractions.md` y `artifacts/architecture/design_system.md`.
2. **TDD (Test-Driven Development - Framework & Stack Agnostic):** Cada caso de uso nace con sus tests unitarios y de contrato co-localizados (`<slice>.test.ts`, `<slice>_test.dart`, etc.) utilizando las herramientas nativas del stack (`bun test` / `vitest` en TypeScript, `flutter test` / `dart test` en Flutter, `pest` / `phpunit` en PHP, `pytest` en Python), ejecutados en milisegundos (<500ms o runner nativo) antes de escribir la lógica del servicio.
3. **ODD (Observability & Outcome-Driven Development):** Todo servicio o endpoint nace con observabilidad incorporada. Se valida el outcome real mediante presupuestos de rendimiento (<800 nodos DOM) y cero excepciones en runtime.

---

## 🔄 3. El Ciclo de 7 Fases en la Arquitectura V9 (SDLC Git-Native)

```
[1. Comunicación] ──► [2. Plan Rápido & SDD] ──► [3. Modelado & Contratos]
      │                      │                               │
 (Usuario/Issue)      (gh milestone & issue)           (api_spec & tokens)
                             │                               │
                             ▼                               ▼
                      [4. Construcción VSA & TDD] ◄──────────┘
                             │ (Red -> Green <500ms)
                             ▼
                      [5. Quality Gate Piramidal]
                             │ (PASS / FAIL - Causa Raíz)
                             ▼
             ┌───────────────┴───────────────┐
             ▼ (Defecto de Arnés)            ▼ (PASS)
      [6a. Harness² Loop]            [6b. Pipeline Release]
     chore(harness): ...              gh release create
             │                               │
             └───────────────┬───────────────┘
                             ▼
                      [7. Feedback Continuo]
```

1. **Fase 1: Comunicación:** Requerimiento o idea de negocio originada por el usuario o mediante un issue en GitHub.
2. **Fase 2: Plan Rápido y SDD Inicial (Trazabilidad Temprana con `gh`):**
   - El `Project-Planner` (Tier Pro High) desglosa el alcance MVP aplicando YAGNI y Lean UX.
   - **Inicialización Temprana en GitHub CLI:** Crea el Milestone (`gh milestone create --title "vX.Y.Z"`) y los Issues atómicos (`gh issue create --milestone "vX.Y.Z"`).
   - Actualiza los deltas de planificación (`implementation_plan.md`, `task.md`).
3. **Fase 3: Modelado Rápido y Contratos SDD:**
   - `Backend-Architect` formaliza endpoints y modelos en los artefactos vivos `api_spec.md` y `abstractions.md`.
   - `Frontend-UI` actualiza y sincroniza los tokens visuales y patrones de componentes en `design_system.md`.
4. **Fase 4: Construcción con VSA y TDD Adelantado:**
   - **Vertical Slice Architecture (VSA):** Cada caso de uso se organiza en carpetas autocontenidas (`src/features/<slice>/` o `lib/features/<slice>/`).
   - **TDD Temprano (Runner Nativo):** Se programa `<slice>.test.ts` (o `<slice>_test.dart`, `test_<slice>.py`) **antes** de codificar la lógica del slice. Ciclo estricto: Red (falla) -> Green (código mínimo para pasar en verde en <500ms o runner nativo: Bun, Flutter Test, Pest, pytest) -> Refactor.
5. **Fase 5: Quality Gate Piramidal y Diagnóstico de Causa Raíz:**
   - `Systems-Auditor` evalúa los 3 niveles de testing (N1 Unitario, N2 Smoke Playwright headless, N3 Playwright MCP).
   - Ante fallos, clasifica formalmente en `audit_report.md`: **Defecto de Código** (bug de implementación) o **Defecto de Arnés** (especificación ambigua, skill desalineada).
   - Aplica el **Protocolo Anti-Loop:** Máximo 2 reintentos antes de pausa obligatoria.
6. **Fase 6: Bucle de Auto-Mejora Harness² o Pipeline de Release:**
   - Si hubo Defecto de Arnés: Se actualizan las skills/prompts y se consolida con `chore(harness): ...`.
   - Si hubo `veredicto: PASS`: `DevOps-Engineer` ejecuta el pipeline determinista de 6 pasos y publica el release con `gh release create`.
7. **Fase 7: Feedback e Integración Continua:**
   - Entrega final verificada con tag semántico que nutre la siguiente iteración.

---

## 🍰 4. Vertical Slice Architecture (VSA)

Abandonamos la dispersión de archivos del MVC tradicional. El código se organiza en **rebanadas verticales autocontenidas por caso de uso**:

```text
src/features/<slice-name>/ (o lib/features/<slice-name>/ en Flutter)
├── <slice-name>.route.ts     # Controlador y enrutamiento del caso de uso
├── <slice-name>.schema.ts    # Contrato SDD (Zod / DTOs / Data Classes)
├── <slice-name>.service.ts   # Lógica de negocio pura (<150 LoC)
└── <slice-name>.test.ts      # Suite TDD co-localizada (<slice>_test.dart en Flutter)
```

- **Archivos Modulares:** Cada archivo respeta la regla de oro **< 300 LoC**.
- **Cero Conflictos de Git:** Múltiples agentes pueden trabajar en paralelo en slices distintos sin colisionar en ramas compartidas.
- **Co-localización de Tests:** Los tests residen junto al código que validan, facilitando su ejecución quirúrgica (`bun test --filter <slice>`, `flutter test <slice>`, `pest --filter <Slice>`).

---

## 🔺 5. Pirámide de Testing Escalonada de 3 Niveles

Para garantizar velocidad instantánea y no derrochar tokens, se implementa la pirámide de 3 niveles:

```text
                  ▲
                 / \
                /   \     NIVEL 3: Auditoría Agéntica ODD (Playwright MCP)
               /     \    Solo en Quality Gates de PR / Releases. Inspección visual,
              /───────\   DOM (<800 warning, <1400 fatal), consola y flujos E2E.
             /         \
            /           \   NIVEL 2: Smoke Tests Deterministas (Playwright Headless)
           /             \  Scripts estáticos de flujos críticos (Login, Checkout).
          /───────────────\ Cero tokens. Ejecución local en 2-4 segundos.
         /                 \
        /                   \  NIVEL 1: Contratos SDD y Tests Unitarios Nativos (Bun, Flutter Test, Pest, pytest)
       /                     \ Ultra-rápidos (<500ms o runner nativo). Se ejecutan antes de cada commit.
      /───────────────────────\ Co-localizados en el Vertical Slice o directorio nativo. 0 tokens.
```

---

## 🌿 6. Git Gates y Criterio de Ramas vs. Worktrees Efímeros

### 6.1 Criterio de Selección: Ramas Secuenciales vs. Worktrees
| Escenario | Estrategia | Modo Operativo | Beneficio en Windows |
| :--- | :--- | :--- | :--- |
| **Iteraciones Estándar (90% de tareas)** | **Ramas Secuenciales** | `git checkout agent/<dominio>` en el mismo directorio de trabajo | Cero fricción de symlinks, sin file locking y máxima simplicidad de Git. |
| **Concurrencia Real Simultánea** | **Worktrees Efímeros con NTFS Junctions** | `git worktree add ..\worktree-<dominio>` + `cmd /c mklink /J ...\node_modules` | Ejecución paralela real sin duplicar gigabytes de dependencias ni bloquear el índice de Git. |

*Teardown de Worktree:* Concluida la tarea concurrente y mergeada en la rama de integración, se ejecuta `git worktree remove ..\worktree-<dominio>`.

### 6.2 Topología Canónica y Conventional Commits
- **Ramas Principales:** `main` (producción con tag anotado), `develop` o `agent/<dominio>` (`agent/backend`, `agent/frontend`, etc.).
- **Commits Semánticos:** `feat(backend): ...`, `feat(ui): ...`, `test(audit): ...`, `chore(release): ...`. Commits de arnés: `chore(harness): ...`.
- **GitHub CLI:** Trazabilidad obligatoria desde la Fase 2 con `gh milestone create` y `gh issue create`.

---

## 📂 7. Política de Artefactos Vivos vs. Deltas (Zero-Touch Policy)

| Categoría | Archivos | Comportamiento en Iteraciones |
| :--- | :--- | :--- |
| **Artefactos Vivos (Living Artifacts)** | `artifacts/project_overview.md`<br>`artifacts/architecture/architecture.md`<br>`artifacts/architecture/abstractions.md`<br>`artifacts/architecture/api_spec.md`<br>`artifacts/architecture/design_system.md` | **SSoT Acumulativa:** No se versionan con sufijos (`_v2`, `_v3`). Se actualizan *in-place* manteniendo la fotografía fiel y completa del sistema actual. |
| **Deltas de Iteración (Iterative Deltas)** | `artifacts/planning/implementation_plan.md`<br>`artifacts/planning/task.md`<br>`artifacts/audit_reports/audit_report.md`<br>`artifacts/planning/changelog_vX.md` | **Historial y Guía de Ciclo:** Guían la iteración activa. Al finalizar el release, `changelog_vX.md` y `audit_report.md` quedan sellados como registro inmutable del ciclo. |

---

## 🔄 8. Protocolo Anti-Loop y Arnés de Auto-Mejora Tridimensional (Harness³)

1. **Protocolo Anti-Loop (Máximo 2 Reintentos):** Si un subagente no logra pasar sus pruebas tras 2 reintentos consecutivos, se impone **PAUSA OBLIGATORIA**. Prohibido aplicar parches a ciegas.
2. **Arquitectura Dual de Auto-Mejora Silenciosa (Defensa en Profundidad):**
   - **Opción A (Reflejo en Caliente - Hooks & Circuit Breaker con `--auto-heal`):** Intercepción inmediata Turno a Turno. Al detectarse ≥ 2 fallos consecutivos o bloqueo por el Circuit Breaker (`CIRCUIT_BREAKER_BLOCKED`), se ejecuta silenciosamente `autoHealFromFailure()`. Si es un Defecto de Arnés, inyecta la heurística preventiva en `learned_heuristics.md` de la skill relevante (respetando FIFO: ≤10 reglas / ≤30 líneas) y notifica `[HARNESS AUTO-HEAL]` para optimización inmediata en el Turno 2 sin intervención humana.
   - **Opción B (Auditoría Forense en Frío - Systems-Auditor & `distill_session.ts`):** Al concluir la sesión o en Quality Gate, `distill_session.ts` procesa las trazas de ejecución en `friction_report.md` (<25 líneas). El `Systems-Auditor` clasifica formalmente el origen del fallo y certifica que todas las heurísticas cumplan con los estándares mediante `bun run validate` (`validate_artifact.ts --heuristics`).
3. **Diagnóstico de Causa Raíz en `audit_report.md`:** `Systems-Auditor` clasifica obligatoriamente si el fallo es **Defecto de Código** (bug en el slice) o **Defecto de Arnés** (especificación ambigua en `api_spec.md`, regla faltante en `SKILL.md`, mock desfasado o linter descalibrado).
4. **Bucle de Auto-Mejora del Arnés (Harness² Loop):** Al detectarse un defecto de arnés, se corrige el componente de configuración afectado (`.agents/`, prompts o skills) y se consolida con commit semántico dedicado:
   `git commit -m "chore(harness): <descripción de la mejora en el arnés>"`

---

## 🚀 9. Pipeline Determinista de Release de 6 Pasos (DevOps-Engineer)

Con el `veredicto: PASS` certificado por `Systems-Auditor`:
1. **Quality Gate Verification:** Confirmación obligatoria de `veredicto: PASS` en `audit_report.md`.
2. **Git Differential Inspection:** `git log <prev_tag>..HEAD --oneline` y `git diff <prev_tag>..HEAD --stat`.
3. **Manifest Synchronization:** Bump de versión unificado en manifiestos (`package.json`, `pubspec.yaml`, `composer.json`, `pyproject.toml`, `README.md` y `PROJECT.md`).
4. **Changelog Estructurado en 7 Secciones:** `Added & Modularized`, `Refactored & Enhanced`, `Removed & Optimized (Anti-Slop)`, `Fixed & Enhanced`, `Modernized & Upgraded`, `Quality Gate & DevOps`, `Security` con métricas cuantitativas y rutas exactas.
5. **Git Commit & Tag Anotado:** `chore(release): bump version to vX.Y.Z` y `git tag -a vX.Y.Z -m "Release vX.Y.Z: ..."`.
6. **GitHub Release Publication:** `gh release create vX.Y.Z --title "[Nombre] vX.Y.Z" --notes-file release_notes.md`.

---

## 🔌 10. Integración de Servidores MCP y Tool Guidance

1. **`context7` MCP (Investigación Activa de Versiones y Dependencias):**
   - **Propósito y Poder (Enfoque Habilitador):** `context7` es la herramienta clave para mantener a la IA permanentemente actualizada sobre las distintas versiones de las dependencias que utiliza el proyecto. Permite investigar qué versión específica está en uso, descubrir nuevas características, funciones o llamadas implementadas en la última versión de un framework o lenguaje (ej. PHP 8.3+, Next.js 15, Flutter 3.x, Bun 1.x, Drizzle, etc.), prevenir APIs deprecadas y consultar sintaxis moderna exacta de forma quirúrgica, sin inflar la ventana de contexto con líneas y líneas de documentación innecesaria.
   - **Límite Preciso (Qué NO hacer):** La única restricción es no confundir `context7` con un buscador de archivos locales del repositorio. Queda estrictamente prohibido intentar buscar rutas internas, modelos, componentes o archivos propios del proyecto (como `src/...`, `features/...`, `lib/...`) en `context7`. Para el código del repositorio, se usan exclusivamente las herramientas locales (`grep_search`, `find_by_name`, `list_dir`, `view_file`).
2. **`playwright` MCP:** Utilizado por `Systems-Auditor` y `Frontend-UI` en el Nivel 3 de la pirámide de tests para inspección en navegadores reales, cálculo exacto de nodos DOM (`document.querySelectorAll('*').length`), screenshots y logs de consola.
3. **`obsidian` MCP (Opcional / Externo):** Si está instalado y configurado en el entorno local del usuario, mantiene la base de conocimiento y los playbooks sincronizados entre el entorno local y la bóveda en Obsidian (`read_note` y `write_note`). No forma parte de las herramientas base requeridas por defecto.

---

## 🛠️ 11. Protocolo de Tool Forging en Caliente (Offloading Mecánico)

1. **Umbral de Forja Mecánica (>6 Operaciones Idénticas):**
   - Si una tarea técnica exige más de 6 operaciones mecánicas idénticas (como transformaciones masivas de archivos, escaneos estáticos, parsing repetitivo de datos, validaciones de sintaxis o conversiones de formato), el subagente está **explícitamente facultado y obligado** a forjar un script determinista en `scripts/` (TypeScript con Bun, Python o Bash) antes de continuar.
2. **Principio "Scripts over Prompts" (Harness²):**
   - Razonar token por token sobre tareas mecánicas repetitivas o archivos extensos degrada la ventana de contexto, satura la atención del modelo y dispara el consumo de tokens.
   - El subagente debe escribir el script, ejecutarlo en el runner nativo para obtener una salida condensada (`{ "valid": boolean, "errors": string[] }` o resumen tabular) y razonar únicamente sobre ese resultado procesado.
3. **Persistencia y Promoción al Arnés:**
   - Si el script forjado resuelve una necesidad recurrente del ciclo de desarrollo (por ejemplo, validadores de artefactos, extractores de contratos o sanitizadores), debe guardarse en la subcarpeta `scripts/` de la skill correspondiente (`.agents/skills/<skill>/scripts/`) o en `scripts/` raíz del proyecto, consolidando la mejora con un commit semántico:
     `git commit -m "chore(harness): forge <nombre_script> for <propósito>"`

---

---

## ⚡ 12. Arquitectura de Plugins Nativos Antigravity CLI (Harness³ Core)

La **Versión 9** introduce la integración nativa y de primera clase con el motor de plugins de **Antigravity CLI**:

1. **Plugin Canónico `antigravity-harness-core` (V9.0.0):**
   - Empaquetado bajo estándares oficiales con manifiesto `plugin.json` y orquestador `hooks.json`.
   - Disponible en el workspace local (`.agents/plugins/antigravity-harness-core/`) y registrado para descubrimiento global en `~/.gemini/config/plugins/antigravity-harness-core/`.
   - Validado estrictamente con `agy plugin validate`.
2. **Ciclo de Vida de 6 Fases Nativas:**
   - `SessionStart`: Inicialización de esquemas y verificación de estado.
   - `PreInvocation`: Inyección efímera de heurísticas activas (`ephemeralMessage`) logrando Zero-Prompt-Bloat sin contaminar el transcript.
   - `PreToolUse`: Sanitización en caliente de argumentos mediante `overwrite` y Circuit Breaker V9 con corte determinista `decision: "deny"`.
   - `PostToolUse`: Telemetría continua de herramientas y auto-curación silenciosa (`--auto-heal`).
   - `PostInvocation`: Inspección de flujos tras invocación.
   - `Stop`: Guardián de Quality Gate que bloquea terminaciones prematuras si las suites TDD o contratos SDD presentan fallas (máx 2 reintentos).
3. **Telemetría Persistente y Promoción Cross-Workspace:**
   - Base de datos SQLite en `${PLUGIN_DATA}/telemetry.db` con WAL mode.
   - Algoritmo empírico de promoción de heurísticas locales a globales basado en ratio de éxito (score ≥ 0.80 y ≥ 3 éxitos).

---

## 🔗 Playbooks de Agentes Relacionados
- [[.agents/skills/project-planner/SKILL.md|01. Project-Planner (Orquestador & Harness Director)]]
- [[.agents/skills/backend-architect/SKILL.md|02. Backend-Architect (VSA & SDD/TDD Specialist)]]
- [[.agents/skills/frontend-ui/SKILL.md|03. Frontend-UI (UI/UX & Dials Specialist)]]
- [[.agents/skills/systems-auditor/SKILL.md|04. Systems-Auditor (QA Gatekeeper & Arnés)]]
- [[.agents/skills/devops-engineer/SKILL.md|05. DevOps-Engineer (Release & Infra Specialist)]]
- [[DOC_Guia_Inicio_Rapido_y_Portabilidad_V9|00. Guía de Inicio Rápido, Portabilidad e Instalación Multi-Entorno V9]]
- [[DOC_Harness_Auto_Mejora_Recursiva|Arquitectura de Arnés Determinista y Auto-Mejora Tridimensional (Harness³)]]
- [[DOC_DIAG_Harness_Auto_Mejora.html|Diagrama Interactivo de Arquitectura Harness³]]
- [[.agents/models.yaml|SSoT de Tiers y Modelos de IA (.agents/models.yaml)]]
- [[.agents/skills/artifact-standards/SKILL.md|Guía Oficial de Estándares de Artefactos]]
- [[AGENTS.md|Protocolo General de Teamwork]]


