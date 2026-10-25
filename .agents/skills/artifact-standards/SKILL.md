---
name: artifact-standards
description: >-
  Enforce strict YAML frontmatter schemas, file structures, Obsidian wikilink conventions,
  system code abstractions (abstractions.md), and Archify HTML diagram integration across all project artifacts
  (overview, architecture, abstractions, api_spec, implementation_plan, task, changelog, audit_report).
  Prevents typing errors, schema mismatches, and broken references.
auto_load_skills: []
permissions:
  browser: false
  terminal: false
  file_system: read_write
---

# Artifact Standards & Schema Enforcement (Anti-Typo Protocol)

This skill defines the **canonical, non-negotiable specification** for all Markdown and HTML artifacts generated in the workspace. All agents—especially `Project-Planner`, `Backend-Architect`, `Frontend-UI`, and `Systems-Auditor`—must adhere to these schemas to guarantee interoperability, zero typos, and seamless synchronization with Obsidian and CI/CD pipelines.

### 📚 Ecosistema Canónico de Artefactos Regulados

#### 🟢 Artefactos Vivos (Perpetuos / SSoT - Zero-Touch en Patch/Minor)
1. **`artifacts/project_overview.md`** (`tipo: overview`) - Visión general del proyecto, índice de navegación oficial y SSoT de la versión global.
2. **`artifacts/architecture/architecture.md`** (`tipo: arquitectura`) - Tech Stack oficial, límites de componentes y enlace al diagrama interactivo Archify.
3. **`artifacts/architecture/architecture_diagram.html`** - Diagrama interactivo SVG compilado con Archify (especificación fuente en `artifacts/architecture/src/architecture_diagram.json`).
4. **`artifacts/architecture/api_spec.md`** (`tipo: api_spec`) - Especificación de endpoints y modelos de datos (índice alto nivel complementado por Vertical Slice).
5. **`artifacts/architecture/abstractions.md`** (`tipo: abstracciones`) - **Abstracciones del Sistema y Arquitectura de Código** (interfaces de dominio, clases maestras, servicios de negocio, funciones puras y data seams).
6. **`artifacts/architecture/design_system.md`** (`tipo: design_system`) - **Sistema de Diseño y Tokens Visuales** (UI/UX, paleta semántica dark/light, tipografía corporativa Satoshi/Outfit/Inter, arquitectura de componentes modulares <300 LoC, microinteracciones y presupuesto de DOM <800/<1400).

#### 🟡 Artefactos Delta (Efímeros / Específicos de Iteración)
7. **`artifacts/planning/implementation_plan.md`** (`tipo: implementation_plan`) - Plan de iteración MVP (YAGNI, SDD & TDD).
8. **`artifacts/planning/task.md`** (`tipo: task_list`) - Checklist de tareas atómicas asignadas por agente (`[ ] (Nombre-Agente) Descripción`).
9. **`artifacts/planning/changelog_vX.md`** (`tipo: changelog`) - Historial versionado de cambios y releases (congelado por versión mayor).
10. **`artifacts/audit_reports/audit_report.md`** (`tipo: audit_report`) - Reporte de Quality Gate y veredicto vinculante (`veredicto: PASS` o `FAIL`).
11. **`03_Playbooks_QA/AGENTE_*.md`** (`tipo: playbook-agente`) - Playbooks de agentes con propiedades nativas para Obsidian Properties.

---

## 🛑 Golden Rules of Artifact Authoring

