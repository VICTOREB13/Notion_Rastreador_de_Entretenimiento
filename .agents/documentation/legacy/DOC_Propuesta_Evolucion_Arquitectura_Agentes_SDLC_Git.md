---
tipo: documentacion
proyecto: Arquitectura_Agentes_V8
version: v8.0.0-draft
estado: congelado
fecha: 2026-10-20
tags:
  - inbox
  - agentes
  - arquitectura
  - git
  - github-cli
  - devops
  - sdd
  - tdd
  - odd
  - antigravity
---

# 🧪 Borrador de Propuesta: Evolución de la Arquitectura de Agentes (Hacia V8 Git-Native & SDD+TDD+ODD)

> **Propósito del Borrador:** Cuestionar los fundamentos actuales del ecosistema [[DOC_Arquitectura_Agentes|V7 Teamwork]] en **Antigravity CLI**, evaluar si la capa de agentes con personalidades/skills separadas realmente aporta valor frente a la instanciación dinámica de tareas, y definir una hoja de ruta para transformar el flujo en una arquitectura **100% integrada con Git/GitHub (Ramas, PRs, Issues, Milestones y Releases)** que combine **SDD** con **TDD** y **ODD**.

**Ubicación:** `00_Inbox`  
**Autor:** Victor Esparragoza  
**Fecha:** 2026-10-20  
**Referencias Internas:** [[DOC_Arquitectura_Agentes|Arquitectura de Agentes V7]], [[AGENTE_AGENTS|Protocolo Teamwork]], [[AGENTE_05_DevOps_Engineer|Agente DevOps]], [[WIKI_Spec_Driven_Development|Spec-Driven Development (SDD)]], [[DOC_Estandares_Artefactos|Estándares de Artefactos]]

---

## 1. Cuestionamiento Fundacional: ¿Son Realmente Necesarios los "Agentes con Personalidad" o Bastan las Skills y Contratos de Tarea?

Antes de seguir escalando la arquitectura actual de 5 roles (`Project-Planner`, `Backend-Architect`, `Frontend-UI`, `Systems-Auditor`, `DevOps-Engineer`), es necesario plantear una crítica pragmática sobre cómo opera realmente el motor subyacente:

### 1.1 El Problema Observado en la Práctica con Antigravity CLI
1. **Agentes como "Envoltorios" de Skills:** En la arquitectura actual ([[WIKI_Agentes_Skills_Artifacts|Agentes, Skills y Artifacts]]), los agentes no son demonios persistentes independientes, sino **perfiles con personalidades e instrucciones personalizadas** que agrupan un conjunto de *skills* autocargadas.
2. **Instanciación Efímera en Antigravity CLI:** Cada vez que se despacha una tarea en Antigravity CLI, la herramienta **crea subagentes efímeros específicos para esa tarea puntual**.
3. **Omisión de Lectura de Skills (`Skill Bypass`):** Con frecuencia, el subagente instanciado al vuelo se enfoca directamente en resolver el prompt inmediato de la tarea y **ni siquiera lee ni carga las skills asignadas** en `.agents/models.yaml` o en su playbook, diluyendo el propósito de haber diseñado "personalidades" detalladas.

### 1.2 Preguntas Clave a Resolver
- ¿Vale la pena mantener la fricción cognitiva de 5 "personalidades" si el runtime crea agentes por tarea?
- ¿Qué pasaría si eliminamos el teatro de roles ("Actúa como el Arquitecto Backend...") y pasamos a **Prompts de Tarea Autocontenidos + Reglas de Validación Duras (Hard Gates)**?
- Si decidimos conservar agentes diferenciados, ¿qué debe cambiar para que su distinción sea **física y operativa** (ej. ramas de Git propias, permisos restringidos, tests bloqueantes) y no solo un cambio de nombre en el prompt?

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     DILEMA ARQUITECTÓNICO: ROLES NARRATIVOS VS. EJECUCIÓN REAL                   │
├────────────────────────────────────────────────┬─────────────────────────────────────────────────┤
│ Modelo Actual (V7 Teamwork - Basado en Roles)  │ Alternativa Evolucionada (V8 - Task & Git Gate) │
├────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
│ • 5 Agentes con "personalidad" y playbooks.    │ • Subagentes efímeros por tarea (nativo de CLI) │
│ • Dependencia de que el agente lea sus skills. │ • Inyección directa de reglas en el prompt/spec │
│ • Todos editan el mismo árbol de archivos.     │ • Aislamiento real por ramas Git / Worktrees.   │
│ • El cumplimiento depende de la "obediencia"   │ • El cumplimiento se fuerza con Git Hooks,      │
│   del LLM al prompt del personaje.             │   suites TDD previas y PRs con Quality Gate.    │
└────────────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

