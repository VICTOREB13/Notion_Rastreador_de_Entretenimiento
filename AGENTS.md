# Protocolo de Orquestación de Agentes y Subagentes (Arquitectura V9 Teamwork, SDLC Git-Native & Harness³ Plugin Ecosystem)

Este workspace opera bajo la **Arquitectura V9 de Agentes**, integrando el ciclo de **Prototipado Evolutivo**, el triángulo metodológico **SDD + TDD + ODD**, una **Pirámide de Testing Escalonada de 3 Niveles**, **Git Gates nativos con GitHub CLI (`gh`)**, la **Política de Artefactos Vivos vs. Deltas**, el plugin canónico **`antigravity-harness-core`** y el **Arnés de Auto-Mejora Tridimensional (Harness³)**.

---

## 1. Asignación de Modelos de IA y Autoload Skills
*(Centralizado en `.agents/models.yaml` como Single Source of Truth)*
* **Agente Principal (Chat / Orquestador):** Configurado en **Tier Pro (High)** (alias Antigravity: `pro`, Gemini Pro High).
  * Habilidad: `Project-Planner` (`.agents/skills/project-planner/SKILL.md`)
  * Autoload Skills: `archify`, `artifact-standards`, `improve-codebase-architecture`, `lean-ux`
* **Subagentes Autónomos:** Se ejecutan en contextos aislados bajo **Tier Flash (High)** (alias Antigravity: `flash`, Gemini Flash High):
  * `Backend-Architect` (`.agents/skills/backend-architect/SKILL.md`)
    * Autoload Skills: `improve-codebase-architecture`, `sqlite-local-first-flutter`, `artifact-standards`
  * `Frontend-UI` (`.agents/skills/frontend-ui/SKILL.md`)
    * Autoload Skills: `ui-ux-pro-max`, `design-taste-frontend`, `artifact-standards` (Especializadas bajo demanda: `refactoring-ui`, `redesign-existing-projects`, `vercel-react-best-practices`, `flutter-production-engineering`, `web-typography`, `microinteractions`, `top-design`, `design-everyday-things`)
  * `Systems-Auditor` (`.agents/skills/systems-auditor/SKILL.md`)
    * Autoload Skills: `ux-heuristics`, `vercel-react-best-practices`, `design-everyday-things`, `artifact-standards`
  * `DevOps-Engineer` (`.agents/skills/devops-engineer/SKILL.md`)
    * Autoload Skills: `artifact-standards`

---

## 2. Regla Fundamental de Ejecución (No Coding en Chat Principal)
1. El **Agente Principal (Project-Planner)** tiene estrictamente prohibido escribir código de producción, tests o dockerfiles directamente en el chat raíz.
2. Su función exclusiva es:
   - Investigar el repositorio y los issues/milestones de GitHub (`gh issue`, `gh milestone`).
   - Diseñar la arquitectura técnica en `artifacts/architecture/architecture.md` y compilar diagramas interactivos con `archify`.
   - Redactar el plan en `artifacts/planning/implementation_plan.md` bajo estricto principio YAGNI.
   - Desglosar las tareas atómicas en `artifacts/planning/task.md`.
   - Empaquetar y despachar **subagentes** bajo **Tier Flash (High)** (alias: `flash`) mediante el **Empaquetador de Contexto (`scripts/pack_task.ts`)**:
     ```powershell
     bun run pack:task --agent <rol> [--slice <nombre>] [--task <id>]
     ```
     *Garantía Anti-Bypass y Ahorro de Tokens:* Extrae quirúrgicamente la tarea atómica de `task.md`, los contratos de `api_spec.md`, las abstracciones de `abstractions.md` y las heurísticas activas de `learned_heuristics.md`, compilando un bloque Markdown ultra-denso (<100 líneas) para ejecución precisa desde el Turno 1.
   - Monitorear el progreso, gestionar el protocolo anti-loop y presentar los resultados finales al usuario.

---

## 3. Triángulo Metodológico V8: SDD + TDD + ODD

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                       TRIÁNGULO METODOLÓGICO: SDD + TDD + ODD EN AGENTES                         │
├──────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┤
│ 1. SDD (Spec-Driven Dev)     │ 2. TDD (Test-Driven Dev)        │ 3. ODD (Observability/Outcome)  │
├──────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ • Contrato formal previo en  │ • Fase Red -> Green -> Refactor │ • Código instrumentado desde el │
│   api_spec.md y              │   guiado por tests del slice.   │   origen (logs estructurados,   │
│   abstractions.md.           │ • Los tests se generan antes    │   tiempos, healthchecks /healthz│
│ • SDD Contract Drift Guard   │   o a la par del código.        │   y cero consultas N+1).        │
│   (lint_contracts.ts).       │ • El agente escribe el código   │ • Outcome verificable: nodos    │
│ • Define el "QUÉ" y las      │   mínimo para poner tests en    │   DOM (<800 warning, <1400 err),│
│   fronteras de Vertical      │   verde (runner nativo <500ms). │   cero errores en consola web.  │
│   Slice Architecture (VSA).  │                                 │                                 │
└──────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

