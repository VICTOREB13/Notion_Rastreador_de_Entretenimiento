---
tipo: documentacion
estado: activo
version: V8 SDLC Git-Native
tags:
  - metodologia
  - prototipado-evolutivo
  - agentes
  - sdlc
  - subagentes
  - modelos
  - lean-ux
  - sdd
  - tdd
  - odd
  - vsa
  - harness2
---

# Metodología de Prototipado Evolutivo (V8: SDLC Git-Native, SDD+TDD+ODD & Harness²)

![Prototipado Evolutivo](IMG_Prototipado_Evolutivo.png)

El **Prototipado Evolutivo** es el corazón de este ecosistema de desarrollo multiagente. A diferencia de un ciclo en cascada o de sprints inflexibles, esta metodología se basa en construir sistemas funcionales rápidamente, evaluar los resultados con rigor matemático y evolucionar el código iteración tras iteración (v0.1, v0.2, v1.0).

La regla de oro de nuestra adaptación es: **Rápido no significa baja calidad.** Cortamos el alcance (*scope*), no las bases arquitectónicas ni las pruebas.

En la **Arquitectura V8**, el ciclo integra formalmente el triángulo metodológico **SDD + TDD + ODD**, la **Vertical Slice Architecture (VSA)**, una **Pirámide de Testing Escalonada de 3 Niveles**, **Git Gates** y el **Bucle de Auto-Mejora del Arnés (Harness²)**.

---

## 🔄 El Ciclo de 7 Fases en la Arquitectura V8

### 1. Comunicación (El Punto de Partida)
* **Actor Principal:** `Usuario` (Tú)
* **Descripción:** El ciclo inicia cuando planteas un objetivo o necesidad de negocio en el chat principal o se abre un Issue en GitHub (`gh issue`).
* **Transición:** Tu solicitud es procesada por el líder técnico en la Mesa de Control.

