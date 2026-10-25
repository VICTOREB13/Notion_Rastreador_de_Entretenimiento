# Ecosistema de Agentes: Prototipado Evolutivo, Subagentes & Quality Gate (V7 Teamwork)

Hemos evolucionado la arquitectura de tus 5 agentes hacia el modelo **Orquestador-Subagentes (Teamwork)** de Google Antigravity. En lugar de alternar roles secuenciales en una misma ventana de chat (lo que saturaba el contexto y provocaba amnesia), ahora operamos con un **Agente Director/Orquestador** y un **Pool de Subagentes Especializados** con contextos aislados, comunicados a través de un **Bus Central de Artefactos** en disco, diagramas interactivos en HTML vía **Archify**, y herramientas **MCP de Testing y Contexto** (`playwright` y `context7`).

---

## 🧠 Matriz de Modelos de Inteligencia Artificial y Autoload Skills

Para maximizar la capacidad de razonamiento estratégico y la eficiencia en la ejecución técnica, se define la siguiente asignación:

| Agente / Rol | Tipo de Ejecución | Tier & Modelo Asignado | Autoload Skills Vitales |
| :--- | :--- | :--- | :--- |
| **Project-Planner** | **Agente Principal (Orquestador)** | **Tier Pro (High)** (`pro` / Gemini Pro High) | `archify`, `artifact-standards`, `improve-codebase-architecture`, `lean-ux` |
| **Backend-Architect** | **Subagente Autónomo** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `improve-codebase-architecture`, `sqlite-local-first-flutter`, `artifact-standards` |
| **Frontend-UI** | **Subagente Autónomo** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `ui-ux-pro-max`, `design-taste-frontend`, `refactoring-ui`, `redesign-existing-projects`, `vercel-react-best-practices`, `flutter-production-engineering`, `web-typography`, `microinteractions`, `top-design`, `design-everyday-things`, `artifact-standards` |
| **Systems-Auditor** | **Subagente Autónomo (QA)** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `ux-heuristics`, `vercel-react-best-practices`, `design-everyday-things`, `artifact-standards` |
| **DevOps-Engineer** | **Subagente Autónomo** | **Tier Flash (High)** (`flash` / Gemini Flash High) | `artifact-standards` |

---

## 👥 Resumen de Agentes y Dinámica de Subagentes

### 1. Project-Planner (El Orquestador Principal)
* **Rol:** Tech Lead y Orquestador General.
* **Modelo / Tier:** **Tier Pro (High)** (alias Antigravity: `pro`, Gemini Pro High; ver `.agents/models.yaml`).
* **Entorno:** Chat Principal / Mesa de Control.
* **Misión:** 
  * Recibir requerimientos del usuario y evaluar el alcance bajo **YAGNI** y **Lean UX**.
  * Traducir la necesidad en ciclos de **Prototipado Evolutivo**.
  * Definir el Tech Stack en `architecture.md`, generar el diagrama HTML interactivo con Archify, redactar `implementation_plan.md` y desglosar tareas en `task.md`.
  * **Spawning de Subagentes:** En lugar de codificar, lanza subagentes especializados pasándoles las tareas atómicas y supervisa su finalización.
* **Entregables:**
  * `artifacts/project_overview.md` (Índice y resumen principal)
  * `artifacts/architecture/architecture.md` (Tech Stack)
  * `artifacts/architecture/architecture_diagram.html` (Diagrama HTML Archify)
  * `artifacts/planning/implementation_plan.md` (Plan del ciclo actual)
  * `artifacts/planning/task.md` (Checklist y asignación de subagentes)
  * `artifacts/planning/changelog_vX.md` (Historial oficial versionado)

### 2. Backend-Architect (Subagente Especialista en Datos)
* **Rol:** Arquitecto de Base de Datos y Lógica de Negocio.
* **Modelo / Tier:** **Tier Flash (High)** (alias Antigravity: `flash`, Gemini Flash High; ver `.agents/models.yaml`).
* **Entorno:** Subagente en Contexto Aislado.
* **Principios Clave:** Cero N+1, protección contra IDOR, arquitectura SQLite local-first, consulta en `context7` MCP y protocolo **No Blind Fixes**.
* **Entregables:** `artifacts/architecture/api_spec.md`, `artifacts/architecture/abstractions.md` y código fuente backend.

### 3. Frontend-UI (Subagente Especialista Visual)
* **Rol:** Ingeniero de Interfaz y Experiencia de Usuario.
* **Modelo / Tier:** **Tier Flash (High)** (alias Antigravity: `flash`, Gemini Flash High; ver `.agents/models.yaml`).
* **Entorno:** Subagente en Contexto Aislado.
* **Principios Clave:** Límite estricto de DOM (< 800 nodos sugerido, máx 1400), carga de skills de diseño (`ui-ux-pro-max`, `design-taste-frontend`, `refactoring-ui`, `redesign-existing-projects`, `design-everyday-things`), rendimiento React/Next.js con `vercel-react-best-practices`, descomposición Flutter con `flutter-production-engineering`, inspección visual con Playwright MCP y consulta en `context7` MCP.
* **Entregables:** Código Frontend, Componentes modulares y estilos.