1. **Mandatory YAML Frontmatter:** Every `.md` artifact MUST start on line 1 with `---` and terminate the frontmatter with `---`. No text, blank lines, or comments may precede the frontmatter.
2. **Strict Field Casing:** All frontmatter keys MUST be strictly lowercased: `tipo`, `proyecto`, `version`, `iteracion`, `estado`, `fecha`, `veredicto`, `stack_principal`, `tags`.
3. **Strict Values:**
   - `tipo`: Strictly lowercase snake_case standard type (`overview`, `arquitectura`, `api_spec`, `abstracciones`, `design_system`, `implementation_plan`, `task_list`, `changelog`, `audit_report`).
   - `veredicto`: Strictly `PASS` or `FAIL` (uppercase).
   - `estado`: Strictly `activo`, `borrador`, `completado`, or `congelado`.
   - `fecha`: Strictly ISO format `YYYY-MM-DD` (e.g., `2026-09-08`).
   - `tags`: YAML array of lowercase kebab-case strings (e.g., `[proyecto, arquitectura, abstracciones, tech-stack]`).
4. **Obsidian-Compliant Wikilinks:**
   - In any index or cross-referencing document, links to other artifacts MUST follow the format:
     `[[PRJ_{PROYECTO}_{artefacto}|{Alias}]]`
     *Examples:* `[[PRJ_App_Food_Tracker_architecture|Arquitectura del Sistema]]`, `[[PRJ_App_Food_Tracker_abstractions|Abstracciones]]`
   - **STRICTLY PROHIBITED:** Hardcoded local file paths (e.g., `file:///C:/...`, `../planning/task.md`).
5. **No Mermaid Diagrams (Archify HTML Only & Source JSON Separation):**
   - Code blocks with ````mermaid are **STRICTLY BANNED**.
   - All architecture diagrams, component diagrams, request lifecycles, and workflows must be authored as standalone, interactive HTML files with inline SVG generated via **Archify** (e.g., `artifacts/architecture/architecture_diagram.html`).
   - **Source JSON vs Compiled HTML Convention:**
     - Archify source JSON files (candidate specifications) MUST be stored in the dedicated subfolder `artifacts/architecture/src/` (e.g., `artifacts/architecture/src/architecture_diagram.json`).
     - Compiled standalone HTML files MUST be delivered directly to `artifacts/architecture/` (e.g., `artifacts/architecture/architecture_diagram.html`).
     - This guarantees that `artifacts/architecture/` stays clean, containing exclusively deliverable `.html` diagrams and `.md` contracts.
   - Markdown documents must link to the HTML diagram using Obsidian-compatible relative syntax or wikilinks:
     `[[PRJ_{PROYECTO}_architecture_diagram.html|Diagrama de Arquitectura Interactivo (Archify)]]`
6. **Obsidian Properties Compatibility & Anti-Broken YAML Protocol:**
   - **Flat Key-Values Only:** Obsidian Properties natively parses frontmatter as a flat table of typed properties (Text, List, Number, Checkbox, Date). Never nest objects or dictionaries (e.g., `permissions:\n  browser: false`). Nested maps cause Obsidian to fail parsing the frontmatter or reject the native Properties widget, displaying raw unformatted text with error badges.
   - **No Unquoted Colons in Values:** In YAML, a colon followed by a space (`: `) is reserved syntax for key-value separation. Writing unquoted values like `modelo: Tier Flash (High) (alias: flash, Gemini Flash High)` triggers a fatal syntax parse error, displaying a red dot in Obsidian and raw plaintext `---`. Any value containing `: ` MUST either be wrapped in double quotes `"..."` or preferably separated into clean atomic properties (`tier: Tier Flash (High)` y `alias: flash`).
   - **Metadata vs Body Content Separation:** Keep frontmatter exclusively for flat classification metadata (`tipo`, `rol`, `tier`, `alias`, `proyecto`, `version`, `estado`, `fecha`, `veredicto`, `tags`). Operational instructions, skill missions, permissions, and long descriptions belong in the Markdown body (in callouts `> **Misión:** ...` or structured sections `## 📋 Especificaciones de Operación`), never inside folded block scalars (`description: >-`) when intended for Obsidian.
   - **Clean Tag Arrays:** Tags must use standard flat list format or inline arrays:
     ```yaml
     tags:
       - agentes
       - backend
     ```
     or `tags: [agentes, backend]`.

