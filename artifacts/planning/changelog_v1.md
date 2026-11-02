---
tipo: changelog
proyecto: Notion_Rastreador_de_Entretenimiento
version: v2.6.1
estado: activo
fecha: 2026-11-01
tags: [proyecto, changelog, versiones, release, quality-gate, v2, docker, nextjs16, hono, v2.6.1]
---

# Registro de Cambios (Changelog) - Notion Rastreador de Entretenimiento

Todos los cambios notables de este proyecto se documentarán en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y [Semantic Versioning](https://semver.org/lang/es/).

> **Instrucción para DevOps-Engineer & Backend-Architect:**
> 1. Este archivo es la **fuente única de verdad** para los cortes de versión y las notas oficiales de **GitHub Releases** (`gh release create`).
> 2. Mantén un estándar técnico riguroso (Anti-Slop): incluye métricas cuantitativas, rutas exactas de archivos, clases y justificación de la causa raíz.
> 3. Queda prohibido el uso de viñetas genéricas como "mejoras varias" o "bugs corregidos".

---

## [2.6.1] - 2026-11-01 (Barra Unificada de Filtros, Selector de Géneros, Filtro de Fechas, Poda Masiva de 2,000+ LoC y Microinteracciones)

### Added
- **Selector Ergonómico y Buscable de Géneros (`CustomSelect.tsx` & `CatalogHeader.tsx`):**
  - Desplegable ergonómico con caja de búsqueda en tiempo real (`searchable`), contador de títulos por género en badges numéricos, y ancho responsive (`min-w-[15rem]`) que erradica por completo el desbordamiento horizontal de decenas de píldoras.
  - Cierre inmediato con tecla `Escape` y memoización estricta de opciones con `useMemo`.
- **Filtro Avanzado de Rangos de Fechas y Años (`DATE_RANGE_OPTIONS`):**
  - Nuevo selector desplegable con opciones preconfiguradas: `"ALL"` (Cualquier año), `"2026"`, `"2025"`, `"2024"`, `"2020-2023"`, `"2010-2019"` y `"CLASSIC"` (Clásicos <2010 con cota inferior `>= 1800`).
  - Funciones puras de extracción y filtrado: `getItemYears`, `isYearInDateRange` y `matchesDateRange` con soporte de `releaseYear`, `year`, `completionDate`, `startDate` y `createdAt`.
- **Botón Reactivo de Limpieza de Filtros:**
  - Botón integrado "Limpiar filtros" con badge numérico del total de filtros activos (`activeFiltersCount`), que restablece simultáneamente estado, género, año y búsqueda.
- **Microinteracciones y Microanimaciones Táctiles (Anti-Slop / High-Craft):**
  - Feedback táctil elástico al pulsar tarjetas: `active:scale-[0.985]` en `GameCard.tsx` y `MovieCard.tsx`.
  - Transición progresiva de carga de imágenes con shimmer y cross-fade suave (`transition-opacity duration-300`).
  - Respeto riguroso de accesibilidad con `motion-reduce:transform-none` en tarjetas y animaciones.

### Changed & Refactored
- **Reestructuración Cohesiva de la Barra de Herramientas (`CatalogHeader.tsx`):**
  - Diseño de 2 niveles simétricos estilo Linear/Raycast/Notion:
    - **Fila Principal:** `SpringSegmentedControl` de categorías a la izquierda; Selector de Ordenamiento y Buscador (`<kbd>Ctrl+K</kbd>`) a la derecha.
    - **Fila Secundaria:** `SpringSegmentedControl` de Estado indivisible (`Todos`, `En Curso`, `Pendientes`, `Completados`); Selector de Géneros con búsqueda; Selector de Fechas; y Botón de Reseteo.
    - Breakpoints alineados a `lg:flex-row` para evitar saltos asimétricos entre tablet y escritorio.
- **Ilustración Contextual de Estados Vacíos (`BentoCatalogGrid.tsx`):**
  - Muestra icono `Film` para películas y `Gamepad2` para videojuegos cuando un filtro no arroja resultados.
- **Ergonomía de Layout Canvas Limpio (`page.tsx` & `ScrollToTop.tsx`):**
  - Reducido el padding inferior de `page.tsx` de `pb-28 sm:pb-32` a `pb-16` tras el retiro del dock flotante.
  - Reposicionado el botón flotante `ScrollToTop` a `bottom-8` en lugar de `bottom-24`.
- **Centralización Inteligente de Versión (Sin Hardcoding):**
  - Elevada la versión a `2.6.1` en `package.json` y `@repo/web`, consumida globalmente a través de `apps/web/src/lib/version.ts` (`APP_VERSION`).

### Removed (Poda Masiva de >2,000 LoC de Slop y Código Basura)
- **Scripts Huérfanos en `scripts/` (-1,280 LoC):**
  - Eliminados físicamente: `scripts/worktree_core.ts` (307 LoC), `scripts/worktree_helpers.ts` (263 LoC), `scripts/pack_task_helpers.ts` (324 LoC), `scripts/verify_recursive_loop_heuristics.ts` (323 LoC) y `scripts/verify_recursive_loop_types.ts` (63 LoC).
- **Componente Huérfano Retirado (-152 LoC):**
  - Eliminado `apps/web/src/components/brand/FloatingIslandNavDock.tsx`.
- **Slop de Pruebas Estáticas (`apps/web/tests/web.test.ts`) (~650 LoC):**
  - Depuradas aserciones estáticas de lectura de strings CSS obsoletas de fases previas, preservando 100% de la cobertura lógica, funcional y de contratos.
- **Estilos Huérfanos (`globals.css`):**
  - Purgadas las variables `--glow-crimson` y la clase `.glow-crimson`.

---

## [2.6.0] - 2026-11-01 (Refactorización UI/UX, Sincronización Notion y Ergonomía Visual)

### Added
- **Sincronización Notion ➔ App (`POST /api/sync/notion` & `TelemetryModal.tsx`):**
  - Endpoint dedicado para reconciliar y forzar la importación manual de videojuegos y películas desde Notion hacia la base de datos local (SQLite).
  - Tarjeta y botón "Sincronizar Notion ahora" en el modal de telemetría, simétrico a la acción existente de Steam.

### Changed & Refactored
- **Rediseño de Barra de Filtros y Corrección de Estados (`CatalogHeader.tsx`):**
  - Eliminado el clipping vertical que cortaba las píldoras de Estado (`En Curso / Jugando`, `Pendientes`, `Completados`) debido a `overflow-x-auto` ajustado.
  - Consolidada la barra de control en un diseño cohesivo de 2 niveles: nivel superior para navegación de categorías y búsqueda, y nivel inferior para estados y carrusel de géneros.
- **Corrección Quirúrgica de Barra de Búsqueda (`CatalogHeader.tsx`):**
  - Limpiado el placeholder para eliminar la duplicidad `(Ctrl+K o /)`, permitiendo que la insignia `<kbd>Ctrl+K</kbd>` flote en el extremo derecho sin solaparse sobre el texto.
- **Simetría y Balance de KPIs en Analíticas (`AnalyticsModal.tsx`):**
  - Cuadrícula de 4 tarjetas de métricas estandarizada con `min-h-[145px]`, etiquetas y cajas de iconos unificadas, números principales monoespaciados y footers alineados.
- **Eliminación de Redundancia en Ratio de Finalización (`ConsolidatedMetricBand.tsx`):**
  - Sustituida la columna duplicada de finalización por la métrica de Racha Activa de Juego (`streakDays` días consecutivos), reservando la barra de progreso segmentada interactiva para `SegmentedProgressCard`.
- **Evolución de Navegación y Retiro de Barra Flotante Inferior (`FloatingIslandNavDock.tsx`):**
  - Reubicado el acceso directo a Analíticas en el `BrandHeader` superior y retirado el dock flotante fijo inferior para despejar el 100% del área de catálogo sin obstrucciones visuales.

---

## [2.5.1] - 2026-11-01 (Hotfix Proxy Fallback Rewrites, Dynamic App Version & Gateway Hardening)

### Fixed & Hardening
- **Resiliencia de Reverse Proxy en Next.js (`apps/web/next.config.mjs` & `apps/web/src/app/api/[...path]/route.ts`):**
  - Migrados los `rewrites` estáticos de `next.config.mjs` a la clave `fallback: [...]`, erradicando el error fatal no capturado `ECONNREFUSED 127.0.0.1:3001` cuando el backend aún no ha levantado o está en ciclo de reinicio.
  - El handler dinámico en tiempo de ejecución de Next.js App Router (`route.ts`) asume el control prioritario sobre `/api/[...path]`, normalizando los segmentos de ruta (`path.filter(Boolean).join("/")`), sanitizando payloads vacíos en peticiones POST/PUT sin forzar `duplex: "half"`, e inyectando `Cache-Control: no-store, no-cache, must-revalidate` en respuestas HTTP 502 JSON controladas.
- **Sincronización Dinámica de Versión en Frontend e Infraestructura (`apps/web/src/app/page.tsx`, `BrandHeader.tsx`, `docker-compose.yml`, `.env.example`):**
  - Eliminado el string hardcodeado `"v2.4.0"` en `page.tsx`, resolviendo `process.env.NEXT_PUBLIC_APP_VERSION || "v2.5.1"`.
  - Inyectada la variable `NEXT_PUBLIC_APP_VERSION` en el servicio `showcase-web` en `docker-compose.yml` y documentada en `.env.example`.
- **Cobertura de Tests Unitarios (`apps/web/tests/api-proxy.test.ts` & `apps/web/tests/web.test.ts`):**
  - Añadidas 3 nuevas pruebas unitarias para certificar la respuesta 502 con cabeceras `no-store`, el soporte de peticiones POST sin body y la resolución de `NEXT_PUBLIC_APP_VERSION`.

---

## [2.5.0] - 2026-11-01 (Poda Masiva, Hero Contextual, Analítica Cinefilia, Batch AI, Snapshot Backup y Resiliencia Gateway)

### Added & Modularized
- **Hero Contextual Inteligente (`apps/web/src/components/catalog/AiRecommendationHero.tsx` & `apps/web/src/app/page.tsx`):**
  - Soporte polimórfico adaptativo según filtro activo en catálogo (`ALL`, `GAMES`, `MOVIES`).
  - Despliegue dinámico de "Selección Cinematográfica IA" para películas y "Recomendación Contextual IA" para videojuegos o catálogo completo.
  - Interacción a nivel de tarjeta (`role="button"`, `tabIndex={0}`, `cursor-pointer`, `onKeyDown` accesible) que abre directamente el modal de detalle (`ItemDetailModal`) preservando el flujo táctil y de teclado.
- **Analítica Unificada con Métricas de Cinefilia (`packages/server/src/controllers/analytics.controller.ts` & `apps/web/src/components/analytics/AnalyticsModal.tsx`):**
  - Incorporadas métricas específicas de cine en el endpoint `/api/analytics`: `totalMovies`, `estimatedWatchTimeHours` (calculado con fallback a 105 min por film cuando no hay duración explícita) y `movieCompletionRate`.
  - Agregador unificado de géneros (`topGenres`) consolidando videojuegos y películas en un ranking armónico con badges temáticos Crimson y Slate.
- **Enriquecimiento Masivo IA en Lote (`packages/server/src/controllers/enrich.controller.ts` & `apps/web/src/components/settings/TelemetryModal.tsx`):**
  - Nuevo endpoint `POST /api/enrich/batch` con filtrado por tipo (`ALL`, `GAME`, `MOVIE`), balanceo distributivo y concurrencia controlada para proteger la cuota de la API de Google Gemini.
  - Botón "Enriquecimiento Masivo en Lote" en el modal de telemetría con estado reactivo, spinners y confirmación visual.
- **Snapshot y Respaldo en un Clic (`packages/server/src/controllers/backup.controller.ts` & `apps/web/src/components/settings/TelemetryModal.tsx`):**
  - Nuevo endpoint `GET /api/backup/export` con exportación completa de SQLite a formato JSON estructurado (`entertainment_backup_YYYY-MM-DD.json`).
  - Enlace directo de descarga en `TelemetryModal.tsx` para copias de seguridad inmediatas sin requerir acceso SSH o manipulación manual del volumen Docker.

### Fixed & Architecture Hardening
- **Resiliencia de Gateway Proxy en Next.js (`apps/web/next.config.mjs` y `apps/web/src/app/api/[...path]/route.ts`):**
  - Resuelta la colisión crítica entre `rewrites()` estáticos de `next.config.mjs` y el catch-all reverse proxy en runtime (`route.ts`).
  - Configurados `rewrites` en modo `fallback: [...]` permitiendo que el handler dinámico de Next.js App Router tome precedencia absoluta para gestionar SSE (`/api/events`), streaming y captura elegante de errores con código HTTP 502 JSON (`Gateway connection error to daemon backend`) en lugar de fallos no capturados `ECONNREFUSED` del proxy interno de Next.js.
  - Alineado el fallback de `INTERNAL_API_URL` a `http://127.0.0.1:3001` de forma uniforme entre runtime, tests y utilidades cliente.
- **Sincronización Uniforme de Versión en Frontend (`apps/web/src/app/page.tsx` y `BrandHeader.tsx`):**
  - Corregida la versión hardcodeada `v2.4.0` en `page.tsx`, conectando `BrandHeader` a `process.env.NEXT_PUBLIC_APP_VERSION || "v2.5.0"`.

### Removed & Optimized (Anti-Slop)
- **Poda Masiva de 1,160 Líneas de Código:**
  - Desacoplado y simplificado `CustomSelect.tsx` (-140 LoC) y `MorphButton.tsx` (-169 LoC), erradicando micro-estados obsoletos.
  - Optimizado `SpotlightCard.tsx` mediante variables CSS nativas (`--mouse-x`, `--mouse-y`), eliminando re-renders y 0ms de carga en el thread principal de JavaScript.
  - Creado `notion-props.helper.ts` (+297 LoC) para unificar la extracción segura de propiedades Notion, reduciendo `notion-sync.service.ts` (-387 LoC) y erradicando duplicidad y complejidad ciclomática.

### Quality Gate & DevOps
- **Pipeline de Release Unificado Estricto en Tags (`.github/workflows/release.yml`):**
  - Limitada la ejecución automática de publicación de contenedores GHCR y corte de GitHub Releases a tags semánticos anotados (`tags: ['v*']`) y `workflow_dispatch`, erradicando releases erróneas ante commits intermedios de desarrollo en `main`.
- **Certificación de Pirámide de Pruebas:**
  - 256 pruebas unitarias y de integración aprobadas (`bun test`).
  - Validación de contratos SDD y esquemas de artefactos al 100% (`bun run validate`).

---

## [2.4.0] - 2026-11-01 (Resiliencia Daemon, Fecha Película Notion, Atajos Web y Drawer Analíticas)

### Added & Enhanced
- **Atajos de Teclado Globales (`apps/web/src/lib/useKeyboardShortcuts.ts`):**
  - Implementado listener accesible para `/` o `Ctrl+K` para foco en búsqueda, `Escape` para cierre de modales y `T` para alternancia de tema, ignorando inputs y textareas editables.
- **Fecha de Visualización de Películas (`MovieCard.tsx` & `ItemDetailModal.tsx`):**
  - Extracción de fecha de compleción desde Notion (`completionDate`), formateador defensivo `formatDate` y badge con icono `CalendarCheck`.
- **Drawer Visual de Analíticas (`AnalyticsModal.tsx`):**
  - Modal accesible con distribución de géneros, ratio de finalización y compatibilidad responsive para resoluciones móviles (<640px).

### Fixed & Hardening
- **Timeouts Defensivos en Clientes HTTP Daemon:**
  - Añadido `AbortSignal.timeout(8000)` en `steam.client.ts`, `tmdb.client.ts` y `hltb.client.ts`.
- **Coalescencia Anti-Split-Brain en Sincronización:**
  - Matching robusto de videojuegos por `cleanTitle` para evitar registros duplicados en SQLite.

---

## [2.3.0] - 2026-10-31 (Ordenamiento Multicriterio, Filtro Dinámico de Géneros y Prompt Anti-Slop)

### Added & Enhanced
- **Ordenamiento Multicriterio (`CatalogHeader.tsx` & `BentoCatalogGrid.tsx`):**
  - Opciones de ordenación: "Jugados recientemente", "Más jugados", "Mejor calificados" y "Alfabético (A-Z)".
- **Filtro Dinámico de Géneros:**
  - Extracción en caliente de géneros activos en la biblioteca y barra de filtrado por píldoras con botón de limpieza.
- **Prompt Anti-Slop para Gemini:**
  - Reducción de temperatura a 0.35 y directivas negativas para impedir clichés narrativos redundantes en los análisis de Vibe.

---

## [2.2.2] - 2026-10-31 (Microinteracciones en Modales, Feedback de Búsqueda y Animaciones)

### Added & Enhanced
- **Microinteracciones en UI:**
  - Animación de rotación en botones de cierre, elevación de enlaces externos y rotación de re-análisis IA en `ItemDetailModal.tsx`.
  - Micro-desplazamiento de flechas en `AiRecommendationHero.tsx` y botón de limpieza de búsqueda cuando no hay resultados.

---

## [2.2.1] - 2026-10-31 (Skeleton Shimmer, Hover Lift y Feedback Reactivo)

### Added & Enhanced
- **Loading States con Shimmer (`BentoCatalogGrid.tsx`):**
  - Reemplazo de spinners planos por skeletons animados con barrido shimmer conectados a TanStack Query.
- **Feedback Reactivo de Tarjetas:**
  - Efectos de hover lift (`hover:-translate-y-1.5`), borde luminoso carmesí (`hover:border-rose-500/40`) y escala de imagen (`group-hover:scale-106`).

---

## [2.2.0] - 2026-10-31 (Enriquecimiento Notion, Calificación 1-5, Fechas de Culminación y Pulido UI)

### Added & Enhanced
- **Soporte de Calificaciones y Fechas en Esquema SQLite:**
  - Campos `rating`, `completionDate` y `summary` en modelos `Game` y `Movie`.
  - Extractores resilientes para estrellas y fracciones en `notion-sync.service.ts`.
  - Rediseño de `ItemDetailModal.tsx` con despliegue de estrellas 1-5 y resumen personal.

---

## [2.0.1] - 2026-10-31 (Estabilización Producción: Concurrencia SQLite, Proxy Runtime, Dark/Light Mode y Telemetría Soberana)

### Fixed & Architecture Hardening
- **Eliminación de Condición de Carrera en Repositorio de Ajustes SQLite (`ai-settings.repository.ts`):**
  - Sustituida la consulta secuencial `findUnique` + `create` por `prisma.aiSettings.upsert({ where: { id: "default" } })`, erradicando el error fatal `Unique constraint failed on the fields: (id)` y las respuestas 500 no controladas ante llamadas concurrentes de inicio.
  - Sincronización soberana con `process.env.GEMINI_MODEL`: el modelo activo en servidor prevalece sobre valores estáticos en SQLite.
- **Robustecimiento del Proxy en Runtime de Next.js (`apps/web/src/app/api/[...path]/route.ts`):**
  - Implementada bufferización completa con `await upstreamRes.arrayBuffer()` para peticiones no-SSE, erradicando los errores de socket `UND_ERR_SOCKET` y `failed to pipe response`.
  - Vinculación de `request.signal` para cancelación limpia de streams y manejo de desconexión del cliente con código HTTP 499 en lugar de falsos errores 502 de gateway.
- **Reconstrucción del Sistema de Diseño Dual (Dark / Light Mode):**
  - Añadida directiva `@custom-variant dark (&:where(.dark, .dark *));` en `apps/web/src/app/globals.css` para compatibilidad estricta con Tailwind CSS v4.
  - Erradicadas clases oscuras fijas (`bg-[#111113]`) en `DarkIslandSplineCard`, `SegmentedProgressCard`, `SpotlightCard`, `BentoCatalogGrid`, `GameCard`, `MovieCard` e `ItemDetailModal`. Ahora responden dinámicamente con tokens Obsidian Zinc & Crimson Crisp en modo oscuro y claro con ratio WCAG AAA (>12:1).
- **Copia de Assets Estáticos en Imagen Docker (`apps/web/Dockerfile`):**
  - Añadida la capa `COPY --from=builder /app/apps/web/public ./public` en la etapa de producción `runner`, resolviendo el error 404 y la imagen rota del logotipo en el header.
- **Purificación del Modal de Telemetría (Showcase Público de Solo Lectura):**
  - Eliminado `AiModelConfigForm.tsx` (removidos inputs de API Keys, selectores de modelos y sliders de temperatura).
  - Diseñada tarjeta informativa de solo lectura con modelo activo en servidor, proveedor, selector de apariencia (Oscuro / Claro / Sistema) y botón de acción única "Sincronizar Steam hacia Notion" con `MorphButton`.
- **Integración de `SpringSegmentedControl` en Gráfica de Series de Tiempo:**
  - Sustituidos botones HTML planos por la píldora animada con física de resortes elástica y compresión squash para rangos 7D / 30D / 90D en `DarkIslandSplineCard.tsx`.
- **Sincronización Bootstrap en `DaemonScheduler`:**
  - Añadido disparo inicial diferido a los 3 segundos de iniciado el servidor para hidratar el catálogo de Notion en SQLite sin esperar el ciclo de 120 segundos.

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
  - `docker-compose.yml`: Estandarizado como archivo único y canónico para despliegue sin compilación local en Dokploy o VPS, consumiendo directamente las imágenes de GHCR (`ghcr.io/victoreb13/notion-entertainment-daemon-api:latest` y `ghcr.io/victoreb13/notion-entertainment-showcase-web:latest`) con mapeo de puertos 3000/3001, volumen persistente `./data:/app/data` y healthchecks activos.
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