### 1.3 Tres Caminos Posibles para la Arquitectura Base
1. **Camino A — Simplificación Radical (Task-Driven + Context Injection):** Descartar las personalidades. El Orquestador inyecta directamente en el prompt de cada tarea atómica el fragmento exacto del estándar técnico aplicable (de `api_spec.md`, reglas de UI `< 1400 nodos DOM`, límite `< 300 LoC`), sin esperar a que el subagente invoque lecturas secundarias de skills.
2. **Camino B — Agentes Operativos Atados a Git (Git-Bound Agents):** Mantener la división funcional (`backend`, `frontend`, `audit`, `devops`), pero eliminar el relleno de "personalidad" y convertir cada agente en un **operador de una rama específica de Git** con entregables verificables por CLI (`git diff`, tests en verde, PR abierto).
3. **Camino C — Modelo Híbrido (Skills Bajo Demanda + Hard Linter/CI Local):** Reducir las skills a micro-checklists inyectables y trasladar las reglas estrictas a scripts verificadores locales (pre-commit / CI local) que rechacen el trabajo del subagente si incumple las normas.

---

## 2. Arquitectura de Agentes Conectada Nativamente con Git (Git-Flow Multi-Agente)

Hoy los subagentes modifican el directorio de trabajo sobre una misma rama activa, lo que dificulta trazar qué agente rompió qué componente o revertir cambios parciales. La propuesta es pasar a un **flujo de ramas especializadas por dominio/agente**:

### 2.1 Topología de Ramas Propuesta

```
main (Producción / Releases Estables con Tag vX.Y.Z)
 │
 └──► develop / integration (Rama de convergencia de la iteración)
       ├──► agent/backend   (Modelos, migraciones, controladores, api_spec.md)
       ├──► agent/frontend  (Vistas, componentes, estados UI, Playwright checks)
       ├──► agent/audit     (Suites de tests unitarios/E2E, audit_report.md)
       └──► agent/devops    (Docker, CI/CD, bump de versión, changelog y release)
```

*(Variante por feature/issue: `feat/issue-12-backend`, `feat/issue-12-frontend`, convergiendo en el PR del feature).*

### 2.2 Flujo Operativo en Git por Subagente
1. **Aislamiento de Cambios (Branching o `git worktree`):**
   - Cada subagente realiza checkout a su rama (`agent/backend`, `agent/frontend`, etc.) o trabaja sobre un **`git worktree` separado** si se requiere ejecución paralela real sin colisiones en el índice de Git.
2. **Commits Atómicos y Estandarizados:**
   - Cada subagente hace `git add` y `git commit` exclusivamente de los archivos de su competencia siguiendo **Conventional Commits** (`feat(backend): ...`, `feat(ui): ...`, `test(audit): ...`, `chore(release): ...`).
3. **Integración y Merge Controlado:**
   - Al concluir las fases de construcción y pasar la auditoría en la rama de pruebas, los cambios se unen (`git merge --no-ff` o Squash/Rebase vía Pull Request) hacia la rama principal, culminando con `git push`, `git tag` y publicación del release.

---

## 3. Estandarización del Agente DevOps: Automatización de Releases Comprensibles

En proyectos recientes del ecosistema (especialmente la arquitectura y releases de **`App-Game-Tracker`**), se logró pulir el apartado de **Releases** para que cualquier persona o desarrollador entienda de un vistazo **qué cambió exactamente de una versión a otra**, por qué se hizo y qué impacto tiene.

### 3.1 Evaluación Arquitectónica: ¿Nueva Skill o Integración en Skills Existentes?
- **Decisión:** **No se requiere una nueva skill independiente.**
- **Justificación:** Crear una skill adicional separada (ej. `release-automation`) aumentaría la fragmentación y el riesgo de *Skill Bypass*. En su lugar, la capacidad pertenece de forma natural y canónica a:
  1. **`.agents/skills/artifact-standards/SKILL.md`:** Define el contrato formal, categorías (`Added & Modularized`, `Refactored & Enhanced`, `Removed & Optimized (Anti-Slop)`, `Fixed & Enhanced`, `Modernized & Upgraded`, `Quality Gate & DevOps`, `Security`), métricas obligatorias y esquema de `artifacts/planning/changelog_vX.md`.
  2. **`.agents/skills/devops-engineer/SKILL.md`:** Ejecuta el pipeline determinista de 6 pasos (verificación de Quality Gate PASS, inspección diferencial de commits, sincronización de manifiestos, generación de changelog, commit/tag anotado y publicación en GitHub Releases con `gh release create`).
  3. **`.agents/skills/backend-architect/SKILL.md`:** Provee el diferencial técnico de APIs, migraciones y modelos, coordinando el versionado con DevOps.

