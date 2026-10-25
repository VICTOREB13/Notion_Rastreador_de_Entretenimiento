@Project-Planner Actúa como Master Orchestrator (Tier Pro High, alias: pro). Inicia el ciclo de prototipado evolutivo para:
[Describe aquí tu requerimiento o feature, ej. 'Módulo de autenticación y facturación con Vertical Slice Architecture en Laravel/Bun/React'].

Sigue el protocolo de la Arquitectura V8 (SDD + TDD + ODD, Git Gates & Harness²):

1. **Planificación y SDD Inicial (Mesa de Control):**
   - Actualiza los artefactos vivos (`artifacts/project_overview.md`, `artifacts/architecture/architecture.md`) y compila el diagrama interactivo con Archify (`artifacts/architecture/architecture_diagram.html` con JSON en `artifacts/architecture/src/`).
   - Define el plan y tareas de la iteración (`artifacts/planning/implementation_plan.md`, `artifacts/planning/task.md`).
   - Si aplica, crea el Milestone y los Issues en GitHub usando `gh milestone create` y `gh issue create`.

2. **Despacho de Subagentes Especializados (Tier Flash High, alias: flash):**
   - **Backend-Architect:** Aplica Vertical Slice Architecture (VSA). Formaliza contratos en los artefactos vivos `artifacts/architecture/api_spec.md` y `artifacts/architecture/abstractions.md`. Genera el slice autocontenido (`features/<slice>/`), co-ubicando esquemas, lógica de negocio y tests TDD ejecutables en <500ms.
   - **Frontend-UI:** Consulta `api_spec.md` y define/mantiene el sistema de diseño vivo en `artifacts/architecture/design_system.md`. Para landing pages, declara `Design Read` y Three Dials (`design-taste-frontend`). Para dashboards/aplicaciones transaccionales, aplica presupuestos estrictos de DOM (<800 warning, <1400 fatal) con `ui-ux-pro-max`, `refactoring-ui` y `design-everyday-things`.

3. **Auditoría Imparcial con Pirámide de Testing de 3 Niveles (Systems-Auditor):**
   - Ejecuta: Nivel 1 (unitarios Bun <500ms), Nivel 2 (smoke tests deterministas headless Playwright), Nivel 3 (auditoría visual y DOM con Playwright MCP).
   - Genera `artifacts/audit_reports/audit_report.md` con Diagnóstico de Causa Raíz (Código vs. Arnés).
   - **Protocolo Anti-Loop:** Si un subagente falla 2 veces consecutivas, pausa la ejecución. Si la causa es un defecto del arnés (specs ambiguas o reglas de skill insuficientes), parchea el arnés con commit `chore(harness): ...` antes de reintentar el código.

4. **Pipeline de Release y Despliegue (DevOps-Engineer):**
   - Con `veredicto: PASS` obligatorio, ejecuta el pipeline de 6 pasos: diff real (`git log`/`git diff`), bump de versión en manifiestos, changelog de 7 secciones en `artifacts/planning/changelog_vX.md`, commit/tag anotado (`vX.Y.Z`) y publicación automática en GitHub Releases vía `gh release create`.
