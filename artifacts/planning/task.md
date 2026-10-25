---
tipo: task_list
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: v1.0.0
estado: activo
fecha: 2026-10-25
tags: [proyecto, tasks, checklist, v8-migration]
---

# Checklist de Tareas: Migración SDLC V8 & VSA

> **Instrucción para Agentes:** Marquen con `[x]` cuando completen una tarea. Usen la convención canónica `[ ] (Nombre-Agente) Descripción` para orquestar quién hace qué.

## Tareas de la Iteración

### 📋 Fase 1: Normalización Arquitectónica y Artefactos Vivos
- [x] (Project-Planner) Normalizar los 5 Artefactos Vivos perpetuos en `artifacts/` (`project_overview.md`, `architecture.md`, `abstractions.md`, `api_spec.md`, `design_system.md`) bajo Zero-Touch Policy y frontmatter plano snake_case.
- [x] (Project-Planner) Diseñar la especificación de componentes y diagrama en `artifacts/architecture/src/architecture_diagram.json`.
- [x] (Project-Planner) Redactar plan de implementación YAGNI en `artifacts/planning/implementation_plan.md` y registro inicial en `artifacts/planning/changelog_v1.md`.

### 🛡️ Fase 2: Auditoría Inicial del Arnés (Quality Gate)
- [x] (Systems-Auditor) Auditar el estado de la suite de pruebas bajo la pirámide de 3 niveles (Nivel 1 unitarios, Nivel 2 smoke, Nivel 3 visual/DOM).
- [x] (Systems-Auditor) Identificar discrepancias de arnés y código (ausencia de tests automatizados y falta de VSA co-localizada).
- [x] (Systems-Auditor) Emitir reporte de auditoría vinculante con veredicto inicial en `artifacts/audit_reports/audit_report.md`.

### 🧩 Fase 3: Adopción de Vertical Slice Architecture (VSA) & TDD
- [ ] (Backend-Architect) Modularizar `games.py` en el slice vertical `src/features/games/` desacoplando ingesta Steam, fuzzy matching y persistencia Notion.
- [ ] (Backend-Architect) Modularizar `movies.py` en el slice vertical `src/features/movies/` con pipeline de búsqueda y fallbacks TMDB/Wikipedia.
- [ ] (Backend-Architect) Escribir pruebas unitarias co-localizadas bajo `pytest` para ambos slices con ejecución determinista `< 500ms`.
- [ ] (Frontend-UI) Diseñar especificación de vista Bento Grid y componentes visuales garantizando presupuesto DOM `< 800` nodos.

### 🚀 Fase 4: DevOps & Release Engineering
- [ ] (DevOps-Engineer) Validar compatibilidad de scripts en GitHub Actions (`games.yml`, `peliculas.yml`) con la nueva estructura de slices.
- [ ] (DevOps-Engineer) Mantener `release.yml` intacto/omitido hasta instrucción explícita del usuario y preparar tags semánticos oficiales.
