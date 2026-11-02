---
tipo: implementation_plan
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: v2.6.0
estado: activo
fecha: 2026-11-01
tags: [plan, refactorizacion, ui-ux, sync-notion, search-bar, analytics-modal, floating-dock, v2.6.0]
---

# 🎯 Plan de Implementación: Refactorización UI/UX, Sincronización Notion y Ergonomía Visual (v2.6.0)

> **Instrucción para Project-Planner:** Hoja de ruta técnica para resolver los 7 hallazgos de diseño, ergonomía y funcionalidad identificados para la versión v2.6.0.
> **Principio YAGNI & SDD:** Todo endpoint nace de un contrato formal en `api_spec.md` y suite TDD antes de codificar la solución.

---

## 🎯 Objetivo de la Iteración

Perfeccionar la experiencia de usuario (UX) e interfaz gráfica (UI) de la aplicación web, resolver inconsistencias visuales en filtros, búsqueda y analíticas, incorporar la sincronización directa hacia Notion desde la interfaz, y optimizar la navegación eliminando elementos flotantes que colisionan con el contenido.

---

## 🛠️ Desglose de Fases de Ejecución

### Fase 1: Sincronización Directa con Notion (`POST /api/sync/notion`)
- **Problema:** En el modal de telemetría existe sincronización Steam ➔ Notion, pero no hay un disparador para sincronizar o reconciliar Notion ➔ Base de datos local (SQLite).
- **Acciones Técnicas:**
  1. **SDD Contrato:** Declarar `POST /api/sync/notion` en `artifacts/architecture/api_spec.md`.
  2. **Backend:**
     - En `packages/server/src/controllers/sync.controller.ts`, agregar endpoint `POST /notion` que ejecute `notionSyncService.syncGames()` y `notionSyncService.syncMovies()` en paralelo o secuencia controlada.
     - Emitir evento Server-Sent Events `catalog_updated` al culminar y devolver las estadísticas consolidadas.
  3. **Frontend:**
     - En `apps/web/src/lib/api.ts` y `hooks.ts`, crear `triggerNotionSync` y `useSyncNotionMutation`.
     - En `TelemetryModal.tsx`, agregar una tarjeta simétrica a la de Steam titulada "Sincronización Notion ➔ App" con botón reactivo "Sincronizar Notion ahora", feedback de spinner y alertas de estado.
  4. **TDD:** Agregar test unitario en `packages/server/tests/steam-notion-endpoints.test.ts`.

---

### Fase 2: Corrección de Estados Cortados y Rediseño de la Barra de Filtros
- **Problema:** Los botones de "Estado" (`En Curso / Jugando`, `Pendientes`, `Completados`) sufren corte vertical por `overflow-x-auto pb-1` en `CatalogHeader.tsx`. Además, la barra de filtros tiene 3 niveles apilados que sobrecargan la vista.
- **Acciones Técnicas:**
  1. **Solución Inmediata de Clipping:** Eliminar el corte vertical en `CatalogHeader.tsx` ajustando `py-1.5` holgado o permitiendo `flex-wrap` responsive para que las píldoras respiren holgadamente sin cortar sus trazos descendentes ('g', 'j', 'p') ni los bordes de foco.
  2. **Refactorización Innovadora de Barra de Control (Linear / Raycast Style):**
     - Consolidar la barra superior en un diseño cohesivo de 2 niveles:
       - **Línea Superior:** `SpringSegmentedControl` de Categorías (`Colección`, `Videojuegos`, `Películas`) a la izquierda; Selector de Ordenamiento ("Sort by") y Buscador a la derecha.
       - **Línea Inferior de Filtros Contextuales:** Píldoras de Estado rediseñadas con badges numéricos de conteo y selector horizontal de géneros con máscara de degradado lateral (*fade mask*) y botón de limpieza ("Reset filters").

---

### Fase 3: Corrección Quirúrgica de la Barra de Búsqueda
- **Problema:** El placeholder `"Buscar por título, género o notas... (Ctrl+K o /)"` duplica el texto del atajo que a su vez se renderiza como una etiqueta absoluta `<kbd>Ctrl+K</kbd>`, provocando que en anchos reducidos el badge blanco se superponga directamente sobre `(Ctr`.
- **Acciones Técnicas:**
  1. Simplificar el placeholder a: `"Buscar por título, género o notas..."`.
  2. Posicionar el badge `<kbd>Ctrl+K</kbd>` en el extremo derecho con padding defensivo en el input (`pr-16`), garantizando que jamás colisione con el texto escrito ni con el placeholder.
  3. Preservar el botón de limpieza "X" cuando el campo contiene texto con animación suave de rotación.

---

### Fase 4: Simetría, Centrado y Alineación de KPIs en `AnalyticsModal.tsx`
- **Problema:** En el modal de analíticas, las 4 tarjetas de KPI tienen alturas desiguales y tipografías dispares (Card 1 y 4 con texto plano sin badge, Card 2 y 3 con badges e íconos adicionales), provocando una alineación vertical rota.
- **Acciones Técnicas:**
  1. Estandarizar la cuadrícula de 4 columnas bajo una estructura unificada `flex flex-col justify-between h-full min-h-[145px] p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/70 border`:
     - **Header:** Etiqueta en `text-xs font-semibold uppercase tracking-wider text-zinc-500` e ícono estilizado con caja de color translúcido (Ámbar, Rosa, Azul, Púrpura).
     - **Métrica Principal:** Número principal destacado (`text-3xl font-extrabold font-display tracking-tight text-zinc-900 dark:text-zinc-100`) con sufijo de unidad consistente (`hrs`, `títulos`).
     - **Footer Alineado:** Subtexto con badge e indicador alineados uniformemente en la base de las 4 tarjetas (ej. `En Steam`, `Completados`, `Vistas`, `En Cine`), logrando balance y simetría visual perfecta.