### 3.2 Qué Debe Ejecutar `DevOps-Engineer` de Forma Nativa con Git y GitHub CLI (`gh`)
Cuando el Quality Gate (`audit_report.md`) emita `veredicto: PASS`, el agente [[AGENTE_05_DevOps_Engineer|DevOps-Engineer]] ejecuta un pipeline determinista de 6 pasos de cierre de versión:

1. **Verificación Previa de Quality Gate:** Inspección de `artifacts/audit_reports/audit_report.md` con veredicto obligatorio `PASS`. Si es `FAIL`, se aborta la release.
2. **Verificación del Diferencial Real (`git log` & `git diff`):** Comparar el último tag semántico contra el estado actual (`git log <prev_tag>..HEAD --oneline` y `git diff <prev_tag>..HEAD --stat`) para asegurar trazabilidad total.
3. **Sincronización de Manifiestos:** Bump de versión unificado en `pubspec.yaml`, `package.json`, `composer.json`, `pyproject.toml`, `README.md` y `PROJECT.md`.
4. **Redacción Estructurada de Changelog (`artifacts/planning/changelog_vX.md`):** Redacción bajo el estándar de `App-Game-Tracker` con secciones semánticas, métricas cuantitativas (% LoC, tests aprobados, bytes depurados), rutas exactas de archivos y cero AI Slop.
5. **Commit y Tag Semántico Anotado:** `chore(release): bump version to vX.Y.Z (Descriptor)` y `git tag -a vX.Y.Z -m "Release vX.Y.Z: Descriptor"`, seguido de `git push origin <branch> --tags`.
6. **Publicación Automatizada en GitHub Releases (`gh release create`):** Invocar `gh release create vX.Y.Z --title "[Nombre] vX.Y.Z ([Descriptor])" --notes-file release_notes.md [assets]` con el cuerpo estructurado espejo del changelog.

---

## 4. Inmersión Profunda en el Ecosistema Git / GitHub (`gh` CLI)

Más allá de usar Git solo para guardar código al final del día, la meta es que la arquitectura de agentes utilice **todo el ecosistema de gestión de código de Git/GitHub** como su sistema nervioso:

| Capacidad del Ecosistema Git/GitHub | Rol / Agente Responsable | Implementación Práctica con `git` / `gh` CLI |
| :--- | :--- | :--- |
| **Milestones (Hitos de Versión)** | `Project-Planner` | Crear un Milestone en GitHub por cada iteración MVP (`v1.5.0`) para agrupar el alcance completo del ciclo. |
| **Issues Atómicos Auto-generados** | `Project-Planner` / `Systems-Auditor` | Convertir las tareas de `task.md` o los hallazgos de un `audit_report.md` fallido en Issues reales (`gh issue create --title "..." --label "bug,backend" --milestone "v1.5.0"`). |
| **Resolución Trazable de Issues** | `Backend` / `Frontend` | Vincular cada rama y commit al Issue correspondiente (`feat(api): add pagination (Closes #42)`). |
| **Pull Requests (PRs) Internos** | Todos los Subagentes | En lugar de fusionar a ciegas en local, el subagente sube su rama y abre un PR (`gh pr create --base develop --head agent/backend`) detallando contratos y pruebas. |
| **Code Review & Quality Gate en PR** | `Systems-Auditor` | El auditor revisa el diff del PR (`gh pr diff`), ejecuta Playwright/tests y emite el dictamen formal en el PR (`gh pr review --approve` o `--request-changes`). |

---

## 5. Evolución Metodológica: Compaginar SDD con TDD y ODD