---

## 📋 Canonical Artifact Schemas

### 1. `artifacts/project_overview.md`
**Role:** Master project overview and navigation index.

```markdown
---
tipo: overview
proyecto: Nombre_Del_Proyecto
version: v0.1.0
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, overview, artefacto]
---

# 🚀 Visión General del Proyecto: [Nombre_Del_Proyecto]

> **Instrucción para Project-Planner:** Actualiza este archivo en cada iteración para reflejar qué hace el proyecto en su estado actual (términos de negocio y funcionalidad clave).

## 📖 ¿Qué hace el proyecto?
[Descripción concisa y orientada al usuario final del sistema o prototipo actual.]

---

## 🗺️ Índice Oficial de Artefactos

- **Arquitectura:** [[PRJ_{PROYECTO}_architecture|Arquitectura del Sistema]]
- **Diagrama Interactivo:** [[PRJ_{PROYECTO}_architecture_diagram.html|Diagrama HTML (Archify)]]
- **Abstracciones:** [[PRJ_{PROYECTO}_abstractions|Abstracciones]]
- **Contrato de Datos (API):** [[PRJ_{PROYECTO}_api_spec|Especificación de API y Modelos]]
- **Plan de Implementación:** [[PRJ_{PROYECTO}_implementation_plan|Plan de Implementación Actual]]
- **Checklist de Tareas:** [[PRJ_{PROYECTO}_task|Checklist de Tareas]]
- **Historial de Cambios:** [[PRJ_{PROYECTO}_changelog_v1|Registro de Versiones (Changelog)]]
- **Último Reporte de Auditoría:** [[PRJ_{PROYECTO}_audit_report|Reporte de Auditoría (Quality Gate)]]
```

---

### 2. `artifacts/architecture/architecture.md`
**Role:** Technical stack, component boundaries, and interactive diagram link (Living Artifact - Zero-Touch).

```markdown
---
tipo: arquitectura
proyecto: Nombre_Del_Proyecto
estado: activo
stack_principal: [Next.js, Tailwind CSS, PostgreSQL, Docker]
diagrama_html: PRJ_Nombre_Del_Proyecto_architecture_diagram.html
tags: [proyecto, arquitectura, tech-stack, archify, living-doc]
---

# 🏗️ Arquitectura del Sistema: [Nombre_Del_Proyecto]

> **Instrucción para Project-Planner / Backend-Architect:** Define el Tech Stack exacto y enlaza el diagrama generado con Archify. Queda estrictamente prohibido usar bloques ```mermaid.
> **Política Zero-Touch:** No lleva versión volátil en el frontmatter. Solo se modifica si cambia el Tech Stack o la topología de red/infraestructura.

## 🏗️ Tech Stack Oficial

- **Frontend:** [Framework, Lenguaje, Bibliotecas UI]
- **Backend:** [Framework, Lenguaje, Runtime]
- **Base de Datos & Cache:** [Motor SQL/NoSQL, Índices, ORM]
- **Infraestructura & Contenedores:** [Docker, Docker Compose, Proxy Nginx/Caddy]

---

## 📐 Diagrama de Arquitectura Interactivo (Archify)

El diagrama de componentes, flujos y fronteras del sistema se mantiene como archivo HTML independiente con SVG interactivo:

🔗 **Ver Diagrama:** [[PRJ_{PROYECTO}_architecture_diagram.html|Abrir Diagrama de Arquitectura Interactivo]]

*(Ubicación en disco: `artifacts/architecture/architecture_diagram.html` | Archivo fuente JSON: `artifacts/architecture/src/architecture_diagram.json`)*
```

---

### 3. `artifacts/architecture/api_spec.md`
**Role:** Data schemas, model definitions, and API endpoint contracts (Living Artifact - Zero-Touch).

```markdown
---
tipo: api_spec
proyecto: Nombre_Del_Proyecto
estado: activo
tags: [proyecto, api, backend, contratos, living-doc]
---

