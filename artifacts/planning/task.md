---
tipo: task_list
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: 3
fecha: 2026-10-31
estado: activo
tags: [tareas, refactorizacion, brand-components, telemetry, dark-mode, light-mode, error-handling]
---

# Desglose de Tareas: Plan de Resolucion de Errores en Produccion y Telemetria Soberana

> Trazabilidad de tareas atomicas para subsanar los fallos reportados en produccion.

## Tareas de la Iteracion

### Fase 1: Blindaje Atomico de Backend y Prevencion de Carrera en SQLite
- [x] `TASK-301`: Implementar patron `upsert` atomico en `ai-settings.repository.ts` sincronizado con `process.env.GEMINI_MODEL`.
- [x] `TASK-302`: Envolver `settings.controller.ts` con manejo defensivo para garantizar respuesta HTTP 200 continua.
- [x] `TASK-303`: Anadir test unitario de concurrencia simultanea sobre endpoints de settings.

### Fase 2: Robustecimiento del Proxy en Runtime Next.js y Reparacion de Assets en Docker
- [x] `TASK-304`: Modificar `apps/web/src/app/api/[...path]/route.ts` para bufferizar respuestas no-SSE con `arrayBuffer()` y controlar abortos de socket.
- [x] `TASK-305`: Actualizar `apps/web/Dockerfile` para copiar la carpeta `public` hacia la imagen final de produccion.

### Fase 3: Purificacion del Modal de Telemetria (Showcase Publico de Solo Lectura)
- [x] `TASK-306`: Eliminar `AiModelConfigForm.tsx` y retirar inputs de API Keys, selectores de modelos y sliders de temperatura.
- [x] `TASK-307`: Crear tarjeta informativa de telemetria de solo lectura con modelo activo, proveedor y boton de cierre limpio.

### Fase 4: Reconstruccion del Sistema de Diseno Dual (Dark & Light Mode) y Slider Animado
- [x] `TASK-308`: Anadir `@custom-variant dark (&:where(.dark, .dark *));` en `apps/web/src/app/globals.css`.
- [x] `TASK-309`: Refactorizar clases oscuras hardcodeadas en `DarkIslandSplineCard.tsx`, `SegmentedProgressCard.tsx`, `SpotlightCard.tsx` y `BentoCatalogGrid.tsx`.
- [x] `TASK-310`: Integrar `SpringSegmentedControl` con fisica de resortes para alternar entre 7D, 30D y 90D en la grafica.

### Fase 5: Sincronizacion Bootstrap en el Daemon y Diagnostico Activo de Credenciales
- [x] `TASK-311`: Incorporar sincronizacion inicial diferida (3s) en `DaemonScheduler` al arrancar el contenedor.
- [x] `TASK-312`: Validar con la suite completa (`bun test`, `bun run lint:contracts`, `bun run typecheck`, `bun run validate`, `bun run web:build`).

---

## Referencias
- [[PRJ_Notion_Rastreador_de_Entretenimiento_implementation_plan|Plan de Implementacion]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture|Arquitectura]]
