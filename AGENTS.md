# Protocolo de Orquestación de Agentes y Subagentes (Arquitectura V8 Teamwork & SDLC Git-Native)

Este workspace opera bajo la **Arquitectura V8 de Agentes**, integrando el ciclo de **Prototipado Evolutivo**, el triángulo metodológico **SDD + TDD + ODD**, una **Pirámide de Testing Escalonada de 3 Niveles**, **Git Gates nativos con GitHub CLI (`gh`)**, la **Política de Artefactos Vivos vs. Deltas**, el **Protocolo Anti-Loop** y el **Bucle de Auto-Mejora del Arnés (Harness²)**.

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
    * Autoload Skills: `ui-ux-pro-max`, `design-taste-frontend`, `refactoring-ui`, `redesign-existing-projects`, `vercel-react-best-practices`, `flutter-production-engineering`, `web-typography`, `microinteractions`, `top-design`, `design-everyday-things`, `artifact-standards`
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
   - Despachar **subagentes** bajo **Tier Flash (High)** (alias: `flash`) para cada tarea técnica.
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
│ • Define el "QUÉ" y las      │   o a la par del código.        │   y cero consultas N+1).        │
│   fronteras de Vertical      │ • El agente escribe el código   │ • Outcome verificable: nodos    │
│   Slice Architecture (VSA).  │   mínimo para poner tests en    │   DOM (<800 warning, <1400 err),│
│                              │   verde (runner nativo <500ms). │   cero errores en consola web.  │
└──────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

1. **SDD (Spec-Driven Development):** Antes de programar, se formalizan contratos en `api_spec.md` y abstracciones en `abstractions.md`. Cada caso de uso se organiza bajo **Vertical Slice Architecture (VSA)** (`features/<slice>/`).
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
   - **Flujo Paralelo con `git worktree` Efímero (Exclusivo para Concurrencia Real):** Cuando el Planner despacha deliberadamente dos o más subagentes a trabajar de forma simultánea/concurrente en tareas independientes, se utiliza `git worktree` complementado con NTFS Directory Junctions (`mklink /J`) para compartir dependencias (`node_modules`, `vendor`, `.dart_tool`) sin duplicar gigabytes ni bloquear el índice de Git:
     ```powershell
     git worktree add ..\worktree-<dominio> agent/<dominio>
     cmd /c mklink /J "..\worktree-<dominio>\node_modules" ".\node_modules"
     ```
     Al concluir la tarea y mergear los cambios, se ejecuta el teardown obligatorio: `git worktree remove ..\worktree-<dominio>`.
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

## 7. Protocolo Anti-Loop y Bucle de Auto-Mejora Harness²

1. **Protocolo Anti-Loop (Máximo 2 Reintentos):**
   - Si un subagente entra en un ciclo de pruebas fallidas y no resuelve el problema tras 2 reintentos, se impone **PAUSA OBLIGATORIA**.
   - Queda prohibido aplicar "blind fixes" repetitivos.
2. **Diagnóstico de Causa Raíz en `audit_report.md`:**
   El `Systems-Auditor` debe clasificar explícitamente el origen del fallo:
   - **Falla de Código (Code Defect):** Error de lógica o implementación en el slice. Se corrige en el código de la feature.
   - **Falla de Arnés (Harness Defect):** Especificación ambigua en `api_spec.md`, regla faltante o desalineada en `SKILL.md`, mock de test desactualizado, o linter mal configurado.
3. **Bucle de Auto-Mejora del Arnés (Harness² Loop):**
   - Cuando se detecta una falla de arnés, se actualiza el componente afectado (`.agents/`, skills, playbooks o prompts).
   - Se consolida la mejora del entorno con un commit semántico:
     `git commit -m "chore(harness): <descripción de la mejora en el arnés>"`
   - De este modo, el arnés de desarrollo se auto-perfecciona iteración tras iteración sin costos computacionales redundantes.

---

## 8. Integración de Servidores MCP
* **`context7` MCP:** Obligatorio para todos los agentes. Consulta la documentación oficial actualizada (`resolve-library-id` y `query-docs`) de cualquier framework, ORM, SDK o biblioteca antes de codificar o planificar.
* **`playwright` MCP:** Utilizado por `Systems-Auditor` y `Frontend-UI` en el Nivel 3 de la pirámide de tests para inspección en navegadores reales, cálculo exacto de nodos DOM (`document.querySelectorAll('*').length`), screenshots y logs de consola.
* **`obsidian` MCP:** Mantiene la base de conocimiento y los playbooks sincronizados entre el entorno local y la bóveda en Obsidian (`read_note` y `write_note`).