# 📡 Especificación de API y Modelos de Datos

> **Instrucción para Backend-Architect:** Diseña aquí los modelos de base de datos y los endpoints antes de escribir código. Frontend-UI consumirá exclusivamente este contrato.
> **Sinergia Vertical Slice (VSA):** Este archivo actúa como catálogo maestro de endpoints. La validación granular de esquemas de datos vive co-localizada en cada slice (`*.schema.ts`).
> **Política Zero-Touch:** No lleva versión volátil en el frontmatter. Se actualiza únicamente de forma incremental cuando se añade o modifica un endpoint o modelo.

## 🗄️ Modelos de Base de Datos

### Modelo: `[NombreModelo]`
- **Tabla:** `[nombre_tabla_plural]`
- **Campos:**
  - `id`: UUID / BigInteger (Primary Key)
  - `tenant_id`: UUID (Indexed leftmost prefix para multi-tenancy si aplica)
  - `created_at` / `updated_at`: Timestamps
- **Índices Compuestos:** `[tenant_id, campo_frecuente]`

---

## 📡 Endpoints de la API

### `[METODO] /api/[ruta]`
- **Descripción:** [Propósito del endpoint]
- **Autenticación / RBAC:** [Público / Bearer Token / Role required]
- **Request Body (JSON):**
```json
{
  "campo": "valor"
}
```
- **Respuestas:**
  - `200 OK` / `201 Created`:
```json
{
  "success": true,
  "data": {}
}
```
  - `400 Bad Request` / `404 Not Found` / `500 Server Error`
```

---

### 4. `artifacts/architecture/abstractions.md`
**Role:** High-level class abstractions, domain interfaces, business services, core functions, and data seams (Living Artifact - Zero-Touch).

```markdown
---
tipo: abstracciones
proyecto: Nombre_Del_Proyecto
estado: activo
tags: [proyecto, arquitectura, abstracciones, backend, living-doc]
---

# 🏛️ Abstracciones del Sistema y Arquitectura de Código

> **Instrucción para Backend-Architect:** Documenta aquí las clases maestras, interfaces de dominio, servicios de negocio, funciones utilitarias nucleares y variables globales o de configuración. Actúa como el complemento conceptual de `api_spec.md`.
> **Política Zero-Touch:** No lleva versión ni fecha volátil en el frontmatter. Solo se modifica si se introduce una nueva interfaz transversal o servicio nuclear del dominio.

## 🏛️ Filosofía de Diseño y Paradigmas de Código
- **Patrón Arquitectónico:** [Clean Architecture / DDD / Modular Monolith / MVC]
- **Principios Rectores:** [IoC/DI, Single Responsibility, Inmutabilidad, Manejo determinista de errores]

---

## 🧩 Módulos y Capas del Sistema
- **Dominio / Entidades:** [Reglas de negocio puras, Value Objects e invariantes]
- **Aplicación / Servicios:** [Casos de uso y orquestación de operaciones]
- **Infraestructura / Repositorios:** [Persistencia concreta, clientes HTTP externos y brokers]
- **Presentación / Controladores:** [Rutas, DTOs y serialización]

---

## 📐 Interfaces y Contratos de Dominio
### `I[NombreContrato]`
- **Propósito:** [Frontera de abstracción de servicio o repositorio]
- **Firmas:** `metodo(param: Tipo): Promise<Resultado>`

---

## ⚙️ Clases Núcleo y Servicios de Negocio
### Clase: `[NombreServicio]`
- **Responsabilidad:** [Propósito único / SRP]
- **Dependencias Inyectadas:** `[IDependenciaA, IDependenciaB]`
- **Métodos Clave:**
  - `ejecutarAccion(entrada: DTO): SalidaDTO`: Qué computa, efectos secundarios y excepciones controladas.

---

