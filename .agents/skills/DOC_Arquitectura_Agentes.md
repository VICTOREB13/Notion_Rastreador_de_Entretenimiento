---
tipo: playbook
estado: activo
version: V8 SDLC Git-Native
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
  - git-gates
---

# Ecosistema de Agentes: Arquitectura V8 (SDLC Git-Native, SDD+TDD+ODD & Harness²)

Hemos consolidado la **Arquitectura V8 de Agentes**, transformando el modelo multiagente en un sistema **100% integrado con Git/GitHub CLI (`gh`)**, articulado por el triángulo metodológico **SDD + TDD + ODD**, estructurado mediante **Vertical Slice Architecture (VSA)**, respaldado por una **Pirámide de Testing Escalonada de 3 Niveles**, la **Política de Artefactos Vivos vs. Deltas (Zero-Touch)**, el **Criterio de Ramas Secuenciales vs. Worktrees Efímeros**, el **Protocolo Anti-Loop** y el **Bucle de Auto-Mejora del Arnés (Harness²)**.

---

## 🧠 1. Matriz de Modelos de Inteligencia Artificial y Autoload Skills
*(Centralizado en `[[DOC_Modelos_Tiers|.agents/models.yaml]]` como Single Source of Truth)*

| Agente / Rol | Tipo de Ejecución | Tier & Modelo Asignado | Autoload Skills Vitales |
| :--- | :--- | :--- | :--- |
| **[[AGENTE_01_Project_Planner\|Project-Planner]]** | **Agente Principal (Orquestador & Harness Director)** | **Tier Pro (High)** (`pro` / Gemini Pro High) | `archify`, `artifact-standards`, `improve-codebase-architecture`, `lean-ux` |
| **[[AGENTE_02_Backend_Architect\|Backend-Architect]]** | **Subagente Autónomo (VSA & SDD/TDD)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `improve-codebase-architecture`, `sqlite-local-first-flutter`, `artifact-standards` |
| **[[AGENTE_03_Frontend_UI\|Frontend-UI]]** | **Subagente Autónomo (UI/UX & Dials)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `ui-ux-pro-max`, `design-taste-frontend`, `refactoring-ui`, `redesign-existing-projects`, `vercel-react-best-practices`, `flutter-production-engineering`, `web-typography`, `microinteractions`, `top-design`, `design-everyday-things`, `artifact-standards` |
| **[[AGENTE_04_Systems_Auditor\|Systems-Auditor]]** | **Subagente Autónomo (QA Gatekeeper & Arnés)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `ux-heuristics`, `vercel-react-best-practices`, `design-everyday-things`, `artifact-standards` |
| **[[AGENTE_05_DevOps_Engineer\|DevOps-Engineer]]** | **Subagente Autónomo (Release & Infra)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `artifact-standards` |

---

## 📐 2. Triángulo Metodológico V8: SDD + TDD + ODD

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

## 🔄 3. El Ciclo de 7 Fases en la Arquitectura V8 (SDLC Git-Native)

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

## 🔄 8. Protocolo Anti-Loop y Bucle de Auto-Mejora Harness²

1. **Protocolo Anti-Loop (Máximo 2 Reintentos):** Si un subagente no logra pasar sus pruebas tras 2 reintentos consecutivos, se impone **PAUSA OBLIGATORIA**. Prohibido aplicar parches a ciegas.
2. **Diagnóstico de Causa Raíz en `audit_report.md`:** `Systems-Auditor` clasifica obligatoriamente si el fallo es **Defecto de Código** (bug en el slice) o **Defecto de Arnés** (especificación ambigua en `api_spec.md`, regla faltante en `SKILL.md`, mock desfasado o linter descalibrado).
3. **Bucle de Auto-Mejora del Arnés (Harness² Loop):** Al detectarse un defecto de arnés, se corrige el componente de configuración afectado (`.agents/`, prompts o skills) y se consolida con commit semántico dedicado:
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

## 🔗 Playbooks de Agentes Relacionados
- [[AGENTE_01_Project_Planner|01. Project-Planner (Orquestador & Harness Director)]]
- [[AGENTE_02_Backend_Architect|02. Backend-Architect (VSA & SDD/TDD Specialist)]]
- [[AGENTE_03_Frontend_UI|03. Frontend-UI (UI/UX & Dials Specialist)]]
- [[AGENTE_04_Systems_Auditor|04. Systems-Auditor (QA Gatekeeper & Arnés)]]
- [[AGENTE_05_DevOps_Engineer|05. DevOps-Engineer (Release & Infra Specialist)]]
- [[DOC_Modelos_Tiers|SSoT de Tiers y Modelos de IA (.agents/models.yaml)]]
- [[DOC_Estandares_Artefactos|Guía Oficial de Estándares de Artefactos]]
- [[AGENTE_AGENTS|Protocolo General de Teamwork]]