1. **SDD (Spec-Driven Development) & Drift Guard Multi-Stack:**
   - Antes de programar, se formalizan contratos en `api_spec.md` y abstracciones en `abstractions.md`. Cada caso de uso se organiza bajo **Vertical Slice Architecture (VSA)** (`features/<slice>/`).
   - **SDD Multi-Stack Contract Drift Guard (`scripts/lint_contracts.ts`):** Linter determinista que audita la paridad estricta entre `api_spec.md` y las rutas en código fuente (TypeScript/Node, Flutter/Dart, PHP/Laravel y Python/FastAPI/Flask):
     ```powershell
     bun run lint:contracts [--slice <nombre>] [--allow-missing]
     ```
     Detecta contratos pendientes (declarados en spec pero sin código) y endpoints huérfanos (en código sin documentar en spec), emitiendo `{ "valid": boolean, "missing": string[], "orphans": string[] }` con exit code `0` (paridad) o `1` (drift). Se integra como paso obligatorio en `bun run validate`.
2. **TDD (Test-Driven Development - Framework & Stack Agnostic):** Las pruebas unitarias y de contrato se co-localizan con el slice (`<slice>.test.ts`, `<slice>_test.dart`, etc.) utilizando las herramientas nativas del stack (`bun test` / `vitest` en TypeScript, `flutter test` / `dart test` en Flutter, `pest` / `phpunit` en PHP, `pytest` en Python). Se programan antes de la lógica de negocio para validar el comportamiento esperado.
3. **ODD (Observability & Outcome-Driven Development):** Todo código incluye observabilidad nativa (logs estructurados, cero N+1 verificable). El outcome se audita contra presupuestos estrictos de DOM y flujos de usuario reales sin errores en consola.

---

## 4. Pirámide de Testing Escalonada de 3 Niveles

Para optimizar velocidad y consumo de tokens, no se ejecutan todas las pruebas en cada commit. Se implementa una pirámide de 3 niveles:

```
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
       /                     \ Ultra-rápidos (<500ms). Se ejecutan antes de cada commit.
      /───────────────────────\ Co-localizados en el Vertical Slice o directorio nativo. 0 tokens consumidos.
```

---

## 5. Git Gates y Flujo Multi-Agente Nativo

1. **Criterio de Selección: Ramas Secuenciales vs. Worktrees Efímeros:**
   - **Flujo Secuencial (Estándar por Defecto - 90% de las tareas):** Para iteraciones estándar donde el Planner despacha subagentes en serie (Planner -> Backend -> Frontend -> Systems-Auditor), se utiliza cambio secuencial de ramas en el mismo directorio (`git checkout agent/<dominio>` o `git checkout feat/issue-<id>`). Esto garantiza máxima simplicidad, elimina sobrecostos de disco y previene problemas de bloqueo de archivos (*file locking*) en Windows.
   - **Flujo Paralelo con `git worktree` Efímero (Exclusivo para Concurrencia Real):** Cuando el Planner despacha deliberadamente dos o más subagentes a trabajar de forma simultánea/concurrente en tareas independientes, se utiliza el CLI determinista `scripts/worktree.ts` (Pilar II de Automatización y Seguridad de Concurrencia en Windows 11). Este script automatiza la creación de ramas, el montaje de NTFS Directory Junctions (`mklink /J`) para dependencias pesadas (`node_modules`, `vendor`, `.dart_tool`, `.venv`) y el estado compartido del arnés (`_workspace`, `TOOL_COUNTER_FILE`), garantizando un desmontaje seguro y no-destructivo:
     ```powershell
     # 1. Crear worktree efímero con enlaces NTFS y arnés compartido
     bun scripts/worktree.ts add <dominio>        # ej. bun scripts/worktree.ts add backend

     # 2. Consultar worktrees activos y estado de junctions
     bun scripts/worktree.ts list

     # 3. Teardown seguro no-destructivo (desmonta junctions antes de remover el worktree)
     bun scripts/worktree.ts remove <dominio>     # ej. bun scripts/worktree.ts remove backend
     ```
     *Garantía No-Destructiva:* El comando `remove` desvincula primero todas las junctions NTFS mediante `fs.unlinkSync` / `rmdir` seguro, garantizando que el contenido original en el repositorio raíz **jamás** se borre recursivamente.