## 🛠️ Funciones Críticas y Lógica Pura
### `[nombreFuncion(param1, param2)]`
- **Módulo:** `utils/` o `domain/rules/`
- **Entrada / Salida:** Tipos y transformaciones deterministas sin efectos secundarios.

---

## 🌐 Variables de Estado, Constantes Globales y Configuración
- **Variables de Entorno (.env):** `VAR_NAME` (propósito, tipo, obligatoriedad y fallback seguro).
- **Enums y Constantes:** Estados de máquina, límites de concurrencia y flags de configuración.

---

## 🔄 Costuras de Flujo de Datos (Data Seams)
- **Lifecycle Request-to-Persistence:** Controller -> Service -> Repository -> Domain Event -> Response.
- **Eventos y Observers:** Eventos disparados y manejadores suscritos.
```

---

### 5. `artifacts/architecture/design_system.md`
**Role:** Living Design System specification, visual tokens, typography, component patterns (< 300 LoC), microinteractions, and DOM budgets (Living Artifact - Zero-Touch).

```markdown
---
tipo: design_system
proyecto: Nombre_Del_Proyecto
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, design-system, ui-ux, design-tokens, living-doc]
---

# 🎨 Especificación de Diseño: [Nombre del Proyecto]

> **Instrucción para Frontend-UI:** Documenta y mantén aquí la paleta semántica, escala tipográfica, arquitectura de componentes Bento y reglas de microinteracción. Actúa como SSoT visual living para evitar inconsistencias de diseño y deuda técnica.
> **Política Zero-Touch:** No lleva versiones efímeras; evoluciona incrementalmente cuando se agregan nuevos tokens, componentes o temas.

## 🏛️ 1. Filosofía de Diseño y Principios Rectores
- **Estética Visual:** High-End Tech, estética editorial o boutique (anti-slop).
- **Psicología Cognitiva (`design-everyday-things`):** Signifiers claros, affordances perceptibles, constraints y feedback < 100ms.
- **Límites de Rendimiento:** 60/120 FPS y presupuesto de DOM estricto (< 800 warning, < 1400 fatal).

---

## 🎨 2. Sistema de Tokens y Fundamentos Visuales
### 2.1 Paleta Semántica
- **Modo Oscuro (Obsidian Zinc):** Background `#09090B`, Cards `#111113`, Bordes `rgba(255,255,255,0.1)`, Texto `#FAFAFA`, Acento Primario `#EF4444`.
- **Modo Claro (Crisp Zinc):** Background `#FAFAFA`, Cards `#FFFFFF`, Bordes `#E4E4E7`, Texto `#09090B`, Acento Primario `#EF4444`.

### 2.2 Tipografía y Jerarquía
- **Marca e Imagotipo:** `Satoshi` (Bold 700 / Black 900).
- **Display, Hero y Métricas:** `Outfit` (Bold 700 / SemiBold 600 con números tabulares).
- **Cuerpo y Controles:** `Inter` o `Geist` (Regular 400 / Medium 500).

### 2.3 Radios, Espaciado y Elevación
- **Radio Base:** `12px` (controles), `16-24px` (tarjetas), `9999px` (pills y badges).
- **Elevación:** Hover sutil `translateY(-2px)` con resplandor difuso del color de acento.

---

## 🧩 3. Arquitectura de Componentes & Layout (< 300 LoC)
- **Navegación / AppBars:** Dock flotante o barra superior con estado activo claro.
- **Bento Grids & Cards:** Módulos asimétricos autocontenidos.
- **Formularios & Modales:** Inputs con focus ring de 1.5px y modales con backdrop blur.

---

## ⚡ 4. Coreografía de Microinteracciones y Motion
- **Active Touch Feedback:** Micro-escala elástica (`scale: 0.97`) en clic/tap.
- **Transiciones:** 150-200ms cúbicas suaves.

---