---

### Fase 5: Eliminación de Redundancia en Ratio de Finalización
- **Problema:** Existe una duplicidad exacta entre la columna "Tasa de Finalización: 66.4%" en `ConsolidatedMetricBand` y la tarjeta gráfica `SegmentedProgressCard` ("Ratio de Finalización: 66.4% / Target 50%") justo debajo.
- **Acciones Técnicas:**
  1. **Conservar:** `SegmentedProgressCard` en la sección analítica, ya que provee la barra de progreso segmentada interactiva, meta porcentual y visualización visual superior.
  2. **Reemplazar en `ConsolidatedMetricBand`:** Sustituir la columna redundante por una métrica de alto valor que actualmente no tiene visibilidad en el encabezado:
     - **Racha de Juego Activa (`Racha de Días`)**: mostrando `streakDays` días consecutivos (dato provisto por el backend en `summary.currentStreakDays`).
     - De esta forma, la banda superior exhibe 4 métricas complementarias sin duplicidad: 1) Juegos Totales, 2) Horas Steam, 3) Racha Activa, 4) Películas y Series.

---

### Fase 6: Evolución y Reorganización de la Barra Inferior Flotante (`FloatingIslandNavDock`)
- **Problema:** El dock flotante inferior (`fixed bottom-6 z-40`) choca visualmente con las tarjetas del catálogo al scrollear, duplica botones ya presentes en el header (`BrandHeader` y `CatalogHeader`) y reduce el espacio útil de pantalla en dispositivos móviles.
- **Acciones Técnicas:**
  1. **Concepto Seleccionado (Header-First / Canvas Limpio):**
     - Reubicar el acceso directo al modal de **"Analíticas"** en el `BrandHeader` superior (junto al botón de "Telemetría & IA").
     - La selección de categorías (`Colección`, `Juegos`, `Películas`) queda soberanamente en el `CatalogHeader`.
     - Retirar el dock flotante fijo inferior de la página principal para dejar un canvas de navegación 100% limpio y sin obstrucciones.
     - Preservar el botón flotante discreto de "Volver arriba" (`ScrollToTop.tsx`) en la esquina inferior derecha.

---

### Fase 7: Validación Integral, Testing Pyramid & Release v2.6.0
1. Ejecutar pirámide de pruebas completa (`bun test` con 259+ tests).
2. Verificación de contratos SDD (`bun run lint:contracts`) y validación de esquemas (`bun run validate`).
3. Chequeo estricto de tipos (`bun run typecheck`) y compilación de producción Next.js (`bun run web:build`).
4. Bump a `v2.6.0` en `package.json` (gracias al SSoT centralizado en `version.ts`), actualización de changelog, commit semántico, tag y push a GitHub.

---

### Fase 8: Barra Unificada de Filtros, Selector Ergonómico de Géneros, Filtro de Fechas, Poda Masiva (-2,000+ LoC) y Microinteracciones Táctiles (v2.6.1)
- **Problemas Identificados:**
  1. `CatalogHeader.tsx`: La hilera horizontal de decenas de géneros desbordaba la pantalla, haciendo que `ESTADO:` y `GÉNERO:` compartieran fila y provocaran que opciones como `Completados / Vistos` se cortaran a una tercera línea solitaria.
  2. Falta de filtrado por rango de fechas/años para consultar lanzamientos o actividad temporal.
  3. Acumulación de código huérfano y slop (>2,000 LoC en scripts obsoletos, componente dock retirado y aserciones estáticas de CSS).
  4. Carencia de micro-feedback táctil elástico en las tarjetas de catálogo y excesivo padding residual por el dock retirado.
- **Acciones Técnicas:**
  1. **Barra Unificada de Filtros (2 niveles simétricos):**
     - Nivel 1: SegmentedControl de categorías (`Colección`, `Videojuegos`, `Películas`) a la izquierda; Buscador (`<kbd>Ctrl+K</kbd>`) y Selector de Ordenamiento (`CustomSelect`) a la derecha.
     - Nivel 2: SegmentedControl indivisible de Estado (`Todos`, `En Curso`, `Pendientes`, `Completados`); selector desplegable de géneros con búsqueda integrada (`searchable`), badges de conteo y ancho responsive; selector de rango de fecha/año (`DATE_RANGE_OPTIONS`); y botón reactivo "Limpiar filtros" con badge contador.
  2. **Lógica de Fechas Pura:** Funciones `getItemYears`, `isYearInDateRange` y `matchesDateRange` conectadas a `BentoCatalogGrid.tsx` y `page.tsx`.
  3. **Poda Masiva (-2,000+ LoC):**
     - Eliminación de scripts muertos en `scripts/` (1,280 LoC).
     - Eliminación de `FloatingIslandNavDock.tsx` (152 LoC).
     - Limpieza de tests estáticos en `apps/web/tests/web.test.ts` (~650 LoC).
  4. **Microinteracciones y Microanimaciones:**
     - Feedback táctil `active:scale-[0.985]` en `GameCard` y `MovieCard`.
     - Transición suave de carga de portadas (`transition-opacity duration-300`).
     - Respeto estricto de accesibilidad con `motion-reduce:transform-none`.
     - Reubicación de `ScrollToTop` a `bottom-8` y reducción de padding inferior en `page.tsx` a `pb-16`.
     - Purga de `.glow-crimson` en `globals.css`.
  5. **Centralización Inteligente de Versión:**
     - Actualización a `2.6.1` en `package.json` consumida por `APP_VERSION` en `@/lib/version.ts` sin hardcoding.
  6. **Validación y Release:** Pirámide de testing completa en verde, commit semántico y tag `v2.6.1`.