2. **Topología Canónica de Ramas:**
   - Ramas dedicadas: `main` (producción protegida con tags anotados), `develop` o `agent/<dominio>` (`agent/backend`, `agent/frontend`, `agent/audit`, `agent/devops`).
3. **Commits Atómicos Semánticos:**
   - `feat(backend): ...`, `feat(ui): ...`, `test(audit): ...`, `chore(release): ...`.
   - Commits de mejora del arnés: `chore(harness): ...`.
4. **Control Temprano por GitHub CLI (`gh`):**
   - **Creación Temprana de Issues y Milestones:** Al inicio del ciclo (junto con el SDD en la Fase 2), el Planner crea el Milestone (`gh milestone create`) y los Issues atómicos (`gh issue create`) para trazabilidad antes de que los subagentes comiencen a programar.
   - **Quality Gate Obligatorio en Pull Requests:** Pull Requests internos vinculados al issue (`gh pr create`, `gh pr review`) con aprobación certificada por `Systems-Auditor`.

---

## 6. Política de Artefactos Vivos vs. Deltas (Zero-Touch Policy)

Los artefactos del proyecto se dividen taxativamente en dos categorías para evitar duplicación y obsolescencia:

| Categoría | Archivos | Comportamiento en Iteraciones |
| :--- | :--- | :--- |
| **Artefactos Vivos (Living Artifacts)** | `artifacts/project_overview.md`<br>`artifacts/architecture/architecture.md`<br>`artifacts/architecture/abstractions.md`<br>`artifacts/architecture/api_spec.md`<br>`artifacts/architecture/design_system.md` | **SSoT Acumulativa:** No se versionan con sufijos (`_v2`, `_v3`). Se actualizan *in-place* manteniendo la fotografía fiel y completa del sistema actual. |
| **Deltas de Iteración (Iterative Deltas)** | `artifacts/planning/implementation_plan.md`<br>`artifacts/planning/task.md`<br>`artifacts/audit_reports/audit_report.md`<br>`artifacts/planning/changelog_vX.md` | **Historial y Guía de Ciclo:** Guían la iteración activa. Al finalizar el release, `changelog_vX.md` y `audit_report.md` quedan sellados como registro inmutable del ciclo. |

* **Regla Zero-Touch:** Todo subagente debe respetar la estructura existente de los artefactos vivos y solo aplicar modificaciones diferenciales congruentes con la especificación.

---

## 7. Protocolo Anti-Loop, Plugin Antigravity Core y Arnés de Auto-Mejora Harness³

1. **Protocolo Anti-Loop (Máximo 2 Reintentos):**
   - Si un subagente entra en un ciclo de pruebas fallidas y no resuelve el problema tras 2 reintentos, se impone **PAUSA OBLIGATORIA**.
   - Queda estrictamente prohibido aplicar "blind fixes" repetitivos o adivinar parches sin análisis riguroso.

