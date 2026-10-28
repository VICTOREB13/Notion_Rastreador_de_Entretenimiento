---
tipo: overview
proyecto: Notion_Rastreador_de_Entretenimiento
version: v2.0.0
estado: activo
fecha: 2026-10-28
tags: [proyecto, overview, artefacto, master-index, docker, hono, nextjs16, sqlite]
---

# 🚀 Visión General del Proyecto: Notion Rastreador de Entretenimiento

> **Rol del Documento (SSoT del Negocio):** Mantiene la visión de negocio y el estado funcional del proyecto. Aquí es donde reside formalmente la versión global del proyecto (`version: v2.0.0`). Actúa como índice maestro navegable para Obsidian y agentes autónomos bajo el estándar SDLC V8.

## 📖 ¿Qué hace el proyecto?

**Notion Rastreador de Entretenimiento** es un ecosistema de monolito modular contenedorizado diseñado para sincronizar, consolidar, enriquecer con IA y visualizar colecciones personales de **Videojuegos** y **Películas**. Integra bases de datos relacionales de **Notion**, la API de **Steam**, **Prisma ORM** sobre **SQLite embebido** en modo WAL, un microservicio backend reactivo con **Hono RPC** en Bun 1.4+, enriquecimiento contextual inteligente con **Gemini 2.5 Flash**, y un frontend personal de **Showcase Web** en **Next.js 16** con Bento Grid y dock flotante interactivo.

### Capacidades Nucleares:
1. **Microservicio Backend Daemon (`@repo/server`):**
   - Servidor Hono con exportación de `AppType` para Hono RPC totalmente tipado de extremo a extremo.
   - Sincronización incremental bidireccional con Notion respetando candados manuales de usuario.
   - Monitoreo en tiempo real de Steam (sesiones de juego activas con debounce de gracia de 3 min).
   - Agregación de series de tiempo para analíticas diarias de tiempo jugado.
2. **Capa de Persistencia Local-First (`@repo/database`):**
   - SQLite embebido (`./data/entertainment.db`) con Prisma ORM 6.4 y pragmas de alta concurrencia WAL (`journal_mode = WAL`, `busy_timeout = 5000`).
   - Esquemas relacionales normalizados para `games`, `movies`, `game_sessions`, `daily_playtime`, `ai_enrichments` y `ai_settings`.
3. **Pipeline de Enriquecimiento con Gemini 2.5 Flash:**
   - Análisis contextual y generación estructurada con `@google/genai` (vibeTags, personalizedPitch, thematicTropes, completionEstimateWeeks).
   - Prevención estricta de consultas N+1 mediante caché local en SQLite y batching con `findManyByTargets`.
4. **Showcase Web Personal (`@repo/web`):**
   - Aplicación web responsiva en Next.js 16 (App Router con Turbopack), Tailwind CSS v4, Motion y Lucide React.
   - Bento Grid con vista unificada de Videojuegos, Películas, Estado en Vivo y recomendaciones IA.
   - Presupuesto DOM estrictamente controlado (< 800 nodos en vista principal).
5. **Contenerización y Despliegue en Dokploy:**
   - Orquestación lista para producción con `docker-compose.yml` usando imágenes GHCR pre-compiladas multi-stage.

---

## 🗺️ Índice Oficial de Artefactos

### 🟢 Artefactos Vivos (Perpetuos / SSoT - Zero-Touch Policy)
- **Arquitectura del Sistema:** [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture|Arquitectura del Sistema]]
- **Diagrama Interactivo (Archify):** [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture_diagram.html|Diagrama de Arquitectura Interactivo (HTML)]]
- **Abstracciones de Código:** [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Data Seams]]
- **Contratos de Datos (API):** [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificación de API y Modelos Notion]]
- **Sistema de Diseño (Design System):** [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Sistema de Diseño y Tokens UI/UX]]

### 🟡 Artefactos Delta (Iteración Activa)
- **Plan de Implementación:** [[PRJ_Notion_Rastreador_de_Entretenimiento_implementation_plan|Plan de Implementación (Migración VSA)]]
- **Checklist de Tareas:** [[PRJ_Notion_Rastreador_de_Entretenimiento_task|Checklist de Tareas Atómicas]]
- **Historial de Cambios SemVer:** [[PRJ_Notion_Rastreador_de_Entretenimiento_changelog_v1|Changelog Oficial v2.0.0]]
- **Último Quality Gate:** [[PRJ_Notion_Rastreador_de_Entretenimiento_audit_report|Reporte de Auditoría y Quality Gate]]