### 2. Plan Rápido y SDD Inicial (YAGNI & Lean UX)
* **Agente a cargo:** `[[AGENTE_01_Project_Planner|Project-Planner]]` (Orquestador Principal & Harness Director)
* **Modelo / Tier:** **Tier Pro (High)** (`pro` / Gemini Pro High; ver `[[DOC_Modelos_Tiers|.agents/models.yaml]]`)
* **Descripción:** El Planner divide el requerimiento en tareas atómicas (MVP). Aplica **YAGNI** (*You Aren't Gonna Need It*) y **Lean UX** (hipótesis testeables y métricas de éxito en lugar de documentación redundante). Actualiza los **Artefactos Vivos** (`project_overview.md`, `architecture.md`) in-place bajo la regla Zero-Touch, compila diagramas interactivos en HTML con Archify, define los deltas de planificación (`implementation_plan.md`, `task.md`, `changelog_vX.md`) y crea el Milestone e Issues en GitHub (`gh milestone create`, `gh issue create`).

### 3. Modelado Rápido y Contratos SDD
* **Agentes a cargo:** `[[AGENTE_02_Backend_Architect|Backend-Architect]]` y `[[AGENTE_03_Frontend_UI|Frontend-UI]]` (Subagentes Autónomos)
* **Modelo / Tier:** **Tier Flash (High)** (`flash` / Gemini Flash High)
* **Descripción:** Antes de programar, se formalizan los contratos. El Backend indexa los nuevos endpoints y modelos en los artefactos vivos `api_spec.md` y `abstractions.md`. El Frontend analiza la naturaleza de la pantalla: si es landing/marketing, declara su `Design Read` y Three Dials (`design-taste-frontend`); si es dashboard/software transaccional, adopta `ui-ux-pro-max`, `refactoring-ui` y planifica una estructura de DOM estricta (<800 nodos óptimo).

### 4. Construcción con VSA y TDD (Desarrollo Central en Subagentes)
* **Agentes a cargo:** `[[AGENTE_02_Backend_Architect|Backend-Architect]]` y `[[AGENTE_03_Frontend_UI|Frontend-UI]]` (Subagentes Autónomos)
* **Modelo / Tier:** **Tier Flash (High)** (`flash` / Gemini Flash High)
* **Descripción:** 
  - **Vertical Slice Architecture (VSA):** El Backend construye cada caso de uso en directorios autocontenidos (`src/features/<slice>/`).
  - **TDD (Test-Driven Development - Stack Agnostic):** Co-ubica `<slice>.test.ts` (o `<slice>_test.dart` en Flutter, `test_<slice>.py` en Python, etc.) junto a la ruta y el servicio, programando primero la validación del contrato (Red) y luego la lógica mínima para pasarlo en verde (<500ms o runner nativo: Bun, Flutter Test, Pest, pytest).
  - **Frontend UI:** Construye vistas modulares (<300 LoC por archivo) respetando las especificaciones de `api_spec.md`.
  - **ODD (Observability-Driven Development):** El código nace instrumentado con logs estructurados, tiempos de respuesta, `/healthz` y verificación de cero consultas N+1.
  - **Protocolo Anti-Alucinación (No Blind Fixes):** Prohibido adivinar fixes sin inspeccionar logs reales.

### 5. Quality Gate Piramidal y Diagnóstico de Causa Raíz
* **Agente a cargo:** `[[AGENTE_04_Systems_Auditor|Systems-Auditor]]` (Subagente Quality Gatekeeper)
* **Modelo / Tier:** **Tier Flash (High)** (`flash` / Gemini Flash High)
* **Descripción:** El Auditor somete el código a la **Pirámide de Testing Escalonada de 3 Niveles** (N1: unitarios rápidos <500ms, N2: smoke tests Playwright headless, N3: auditoría agéntica Playwright MCP para DOM exacto y consola).
* **Diagnóstico de Causa Raíz en `audit_report.md`:**
  - Ante cualquier falla, clasifica formalmente si es **Defecto de Código** (bug en el slice) o **Defecto de Arnés** (ambigüedad en specs, regla faltante en skill, linter desalineado).
  - **Protocolo Anti-Loop:** Si una tarea falla 2 veces consecutivas, se detiene la ejecución para evitar bucles ciegos. Si es defecto de arnés, se deriva a la fase de auto-mejora.
* **Veredicto:** Emite `veredicto: PASS` o `veredicto: FAIL`.

### 6. Bucle de Auto-Mejora Harness² y Pipeline de Release
* **Agentes a cargo:** `[[AGENTE_01_Project_Planner|Project-Planner]]` y `[[AGENTE_05_DevOps_Engineer|DevOps-Engineer]]`
* **Modelo / Tier:** **Tier Flash (High)** (`flash` / Gemini Flash High)
* **Descripción:**
  - **Si hay Defecto de Arnés:** Se actualizan las directivas, skills o prompts en `.agents/` y se consolida la mejora con un commit semántico `chore(harness): ...`.
  - **Con `veredicto: PASS`:** `DevOps-Engineer` ejecuta el **Pipeline Determinista de Release de 6 Pasos**:
    1. Pre-flight Quality Gate check.
    2. Inspección diferencial real (`git log` / `git diff`).
    3. Sincronización de manifiestos del proyecto.
    4. Redacción del changelog en 7 secciones estandarizadas (`changelog_vX.md`).
    5. Commit semántico (`chore(release): ...`) y tag anotado (`git tag -a vX.Y.Z`).
    6. Publicación automatizada en GitHub Releases vía `gh release create`.

### 7. Feedback e Integración Continua (El Motor de la Evolución)
* **Actor Principal:** `Usuario` (Tú)
* **Descripción:** Pruebas el entregable con el release oficial publicado. Tu retroalimentación nutre el siguiente ciclo evolutivo cerrando los issues resueltos y abriendo los nuevos del roadmap.

---

## 🛠️ Conclusión

La **Arquitectura V8** transforma el prototipado evolutivo en un motor de ingeniería de software determinista, rápido y blindado contra el *AI Slop*. La combinación de **VSA**, la **Pirámide de Testing de 3 Niveles**, los **Git Gates** y el bucle **Harness²** garantiza que el software y el entorno de agentes mejoren continuamente en cada iteración.
