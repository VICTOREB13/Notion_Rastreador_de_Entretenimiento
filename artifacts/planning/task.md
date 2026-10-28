---
tipo: task_list
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: v2.0.0
estado: completado
fecha: 2026-10-28
tags: [proyecto, tasks, checklist, docker-migration, typescript-stack, gemini-flash, showcase-web]
---

# Checklist de Tareas: Migración Radical Docker & Stack TypeScript

> **Instrucción para Agentes:** Marquen con `[x]` cuando completen una tarea. Usen la convención canónica `[ ] (Nombre-Agente) Descripción` para orquestar quién hace qué bajo la supervisión de `Project-Planner`.

---

## 📋 Fase 1: Arquitectura, Contratos SDD y Modelos de Datos
- [x] (Project-Planner) Redactar plan de implementación integral en [[PRJ_Notion_Rastreador_de_Entretenimiento_implementation_plan|Plan de Implementación]] y actualizar checklist atómico en [[PRJ_Notion_Rastreador_de_Entretenimiento_task|Checklist de Tareas]].
- [x] (Project-Planner) Actualizar diagramas interactivos en [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture_diagram.html|Diagrama de Arquitectura Interactivo]] (JSON fuente en `artifacts/architecture/src/`) reflejando el monolito modular y SQLite embebido vía Archify.
- [x] (Backend-Architect) Formalizar contratos de API y modelos relacionales en [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificación de API]] (tablas `games`, `movies`, `game_sessions`, `daily_playtime`, `ai_enrichments`, `ai_settings`, endpoints Hono RPC).
- [x] (Backend-Architect) Documentar interfaces de dominio y data seams en [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones del Sistema]].

---

## 🗄️ Fase 2: Configuración de Base de Datos y Prisma ORM con SQLite
- [x] (Backend-Architect) Inicializar Prisma ORM y configurar conexión local-first a SQLite embebido (`file:./data/entertainment.db`).
- [x] (Backend-Architect) Escribir schema declarativo de Prisma con claves foráneas en cascada e índices compuestos para consultas eficientes por estado, título y fecha.
- [x] (Backend-Architect) Generar migraciones deterministas (`migration.sql`), seeders de prueba (`seed.ts`), repositorios tipados y suite de pruebas unitarias (`bun test`).

---

## ⚙️ Fase 3: Backend Hono sobre Bun 1.4+ y Daemon en Segundo Plano
- [x] (Backend-Architect) Configurar servidor Hono con exportación de `AppType` para Hono RPC y middlewares de observabilidad.
- [x] (Backend-Architect) Implementar worker de sondeo incremental inteligente de Notion (filtro por `last_edited_time`).
- [x] (Backend-Architect) Implementar worker de monitoreo en tiempo real de Steam (consulta cada 60s y detección de estado "Jugando AHORA").
- [x] (Backend-Architect) Implementar tracker de series de tiempo de juego (apertura/cierre de `GameSession` y agregados diarios).
- [x] (Backend-Architect) Escribir pruebas unitarias co-localizadas bajo `bun test` (< 500ms).

---

## 🧠 Fase 4: Pipeline de Enriquecimiento Contextual con Gemini 2.5 Flash
- [x] (Backend-Architect) Integrar SDK `@google/genai` con modelo `gemini-2.5-flash` y esquema estructurado `responseJsonSchema`.
- [x] (Backend-Architect) Desarrollar prompts estructurados para Vibe/Mood, personalized pitch ("¿Por qué jugarlo hoy?"), tropos y estimación de ritmo.
- [x] (Backend-Architect) Implementar mecanismo de caché y sincronización opcional con propiedades de Notion.
- [x] (Backend-Architect) Escribir tests unitarios con mocks para el generador de enriquecimiento.

---

## 🎨 Fase 5: Frontend Showcase Web Personal en Next.js 16 (App Router)
- [x] (Frontend-UI) Inicializar proyecto Next.js 16 con Tailwind CSS v4, Lucide React y Motion.
- [x] (Frontend-UI) Configurar cliente Hono RPC tipado (`hc<AppType>`) integrado con `@tanstack/react-query`.
- [x] (Frontend-UI) Importar y adaptar componentes del catálogo de Marca Personal (`SpotlightCard`, `DarkIslandSplineCard`, `ConsolidatedMetricBand`, `FloatingIslandNavDock`, etc.).
- [x] (Frontend-UI) Construir Bento Grid con vistas de Videojuegos, Cine, Live Status y recomendaciones de IA.
- [x] (Frontend-UI) Verificar presupuesto DOM (< 800 nodos en vista principal, < 1400 límite fatal).

---

## 🛡️ Fase 6: Quality Gate y Auditoría Imparcial ODD
- [x] (Systems-Auditor) Ejecutar pirámide de pruebas: Nivel 1 (unitarios Bun Test), Nivel 2 (smoke tests de endpoints y SSR), Nivel 3 (Playwright DOM y accesibilidad).
- [x] (Systems-Auditor) Verificar ausencia de consultas N+1 y verificar que el bundle web cumple los presupuestos de rendimiento.
- [x] (Systems-Auditor) Emitir veredicto formal en [[PRJ_Notion_Rastreador_de_Entretenimiento_audit_report|Reporte de Auditoría y Quality Gate]].

---

## 🐳 Fase 7: Dockerización y Despliegue Multi-Contenedor
- [x] (DevOps-Engineer) Crear `Dockerfile` optimizado multi-stage para servicio `daemon-api` (Bun 1.4+).
- [x] (DevOps-Engineer) Crear `Dockerfile` optimizado para `showcase-web` (Next.js 16 standalone).
- [x] (DevOps-Engineer) Configurar `docker-compose.yml` orquestando `daemon-api` y `showcase-web` con redes y volúmenes aislados.
- [x] (DevOps-Engineer) Estandarizar `docker-compose.yml` directo para despliegue en Dokploy con imágenes GHCR (`ghcr.io/victoreb13/...`) y persistencia `./data`.
- [x] (DevOps-Engineer) Documentar variables de entorno y guía de ejecución en local/servidor (`.env.example`).