Actualmente el flujo de trabajo se apoya fuertemente en **[[WIKI_Spec_Driven_Development|SDD (Spec-Driven Development)]]**: primero se definen los contratos y artefactos (`architecture.md`, `api_spec.md`, `abstractions.md`) y luego se construye el software. El siguiente paso evolutivo es fusionar **SDD + TDD + ODD** en un único ciclo continuo:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                       TRIÁNGULO METODOLÓGICO: SDD + TDD + ODD EN AGENTES                         │
├──────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┤
│ 1. SDD (Spec-Driven Dev)     │ 2. TDD (Test-Driven Dev)        │ 3. ODD (Observability/Outcome)  │
├──────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ • Contrato formal previo en  │ • Antes de escribir la lógica,  │ • El código nace instrumentado  │
│   api_spec.md y              │   se generan los tests que      │   (logs estructurados, métricas,│
│   abstractions.md.           │   validan el contrato SDD.      │   healthchecks, telemetría UI). │
│ • Define el "QUÉ" y las      │ • Ciclo Red -> Green -> Refactor│ • Valida el "COMPORTAMIENTO EN  │
│   fronteras entre módulos.   │   guiado por tests reales.      │   VIVO" y el resultado final.   │
└──────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

### 5.1 SDD + TDD (Spec-to-Test First)
- **Problema actual:** `Systems-Auditor` entra en la Fase 4 (después de que Backend y Frontend ya escribieron todo el código). Si hubo una mala interpretación de la spec, se descubre tarde.
- **Mejora con TDD:**
  1. Se aprueba `api_spec.md` y `abstractions.md` (**SDD**).
  2. Antes o al inicio de la implementación, se escriben las **pruebas de contrato y tests unitarios/E2E fallidos (Fase Red)** basados estrictamente en la especificación.
  3. El agente constructor (`Backend` / `Frontend`) tiene una meta objetiva y determinista: **escribir el código mínimo y limpio (MVC / `< 300 LoC`) hasta que la suite de pruebas pase en verde (Fase Green)**.

### 5.2 Integración con ODD (Doble Vertiente: Observability + Outcome-Driven Development)
1. **Observability-Driven Development (Observabilidad desde el Diseño):**
   - Exigir que cada endpoint, servicio o proceso crítico incluya desde su creación **logs estructurados, trazas de error claras, tiempos de respuesta y endpoints de salud (`/health`)**.
   - Permite que el agente auditor no solo revise si un test sintético pasa, sino que inspeccione los logs de ejecución y el estado de memoria/consultas SQL (cero N+1 verificable en logs) durante las pruebas con Playwright MCP.
2. **Outcome-Driven Development (Orientado a Resultados Verificables):**
   - Cada feature o Issue debe definir su **criterio de éxito medible (Outcome)** antes de programarse: presupuesto de nodos DOM (`< 800` ideal, `< 1400` máximo), tiempo de carga, cero errores en consola del navegador y flujo de usuario completado de extremo a extremo.

---

## 6. Próximos Pasos y Preguntas Abiertas para Definir la V8

- [ ] **Auditar el comportamiento real de Antigravity CLI con las Skills:** Verificar mediante pruebas controladas cuándo lee `.agents/` y cuándo ignora las skills en subagentes efímeros, para decidir si migrar a **inyección directa por prompt de tarea** o mantener playbooks ligeros.
- [x] **Prototipar el flujo de ramas por agente (`agent/backend`, `agent/frontend`, `agent/devops`):** Formalizado criterio definitivo en `AGENTS.md`, `devops-engineer/SKILL.md` y `project-planner/SKILL.md`: Flujo secuencial de ramas (`git checkout agent/<dominio>`) como estándar predeterminado (90% de tareas en serie) para máxima simplicidad y cero fricción de disco; escalado a `git worktree` efímero con Directory Junctions NTFS (`mklink /J`) exclusivamente para concurrencia real entre subagentes paralelos con teardown obligatorio (`git worktree remove`).
- [x] **Estandarización de Releases & Changelogs (Integrado en DevOps y Artifact Standards):** Consolidado directamente en `.agents/skills/devops-engineer/SKILL.md` y `.agents/skills/artifact-standards/SKILL.md` bajo el estándar battle-tested de `App-Game-Tracker` (secciones semánticas, métricas LoC/tests, pre-flight Quality Gate y `gh release create`), descartando la creación de skills redundantes.
- [x] **Rediseñar el ciclo de vida en `DOC_Arquitectura_Agentes.md` y `DOC_Metodologia_Prototipado_Evolutivo.md`:** Integrado el ciclo formal de 7 fases con creación temprana de Milestones e Issues vía GitHub CLI (`gh milestone create`, `gh issue create`) en la Fase 2 (Plan Rápido & SDD) y adelanto mandatorio de tests TDD co-localizados (`<slice>.test.ts`, Red -> Green) en la Fase 4 antes de escribir la lógica del slice.
