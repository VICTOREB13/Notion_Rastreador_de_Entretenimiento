---
tipo: task_list
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: 2
fecha: 2026-10-28
estado: activo
tags: [tareas, refactorizacion, brand-components, daemon, pipeline, notion-sync, gemini, sse]
---

# Desglose de Tareas: Plan de Refactorizacion Integral V9 (Event-Driven & Showcase)

> Trazabilidad de tareas atomicas acordadas durante el proceso de Grill-Me.

## Tareas de la Iteracion

### Fase 1: Blindaje de Credenciales y Entorno
- [x] `TASK-101`: Incorporar `RAWG_KEY` y `TMDB_KEY` en `packages/server/src/config.ts`.
- [x] `TASK-102`: Proteger `/api/settings` para devolver exclusivamente flags booleanas de conexion y modelo activo (sin exponer API Keys en la web).
- [x] `TASK-103`: Actualizar `.env.example` y `docker-compose.yml` con las nuevas variables.

### Fase 2: Clientes de Metadatos y Steam Family Sharing
- [x] `TASK-201`: Implementar `RawgClient` (extraccion de caratula HD y generos con rate-limiting) en `packages/server/src/clients/rawg.client.ts`.
- [x] `TASK-202`: Implementar `TmdbClient` (poster HD, sinopsis y enlace a Wikipedia) en `packages/server/src/clients/tmdb.client.ts`.
- [x] `TASK-203`: Extender `SteamClient` con `getRecentlyPlayedGames` para capturar juegos de Family Sharing.
- [x] `TASK-204`: Integrar adaptador HowLongToBeat para estimacion de horas y auto-culminacion.

### Fase 3: Motor de Sincronizacion Event-Driven (Steam hacia Notion y SSE hacia Web)
- [x] `TASK-301`: Implementar canal de transmision reactiva SSE `GET /api/events` en backend.
- [x] `TASK-302`: Implementar `SteamToNotionSyncService` con triple estrategia de matching (Steam ID, nombre limpio, fuzzy ratio > 0.90), enriquecimiento RAWG, auto-culminacion HLTB y emision de evento `catalog_updated`.
- [x] `TASK-303`: Implementar `NotionMetadataEnricherService` para peliculas.
- [x] `TASK-304`: Implementar endpoint protegido `POST /api/sync/trigger` para sincronizacion manual bajo demanda.

### Fase 4: Proxy Dinamico Runtime Next.js (Resolucion Definitiva de ECONNREFUSED)
- [x] `TASK-401`: Crear Route Handler dinamico catch-all `apps/web/src/app/api/[...path]/route.ts` con soporte para streaming y variables de entorno en runtime.
- [x] `TASK-402`: Remover bloque estatico `rewrites()` en `apps/web/next.config.mjs`.

### Fase 5: Flexibilizacion Total y Dinamica de Modelos de IA
- [x] `TASK-501`: Configurar `gemini-2.0-flash` como modelo predeterminado del sistema.
- [x] `TASK-502`: Habilitar catalogo rapido en frontend y campo de texto libre para modelos custom y experimentales (Argon).
- [x] `TASK-503`: Remover cualquier whitelist restrictiva en el controlador de settings.

### Fase 6: Componentes Autenticos de Marca Personal, Microinteracciones y Telemetria
- [x] `TASK-601`: Copiar vectores oficiales (`ve-logo-horizontal-dark-mode.svg`, `ve-logo-horizontal-light-mode.svg` e isotipo) hacia `apps/web/public/brand/`.
- [x] `TASK-602`: Crear componente `BrandHeader.tsx` con el logotipo oficial.
- [x] `TASK-603`: Copiar `DialogModal`, `CustomSelect`, `SpringSegmentedControl`, `MorphButton` y `CountUp` desde la suite de componentes.
- [x] `TASK-604`: Implementar `SpringSegmentedControl` en la cabecera del dashboard para alternar fluidamente entre Videojuegos y Peliculas/Series.
- [x] `TASK-605`: Construir `TelemetryModal.tsx` ("Sistema & Telemetría") con indicadores de estado de servicios, modelo activo y disparador manual de sincronizacion con `MorphButton`.
- [x] `TASK-606`: Implementar hook `useServerEvents` en la web para refrescar el catalogo automaticamente al recibir `catalog_updated` via SSE.

### Fase 7: Pipeline Unificado de GitHub Actions Encadenado
- [x] `TASK-701`: Unificar `.github/workflows/release.yml` en la secuencia `quality_gate` ➔ `docker_build` ➔ `github_release`.
- [x] `TASK-702`: Desactivar o fusionar `docker-build.yml` redundante.

---

## Referencias
- [[PRJ_Notion_Rastreador_de_Entretenimiento_implementation_plan|Plan de Implementacion]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture|Arquitectura]]