2. **Semantic Circuit Breaker Determinista (`.agents/scripts/circuit_breaker.ts`):**
   Mecanismo programático y determinista ejecutado con Bun que intercepta la ejecución de herramientas para prevenir consumo descontrolado de tokens, alucinaciones en bucle y lecturas ciegas:
   - **Lista Blanca Inmutable de Salida (Zero-Lockout Guarantee):**
     Las herramientas nativas de Antigravity CLI para comunicación (`send_message`), creación de archivos (`write_to_file`) y modificación quirúrgica (`replace_file_content`), junto con sus alias de compatibilidad (`read_file`, `write_file`, `edit_file`, `ask_question`, `ask_permission`), **NUNCA** son bloqueadas bajo ninguna circunstancia. Esto garantiza que el agente siempre mantenga canales de comunicación abiertos con el usuario u otros agentes y conserve la capacidad de guardar su trabajo.
   - **Límite de Herramientas sin Validación TDD (In-Flight TDD Enforcer):**
     Monitorea en tiempo real `tools_since_last_test_runner`. Si se acumulan **14 llamadas consecutivas a herramientas** sin ejecutar un runner nativo de pruebas (`bun test`, `flutter test`, `pytest`, `pest`, `vitest`, `cargo test`, `go test`), el breaker bloquea preventivamente con:
     `"CIRCUIT_BREAKER_BLOCKED: Se han ejecutado 14 herramientas consecutivas sin validar la suite de pruebas. Aplique el ciclo TDD (Red -> Green -> Refactor) con el runner nativo ('bun test', 'flutter test', etc.) antes de continuar."`
     Al detectar la ejecución de cualquier runner de test, el contador se resetea a 0. La lista blanca inmutable y los propios runners nunca son bloqueados por este límite.
   - **Límite de Lecturas Secuenciales Ciegas (Blind Sequential Reads):**
     Máximo **12 lecturas consecutivas** con la herramienta nativa `view_file` (o el alias `read_file`) sin alternar con herramientas de búsqueda estructurada (`grep_search`, `find_by_name`, `list_dir`) o escritura. Al alcanzar la 13ª invocación, el breaker devuelve código de salida `1` (`{"decision":"block"}`) instruyendo el uso de búsquedas o la forja de un script de escaneo masivo por lotes (Regla 9: Offloading Mecánico).
   - **Detección de Fallos Repetitivos en Herramientas y MCPs:**
     Máximo **3 fallos consecutivos** en cualquier herramienta. Al tercer fallo consecutivo, la herramienta queda bloqueada preventivamente forzando la pausa obligatoria del Protocolo Anti-Loop para auditar el origen del fallo.
   - **Persistencia y Reseteo:**
     El estado se registra de forma atómica en `_workspace/tool_counter.json`. Se resetea automáticamente o mediante `circuit_breaker.ts --reset` / `scripts/agy-safe.ps1 -ResetOnly` al inicio de cada nueva tarea o slice.
   - **Integración Dual (Orca IDE & Consola CLI):**
     - **Orca IDE:** Hook nativo en `.agents/scripts/hooks/pre-tool-use.cmd`, conectado automáticamente con `~/.orca/agent-hooks/antigravity-hook.cmd`.
     - **Terminal Pura (`agy` / `agy -c`):** Wrapper PowerShell `scripts/agy-safe.ps1` que expone switches `-Reset`, `-ResetOnly` y `-Status` para auditoría en tiempo real.

3. **Destilación de Trazas de Sesión (`.agents/scripts/distill_session.ts`):**
   Mecanismo de observabilidad determinista que analiza las transcripciones (`transcript.jsonl`) y el historial en `conversation_summaries.db`:
   - Se ejecuta mediante `bun run .agents/scripts/distill_session.ts` al finalizar cada sesión o ante fallas del Quality Gate.
   - Genera el reporte ultracondensado `_workspace/friction_report.md` (<25 líneas) que extrae: turnos, frecuencia de uso por herramienta, conteo de fallos, ráfagas de lecturas consecutivas, alertas anti-loop y pre-clasificación ODD.
   - Provee diagnóstico inmediato con 0 desperdicio de tokens para consumo directo por el `Systems-Auditor`.

4. **Diagnóstico de Causa Raíz en `audit_report.md`:**
   El `Systems-Auditor` debe inspeccionar `_workspace/friction_report.md` y clasificar explícitamente el origen de cualquier fricción:
   - **Falla de Código (Code Defect):** Error de lógica, sintaxis o implementación en el slice. Se corrige en el código de la feature.
   - **Falla de Arnés (Harness Defect):** Especificación ambigua en `api_spec.md`, regla faltante o desalineada en `SKILL.md`, mock de test desactualizado, linter mal configurado o ráfagas de herramientas mal gestionadas.

5. **Bucle de Auto-Mejora del Arnés (Harness² Loop) y Presupuesto de Entropía:**
   - **Registro de Heurísticas Aprendidas:** Ante una falla de arnés, la lección aprendida se documenta en `.agents/skills/<skill>/rules/learned_heuristics.md`.
   - **Presupuesto de Entropía (Regla FIFO de 30 Líneas / 10 Reglas):** Cada archivo `learned_heuristics.md` tiene un límite duro inquebrantable de **30 líneas** y **10 reglas máximas** para prevenir la degradación acumulativa del contexto (*prompt drift*). Al ingresar la 11ª regla, la regla más antigua se purga automáticamente bajo política FIFO.
   - **Validación Determinista:** Se verifica con `bun .agents/skills/artifact-standards/scripts/validate_artifact.ts <archivo> --heuristics`.
   - **Commit Semántico de Arnés:** Se consolida la mejora en el repositorio:
     `git commit -m "chore(harness): <descripción de la mejora en el arnés>"`
   - De este modo, el arnés de desarrollo se auto-perfecciona iteración tras iteración sin costos computacionales redundantes ni sobrecarga de contexto.