### 4. Systems-Auditor (Subagente Quality Gatekeeper)
* **Rol:** QA Imparcial, Auditor de Seguridad y DevSecOps.
* **Modelo / Tier:** **Tier Flash (High)** (alias Antigravity: `flash`, Gemini Flash High; ver `.agents/models.yaml`).
* **Entorno:** Subagente en Contexto Aislado (Garantiza cero sesgo del desarrollador).
* **Principios Clave:** Suites de pruebas automatizadas, auditoría Playwright E2E en navegador real, auditoría de dependencias (`npm audit` / `composer audit`), medición física de nodos del DOM (`document.querySelectorAll('*').length`), evaluación de heurísticas y psicología de diseño (`ux-heuristics`, `design-everyday-things`).
* **Entregables:** Suites de pruebas (`tests/...`) y `artifacts/audit_reports/audit_report.md` con el veredicto final (`veredicto: PASS` o `veredicto: FAIL`).

### 5. DevOps-Engineer (Subagente de Despliegue Controlado)
* **Rol:** Experto en Infraestructura y Contenedores.
* **Modelo / Tier:** **Tier Flash (High)** (alias Antigravity: `flash`, Gemini Flash High; ver `.agents/models.yaml`).
* **Entorno:** Subagente en Contexto Aislado.
* **Regla Estricta:** Solo se activa si `audit_report.md` tiene `veredicto: PASS`.
* **Entregables:** `docker-compose.yml`, `Dockerfile` y configuración CI/CD.

---

## 📂 Sistema de Archivos (Artifact-Driven Bus)

La memoria compartida del equipo no depende del historial del chat, sino de los archivos físicos en disco dentro de `artifacts/`:

```
📁 artifacts/
  📄 project_overview.md
  📁 architecture/
    📁 src/
      📄 architecture_diagram.json  <-- Fuente Archify
      📄 agent_orchestration_diagram.json
    📄 architecture.md
    🌐 architecture_diagram.html  <-- Compilado interactivo con Archify
    📄 api_spec.md
    📄 abstractions.md
  📁 planning/
    📄 implementation_plan.md
    📄 task.md
    📄 changelog_vX.md
  📁 audit_reports/
    📄 audit_report.md
```

---

## 🔄 Flujo de Orquestación con Subagentes (Teamwork)

Los diagramas estáticos en Mermaid han sido completamente deprecados en favor de diagramas HTML interactivos y autónomos generados con **Archify**.

🔗 **Ver Diagrama de Flujo Interactivo:** [[PRJ_Arquitectura_agent_orchestration_diagram.html|Abrir Diagrama de Orquestación de Agentes (HTML)]]

*(Ubicación física en el proyecto: `artifacts/architecture/agent_orchestration_diagram.html` | Fuente JSON: `artifacts/architecture/src/agent_orchestration_diagram.json`)*

### Resumen del Flujo por Fases:
1. **Fase 1: Plan Rápido (Disco):** `Project-Planner` (Tier Pro High, alias: `pro`) escribe `project_overview.md`, `architecture.md`, `implementation_plan.md`, `task.md` y `changelog_vX.md` y compila el diagrama Archify.
2. **Fases 2 & 3: Construcción Aislada:** Spawnea en contextos aislados bajo Tier Flash High (alias: `flash`) a `Backend-Architect` (diseña `api_spec.md`, formaliza `abstractions.md` y construye API) y `Frontend-UI` (maqueta vistas < 1400 nodos DOM).
3. **Fase 4: Quality Gate Imparcial:** Spawnea a `Systems-Auditor` (Tier Flash High, alias: `flash`) en un contexto 100% limpio para ejecutar pruebas con Playwright / Unit tests y emitir veredicto en `audit_report.md`.
   - Si `veredicto: FAIL`: Project-Planner reasigna en `task.md` y devuelve a construcción.
   - Si `veredicto: PASS`: Habilita la fase de despliegue.
4. **Fase 5: Despliegue:** Spawnea a `DevOps-Engineer` para empaquetar Docker y configurar servicios.
5. **Entrega:** Project-Planner presenta el prototipo funcional al usuario para recibir feedback y comenzar la siguiente iteración evolutiva.

---

## 🔗 Habilidades Base del Ecosistema
*(Ubicadas en `.agents/skills/`)*
- `project-planner/SKILL.md` (Orquestador Principal)
- `backend-architect/SKILL.md` (Subagente Backend)
- `frontend-ui/SKILL.md` (Subagente Frontend)
- `systems-auditor/SKILL.md` (Subagente Auditor QA)
- `devops-engineer/SKILL.md` (Subagente DevOps)
- `artifact-standards/SKILL.md` (Estándares de Artefactos y Prevención de Errores)


