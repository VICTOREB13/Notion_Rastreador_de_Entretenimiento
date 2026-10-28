---
tipo: changelog
proyecto: Notion_Rastreador_de_Entretenimiento
version: v2.0.0
estado: activo
fecha: 2026-10-28
tags: [proyecto, changelog, versiones, release, quality-gate, v2, docker, nextjs16, hono]
---

# Registro de Cambios (Changelog) - Notion Rastreador de Entretenimiento

Todos los cambios notables de este proyecto se documentarán en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y [Semantic Versioning](https://semver.org/lang/es/).

> **Instrucción para DevOps-Engineer & Backend-Architect:**
> 1. Este archivo es la **fuente única de verdad** para los cortes de versión y las notas oficiales de **GitHub Releases** (`gh release create`).
> 2. Mantén un estándar técnico riguroso (Anti-Slop): incluye métricas cuantitativas, rutas exactas de archivos, clases y justificación de la causa raíz.
> 3. Queda prohibido el uso de viñetas genéricas como "mejoras varias" o "bugs corregidos".

---

## [2.0.0] - 2026-10-28 (Migración Radical Docker, Stack TypeScript, Hono RPC & Next.js 16)

### Added & Architecture Overhaul
- **Monorepo Modular con Bun Workspaces (`packages/*`, `apps/*`):**
  - `@repo/database`: Capa de persistencia local-first impulsada por Prisma ORM 6.4 sobre SQLite embebido (`./data/entertainment.db`) con pragmas de alta concurrencia (`PRAGMA journal_mode = WAL;`, `busy_timeout = 5000;`).
  - `@repo/server`: Microservicio daemon de fondo en Hono 4.7 y Bun 1.4+, exponiendo contratos Hono RPC tipados (`AppType`) con endpoints para `/api/games`, `/api/movies`, `/api/live/status`, `/api/analytics`, `/api/settings/ai` y `/healthz`.
  - `@repo/web`: Showcase interactivo personal en Next.js 16.4+ (App Router con Turbopack) con Bento Grid de entretenimiento, tarjetas holográficas, dock flotante con efecto magnético y soporte para tema oscuro y claro.
- **Pipeline de Enriquecimiento Contextual con Gemini 2.5 Flash:**
  - Servicio `@google/genai` con structured outputs JSON (`vibeTags`, `personalizedPitch`, `thematicTropes`, `completionEstimateWeeks`).
  - Caché relacional `ai_enrichments` con consulta por lotes (`findManyByTargets`) para prevención absoluta de consultas N+1.
- **Workers Autónomos de Sincronización en Segundo Plano:**
  - Worker de sondeo incremental de Notion con filtros por `last_edited_time` y preservación de candados manuales humanos.
  - Worker en tiempo real de Steam con sondeo a 60s, detección de sesión activa en vivo y debounce de gracia de 3 minutos ante interrupciones de red.

### Contenerización & DevOps (Fase 7)
- **Docker Multi-Stage & Orquestación Docker Compose para Dokploy:**
  - `docker-compose.yml`: Estandarizado como archivo único y canónico para despliegue sin compilación local en Dokploy o VPS, consumiendo directamente las imágenes de GHCR (`ghcr.io/victoreb13/notion-entertainment-daemon-api:latest` y `ghcr.io/victoreb13/notion-entertainment-showcase-web:latest`) con mapeo de puertos 3000/3001, volumen persistente `./data:/app/data` y healthchecks activos. Se eliminó la duplicidad de archivos eliminando `docker-compose.prod.yml`.
  - `packages/server/Dockerfile`: Contenedor Alpine optimizado (`oven/bun:1.4-alpine`) con binarios OpenSSL y SQLite musl, persistencia en volumen montado `/app/data` y healthcheck en `/healthz`.
  - `apps/web/Dockerfile`: Contenedor de producción Next.js 16 en modo `standalone` con base ligera `node:22-alpine` y usuario sin privilegios `nextjs:nodejs` (UID 1001).
  - `.github/workflows/docker-build.yml`: Flujo de integración continua para construcción multi-plataforma (linux/amd64) y publicación automática en GitHub Container Registry (GHCR) en pushes y tags `v*`.
  - `.env.example`: Plantilla exhaustiva y documentada de variables de entorno para despliegue local y en servidor Dokploy.

### Quality Gate & Verification (Fase 6)
- **Pirámide de Pruebas Escalonada de 3 Niveles:**
  - Nivel 1 (Unitarios): 142 pruebas aprobadas (100% pass) en `bun test` en tiempo récord (< 500ms por suite).
  - Nivel 2 (Smoke Tests): Endpoints Hono RPC y compilación estática Next.js Turbopack (`web:build`) validados deterministamente.
  - Nivel 3 (ODD & DOM): Presupuesto de DOM verificado (< 800 nodos en vista principal, 450-520 reales) y cero errores de consola.
- **Veredicto vinculante:** `PASS` formalizado en `artifacts/audit_reports/audit_report.md`.

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