## 📋 5. Checklist de Validación Visual
- [ ] Presupuesto de DOM validado (< 800 recomendado, < 1400 fatal).
- [ ] Ratios de contraste WCAG AA verificados.
- [ ] Cero componentes con más de 300 LoC.
```

---

### 6. `artifacts/planning/implementation_plan.md`
**Role:** Step-by-step roadmap for current iteration under strict YAGNI.

```markdown
---
tipo: implementation_plan
proyecto: Nombre_Del_Proyecto
iteracion: v0.1.0
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, planning, mvp, yagni]
---

# Plan de Implementación (Iteración Actual)

> **Instrucción para Project-Planner:** Redacta el plan atómico paso a paso. Cumple estrictamente el principio YAGNI (sin sobre-ingeniería).

## 🎯 Objetivo de la Iteración
[Objetivo funcional concreto y medible de este ciclo MVP.]

## 🛠️ Fases de Ejecución

### Fase 1: Modelado y Contratos (Backend-Architect)
1. Definir esquema en `api_spec.md` y abstracciones en `abstractions.md`.
2. Generar migraciones e índices compuestos.

### Fase 2: Construcción de Interfaces (Frontend-UI)
1. Crear componentes modulares basados en `api_spec.md`.
2. Asegurar DOM < 800 nodos en vistas críticas.

### Fase 3: Quality Gate (Systems-Auditor)
1. Ejecutar suites automatizadas y pruebas Playwright E2E.
2. Auditar dependencias y verificar DOM.

### Fase 4: Despliegue (DevOps-Engineer)
1. Empaquetar contenedores Docker y validar `docker-compose.yml`.
```

---

### 7. `artifacts/planning/task.md`
**Role:** Atomic task checklist with explicit subagent assignment.

```markdown
---
tipo: task_list
proyecto: Nombre_Del_Proyecto
iteracion: v0.1.0
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, tasks, checklist]
---

# Checklist de Tareas

> **Instrucción para Agentes:** Marcar con `[x]` al completar cada tarea. Toda tarea debe indicar su subagente responsable explícitamente.

## Tareas Pendientes

- [ ] (Project-Planner) Diseñar arquitectura y generar `architecture_diagram.html` con Archify.
- [ ] (Backend-Architect) Redactar `api_spec.md` y `abstractions.md`, y construir migraciones/modelos.
- [ ] (Frontend-UI) Diseñar vistas responsivas consumiendo `api_spec.md`.
- [ ] (Systems-Auditor) Ejecutar auditoría automatizada con Playwright/tests y emitir veredicto en `audit_report.md`.
- [ ] (DevOps-Engineer) Configurar `Dockerfile` y `docker-compose.yml` tras aprobación de Quality Gate.
```

---

### 8. `artifacts/planning/changelog_vX.md`
**Role:** Versioned iteration and release history following Keep a Changelog + Semantic Versioning, with exact technical metrics, anti-slop pruning, and direct synchronization with GitHub Releases (`gh release create`).

```markdown
---
tipo: changelog
proyecto: Nombre_Del_Proyecto
version: v1.0.0
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, changelog, versiones, release, quality-gate]
---

# Registro de Cambios (Changelog) - [Nombre_Del_Proyecto]

Todos los cambios notables de este proyecto se documentarán en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]
_Cambios en desarrollo en la iteración activa pendientes de corte de versión y tag oficial._

---

## [X.Y.Z] - YYYY-MM-DD (Descriptor Temático / Subtítulo del Release)

### Added & Modularized
- **Descomposición Modular & Nuevos Componentes (`ruta/al/componente.ext`):**
  - Creación de widgets o servicios modulares desacoplados respetando el principio de responsabilidad única (SRP).
  - Reducción drástica de complejidad ciclomática y modularización de archivos monolíticos (< 300 LoC por pantalla o módulo).
  - Métricas cuantitativas del cambio: reducción neta de LoC (ej. `-85.0% global`, de `6,455` a `969 LoC`), catálogo de nuevos módulos y funciones.

