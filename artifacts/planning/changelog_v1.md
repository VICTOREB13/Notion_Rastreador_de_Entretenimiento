---
tipo: changelog
proyecto: Notion_Rastreador_de_Entretenimiento
version: v1.0.0
estado: activo
fecha: 2026-10-25
tags: [proyecto, changelog, versiones, release, quality-gate]
---

# Registro de Cambios (Changelog) - Notion Rastreador de Entretenimiento

Todos los cambios notables de este proyecto se documentarán en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y [Semantic Versioning](https://semver.org/lang/es/).

> **Instrucción para DevOps-Engineer & Backend-Architect:**
> 1. Este archivo es la **fuente única de verdad** para los cortes de versión y las notas oficiales de **GitHub Releases** (`gh release create`).
> 2. Mantén un estándar técnico riguroso (Anti-Slop): incluye métricas cuantitativas, rutas exactas de archivos, clases y justificación de la causa raíz.
> 3. Queda prohibido el uso de viñetas genéricas como "mejoras varias" o "bugs corregidos".

---

## [Unreleased]
_Cambios en desarrollo en la iteración activa pendientes de corte de versión y tag oficial._

- Migración de scripts monolíticos `games.py` y `movies.py` hacia slices verticales (`src/features/games/` y `src/features/movies/`).
- Creación de suite de tests unitarios co-localizados bajo `pytest` con mocks de red offline.

---

## [1.0.0] - 2026-10-25 (Migración Integral a Arquitectura V8 SDLC Git-Native)

### Added & Modularized
- **Normalización de Artefactos Vivos Perpetuos (Zero-Touch Policy):**
  - Creación de `artifacts/project_overview.md` como SSoT de negocio y versión global del proyecto (`version: v1.0.0`).
  - Creación de `artifacts/architecture/architecture.md` consolidando el Tech Stack oficial (Python, Requests, Notion REST API, Steam API, TMDB API, GitHub Actions) y enlace al diagrama interactivo Archify.
  - Creación de `artifacts/architecture/abstractions.md` documentando las funciones maestras de sanitización (`limpiar_nombre`), comparación heurística (`similar`), contratos de extracción y data seams de flujo.
  - Creación de `artifacts/architecture/api_spec.md` detallando los esquemas de bases de datos de Notion (`DB_ID_GAMES`, `DB_ID_MOVIES`) y los endpoints de Steam, TMDB y Wikipedia.
  - Creación de `artifacts/architecture/design_system.md` definiendo los tokens semánticos (Obsidian Zinc `#09090B`, Steam Cyan `#66C0F4`, TMDB Teal `#01B4E4`, Victor Red `#EF4444`), tipografías (`Satoshi`, `Outfit`, `Inter`), diseño de tarjetas Bento y presupuesto DOM (< 800 recomendado, < 1400 límite fatal).
  - Creación de `artifacts/architecture/src/architecture_diagram.json` con la topología de red y componentes bajo el esquema Archify v1.

### Refactored & Enhanced
- **Estandarización de Metadatos y Bóveda Obsidian:**
  - Sustitución de rutas relativas frágiles por enlaces Obsidian canónicos con prefijo de proyecto `[[PRJ_Notion_Rastreador_de_Entretenimiento_{artefacto}|{Alias}]]`.
  - Normalización de frontmatter YAML a formato plano estrictamente en snake_case sin objetos anidados ni colons desprotegidos para compatibilidad nativa con Obsidian Properties.

### Quality Gate & DevOps
- **Auditoría Inicial del Arnés (Systems-Auditor):**
  - Evaluación integral de la pirámide de pruebas de 3 niveles en `artifacts/audit_reports/audit_report.md`.
  - Diagnóstico de arnés: Clasificación como `Harness Defect` y `Code Defect` debido a la ausencia de tests unitarios co-localizados en los scripts legados.
  - Veredicto inicial: `FAIL` como mecanismo de protección de calidad hasta la implementación de la fase TDD de VSA.
- **Planificación de Iteración Activa:**
  - Publicación del plan de adopción YAGNI en `artifacts/planning/implementation_plan.md`.
  - Desglose atómico de tareas asignadas por rol de subagente en `artifacts/planning/task.md`.
  - Preservación íntegra de `release.yml` en la raíz del repositorio, omitiendo ejecuciones prematuras de release conforme a las directivas del proyecto.