6. **Arnés Tridimensional Nativo Harness³ (Plugin antigravity-harness-core):**
   - **Dimensión 1 (In-Flight Overwrite & Circuit Breaker V9):** Intercepción determinista en `PreToolUse` que reescribe argumentos malformados mediante `overwrite` (sanitización de rutas y normalización de comandos en Windows) y devuelve taxativamente `"decision": "deny"` ante violaciones de bucle o presupuesto TDD. En `PostToolUse` se persiste telemetría y se dispara `autoHealFromFailure()` silencioso.
   - **Dimensión 2 (Inyección Efímera Zero-Prompt-Bloat):** En `PreInvocation` se suministran heurísticas activas mediante el tipo `ephemeralMessage` en `injectSteps`, manteniendo el transcript limpio y evitando la degradación acumulativa del contexto.
   - **Dimensión 3 (Telemetría SQLite, Promoción Cross-Workspace & Stop Guardian):** Base de datos persistente en `${PLUGIN_DATA}/telemetry.db` para trazabilidad de firmas de error y efectividad de reglas. Algoritmo de promoción que eleva heurísticas locales a reglas globales (score ≥ 0.80, ≥ 3 éxitos). El hook `Stop` actúa como Quality Gate Guardián impidiendo la terminación con `"decision": "continue"` si existen fallas de contratos SDD o presupuesto TDD (limitado a máx 2 reintentos con guard de ciclos).

---

## 8. Integración de Servidores MCP y Tool Guidance

1. **`context7` MCP (Investigación Activa de Versiones y Dependencias):**
   - **Propósito y Poder (Enfoque Habilitador):** `context7` es la herramienta clave para mantener a la IA permanentemente actualizada sobre las distintas versiones de las dependencias que utiliza el proyecto. Permite investigar qué versión específica está en uso, descubrir nuevas características, funciones o llamadas implementadas en la última versión de un framework o lenguaje (ej. PHP 8.3+, Next.js 15, Flutter 3.x, Bun 1.x, Drizzle, etc.), prevenir APIs deprecadas y consultar sintaxis moderna exacta de forma quirúrgica, sin inflar la ventana de contexto con líneas y líneas de documentación innecesaria.
   - **Límite Preciso (Qué NO hacer):** La única restricción es no confundir `context7` con un buscador de archivos locales del repositorio. Queda estrictamente prohibido intentar buscar rutas internas, modelos, componentes o archivos propios del proyecto (como `src/...`, `features/...`, `lib/...`) en `context7`. Para el código del repositorio, se usan exclusivamente las herramientas locales (`grep_search`, `find_by_name`, `list_dir`, `view_file`).
2. **`playwright` MCP:** Utilizado por `Systems-Auditor` y `Frontend-UI` en el Nivel 3 de la pirámide de tests para inspección en navegadores reales, cálculo exacto de nodos DOM (`document.querySelectorAll('*').length`), screenshots y logs de consola.
3. **`obsidian` MCP (Opcional / Externo):** Si está instalado y configurado en el entorno local del usuario, mantiene la base de conocimiento y los playbooks sincronizados entre el entorno local y la bóveda en Obsidian (`read_note` y `write_note`). No forma parte de las herramientas base requeridas por defecto.

---

## 9. Protocolo de Tool Forging en Caliente (Offloading Mecánico)

1. **Umbral de Forja Mecánica (>6 Operaciones Idénticas):**
   - Si una tarea técnica exige más de 6 operaciones mecánicas idénticas (como transformaciones masivas de archivos, escaneos estáticos, parsing repetitivo de datos, validaciones de sintaxis o conversiones de formato), el subagente está **explícitamente facultado y obligado** a forjar un script determinista en `scripts/` (TypeScript con Bun, Python o Bash) antes de continuar.
2. **Principio "Scripts over Prompts" (Harness²):**
   - Razonar token por token sobre tareas mecánicas repetitivas o archivos extensos degrada la ventana de contexto, satura la atención del modelo y dispara el consumo de tokens.
   - El subagente debe escribir el script, ejecutarlo en el runner nativo para obtener una salida condensada (`{ "valid": boolean, "errors": string[] }` o resumen tabular) y razonar únicamente sobre ese resultado procesado.
3. **Persistencia y Promoción al Arnés:**
   - Si el script forjado resuelve una necesidad recurrente del ciclo de desarrollo (por ejemplo, validadores de artefactos, extractores de contratos o sanitizadores), debe guardarse en la subcarpeta `scripts/` de la skill correspondiente (`.agents/skills/<skill>/scripts/`) o en `scripts/` raíz del proyecto, consolidando la mejora con un commit semántico:
     `git commit -m "chore(harness): forge <nombre_script> for <propósito>"`