### Refactored & Enhanced
- **Centralización y Arquitectura Canónica (`ruta/al/servicio.ext`):**
  - Unificación de fuentes de verdad (ej. Helpers globales, gestión centralizada de estados y temas).
  - Implementación de patrones de resiliencia (HTTP resiliente, reintentos con backoff, inmutabilidad).
  - Encapsulación de lógica de negocio y reglas de dominio fuera de las capas de presentación.

### Removed & Optimized (Anti-Slop)
- **Poda Global de AI Slop y Optimización de Assets:**
  - Erradicación sistemática de comentarios didácticos redundantes de IA (ej. `// Save button`, `// Title`, notas explicativas obvias).
  - Depuración de assets huérfanos y paquetes/dependencias inactivas (ej. reducción de `X KB/MB` en bundle final).
  - Elevación del estándar hacia código limpio, idiomático y profesional.

### Fixed & Enhanced
- **Corrección de Errores de Dominio y Persistencia (`ruta/al/archivo.ext`):**
  - Diagnóstico preciso de causa raíz (Root Cause) y solución implementada sin parches superficiales.
  - Soporte canónico de valores nulos o estados límite (ej. Patrón Sentinel, saneamiento de entradas).
  - Robustez en llamadas de red y manejo defensivo de memoria (límites de longitud en strings y rangos numéricos acotados).

### Modernized & Upgraded
- **Migración a Estándares y APIs Modernas:**
  - Sustitución de APIs deprecadas por las directivas actuales oficiales de los frameworks y lenguajes.
  - Alineación de compilación, versiones de SDK y compatibilidad de herramientas CI/CD.

### Quality Gate & DevOps
- **Certificación de Pruebas Automatizadas & Pipeline:**
  - Ejecución de suites deterministas offline con 100% de tasa de aprobación (ej. `17 suites / 99 tests exitosos`).
  - Veredicto vinculante de `audit_report.md`: `PASS (QUALITY GATE CERTIFIED)`.
  - Configuración y validación de pipelines de compilación multi-plataforma y empaquetado de binarios en CI/CD.

### Security
- **Hardening y Protección de Datos:**
  - Sanitización de consultas y erradicación de vulnerabilidades IDOR / inyección.
  - Gestión cifrada y segura de credenciales y API keys.
```

#### 📐 Reglas Estrictas de Redacción de Changelog & GitHub Releases
1. **Métricas Cuantitativas Obligatorias:** No uses afirmaciones vagas. Siempre que aplique, incluye métricas verificables: porcentaje de reducción de LoC, cantidad exacta de nuevos módulos creados, suites de tests aprobados, milisegundos de latencia o bytes optimizados.
2. **Rutas y Símbolos Explícitos:** Cita siempre los nombres de archivos (`path/to/file.ext`), clases (`ClassName`) y métodos (`methodName()`) modificados usando backticks.
3. **Cero AI Slop:** Queda estrictamente prohibido incluir viñetas genéricas tipo *"Mejoras generales de rendimiento"*, *"Corrección de varios errores menores"* o *"Actualización de código"*. Cada entrada debe explicar el problema real y la solución arquitectónica.
4. **Sincronización con GitHub Releases:** La sección completa de la versión en `changelog_vX.md` constituye la fuente de verdad directa para el cuerpo de `gh release create`, garantizando que tanto el historial en el repositorio como la release oficial en GitHub luzcan un acabado técnico impecable.

---

### 9. `artifacts/audit_reports/audit_report.md`
**Role:** Unbiased Quality Gate verdict and test execution matrix.

```markdown
---
tipo: audit_report
proyecto: Nombre_Del_Proyecto
iteracion: v0.1.0
veredicto: PASS
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, audit, quality-gate]
---

# Reporte de Auditoría y Quality Gate

> **Instrucción para Systems-Auditor:** Eres el guardián imparcial de la calidad. Ningún despliegue se autoriza sin `veredicto: PASS`.

## 🧪 Matriz de Pruebas Automatizadas
- [ ] **Pruebas Unitarias / Backend:** [Estado de ejecución y comandos usados]
- [ ] **Pruebas E2E / Playwright:** [Navegación en browser, snapshots tomados]

## 📊 Rendimiento y Nodos DOM
- [ ] **Auditoría de DOM:** [Cantidad máxima de nodos medida en las vistas. Límite < 800 recomendado, < 1400 máximo tolerable]
- [ ] **Consultas N+1:** [Verificación de queries y carga ansiosa]

## 🛡️ SecOps y Dependencias
- [ ] **Escaneo de Vulnerabilidades:** [`npm audit` o `composer audit` con 0 vulnerabilidades altas/críticas]
- [ ] **Control de Acceso / IDOR:** [Verificación de tenancy y autorización]

---

## 🚦 Veredicto Final

**Status:** PASS
*(O `Status: FAIL` si se incumplió algún criterio. Justificar la razón y reasignar tareas en `task.md`)*
```

### 10. Playbooks de Agentes y Notas de Bóveda Obsidian: `03_Playbooks_QA/AGENTE_*.md`
**Role:** Definición operativa y visualización nativa en Obsidian Properties.

```markdown
---
tipo: playbook-agente
rol: Autonomous Subagent
tier: Tier Flash (High)
alias: flash
estado: activo
tags:
  - agentes
  - backend
  - subagentes
  - modelos
---

# Nombre del Agente (Rol)

> **Misión:** Resumen de alto nivel de las funciones y límites del agente.

## 📋 Especificaciones de Operación
- **Tier & Modelo:** **Tier Flash (High)** (alias Antigravity: `flash`, Gemini Flash High; ver `[[DOC_Modelos_Tiers|.agents/models.yaml]]`).
- **Autoload Skills:** `skill-1`, `skill-2`, `artifact-standards`.
- **Herramientas MCP:** `context7`, `playwright`.
- **Permisos:** Terminal (true), Filesystem (Read/Write), Browser (false).

---
```

---

## 🔍 Checklist Anti-Errores de Tipeo (Pre-Flight Check)

Antes de guardar o confirmar cualquier artefacto o documento en disco, verifica:

| Ítem a Comprobar | Regla Estricta | Error Típico a Evitar |
| :--- | :--- | :--- |
| **Claves de Frontmatter** | Solo minúsculas (`tipo`, `proyecto`, `veredicto`) | ❌ `Tipo:`, `Project:` |
| **Estructura Frontmatter** | Estrictamente plana (flat properties). Cero objetos/diccionarios anidados | ❌ `permissions:\n  terminal: true` |
| **Dos Puntos en Valores** | Valores con `: ` entrecomillados `"..."` o en claves atómicas separadas (`tier`, `alias`) | ❌ `modelo: Tier Flash (alias: flash)` sin comillas |
| **Descripciones Largas** | En el cuerpo Markdown (`> **Misión:** ...`), nunca en frontmatter | ❌ `description: >-` en notas de Obsidian |
| **Veredicto Auditor** | Mayúsculas exactas: `PASS` o `FAIL` | ❌ `Pass`, `Aprobado`, `fail` |
| **Formato Fecha** | `YYYY-MM-DD` | ❌ `DD/MM/YYYY`, `Sept 8 2026` |
| **Wikilinks Obsidian** | `[[PRJ_{PROYECTO}_{archivo}|{Alias}]]` | ❌ `[link](file:///...)`, `[[archivo]]` sin prefijo |
| **Diagramas** | Archivos `.html` con Archify en `artifacts/architecture/` (JSONs fuente en `src/`) | ❌ Bloques ````mermaid o `.json` sueltos en raíz de `artifacts/architecture/` |
| **Asignación de Tareas** | `[ ] (Agente-Asignado) Descripción` | ❌ `[ ] Backend: ...` sin paréntesis |
