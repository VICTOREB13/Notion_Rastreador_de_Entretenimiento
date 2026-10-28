---
tipo: implementation_plan
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: v2.0.0
estado: activo
fecha: 2026-10-25
tags: [proyecto, planning, docker, typescript, bun, hono, nextjs, notion-cms, gemini-ai, prisma, v8-sdlc]
---

# 🎯 Plan de Implementación: Migración Radical Docker + Stack TypeScript + Notion Headless CMS + Showcase Web Estética + Gemini Flash

> **Artefacto Delta (Efímero / Iteración Activa v2.0.0):** Define la hoja de ruta integral, arquitectura de servicios desacoplados, contratos y fases atómicas para migrar el sistema desde scripts efímeros en GitHub Actions hacia un ecosistema moderno contenerizado en Docker impulsado por TypeScript 100% Type-Safe sobre Bun 1.4+, Hono RPC, Prisma ORM, PostgreSQL, Enriquecimiento con IA (Gemini 2.5 Flash) y Frontend Showcase en Next.js 16 con la Suite de Componentes de Marca Personal.
> **Principio YAGNI & SDD:** Cada servicio, modelo y endpoint responde a especificaciones formales previas en [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificación de API]] y [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones del Sistema]], con pruebas unitarias co-localizadas bajo Bun Test (< 500ms).

---

## 🎯 1. Visión y Objetivos de la Iteración

Evolucionar el actual rastreador pasivo basado en ejecuciones cron de GitHub Actions a una plataforma integral de entretenimiento personal en tiempo real, compuesta por:

1. **Docker Daemon Backend (Bun 1.4+ & Hono RPC):** Servicio desatendido continuo que sustituye los cron jobs rígidos por un motor reactivo de sincronización bidireccional y analítica.
2. **Las 3 Soluciones Nucleares de Docker:**
   - **Sondeo Incremental Inteligente (Notion Delta Polling):** Filtro por `last_edited_time` para transferir únicamente páginas modificadas desde la última marca de agua, eliminando consultas masivas y mitigando rate-limits.
   - **Monitoreo en Tiempo Real de Steam (Active Gaming Monitor):** Detección en vivo de sesiones de juego activas (`gameid`, `gameextrainfo`) cada 60s, publicando el estado "Jugando AHORA" para la web y Notion.
   - **Registro Histórico de Sesiones y Analítica Diaria (Time-Series Playtime):** Persistencia en PostgreSQL de sesiones (`GameSession`) y agregados diarios (`DailyPlaytime`), permitiendo graficar tendencias, rachas y mapas de calor en lugar del simple número acumulativo destructivo de Notion.
3. **Notion como "Headless CMS":** Notion se mantiene como la interfaz de curaduría manual ágil del usuario (móvil y escritorio). El daemon sincroniza bidireccionalmente los cambios con PostgreSQL.
4. **Enriquecimiento Contextual con LLM (Gemini 2.5 Flash):** Pipeline estructurado mediante el SDK oficial `@google/genai` con `responseJsonSchema` determinista para inferir Vibe/Mood, pitch persuasivo ("¿Por qué jugarlo/verla hoy?"), micro-resúmenes de tropos y cálculo dinámico de ritmo de completado.
5. **Showcase Web Personal de Alta Estética (Next.js 16 / App Router):** Galería interactiva Bento Grid inspirada en directrices `/frontend-ui`, Obsidian Zinc y Tailwind CSS v4, integrando directamente los componentes existentes del [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Catálogo de Marca Personal]].

---

## 🏗️ 2. Tech Stack de la Solución

| Dominio | Tecnología / Herramienta | Justificación y Versión |
| :--- | :--- | :--- |
| **Lenguaje** | **TypeScript 5.8+** | 100% Type-Safe en cliente, servidor y pipeline de IA |
| **Runtime & PM** | **Bun 1.4+** | Ejecución ultra-rápida, `bun check` nativo multihilo (C++/Zig) y `bun test` |
| **Backend & RPC** | **Hono v4+ (`hono/client`)** | Framework web estándar ultraliviano sobre Bun con exportación de `AppType` |
| **Persistencia** | **PostgreSQL 16/17 (Docker)** | Almacenamiento relacional para series temporales de juego y caché de Notion |
| **ORM** | **Prisma ORM v6+** | Modelado declarativo, migraciones deterministas y cliente tipado |
| **IA & LLM** | **Google Gen AI SDK (`@google/genai`)** | Modelo `gemini-2.5-flash` con esquema estructurado `responseJsonSchema` |
| **Frontend Web** | **Next.js 16 (App Router)** | Renderizado híbrido SSR/SSG con ISR, SEO y rendimiento de nivel de producción |
| **Sincronización Web** | **Hono RPC + TanStack Query v5** | Tipado de extremo a extremo sin duplicar interfaces ni esquemas manuales |
| **Diseño & Estilos** | **Tailwind CSS v4 + Shadcn UI** | Sistema de tokens Obsidian Zinc con modo oscuro y microinteracciones fluidas |
| **Suite Componentes** | **Catálogo Marca Personal** | Reutilización de componentes del [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Catálogo de Marca Personal]] |
| **Infraestructura** | **Docker & Docker Compose** | 3 servicios orquestados (`db`, `api-daemon`, `web`) con volúmenes persistentes |

---

## 🔍 3. Análisis Técnico Detallado de Módulos Críticos

### 3.1. Las 3 Soluciones del Servicio Docker

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DOCKER DAEMON CORE                                     │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│ 1. Notion Delta Polling    │ 2. Steam Live Monitor       │ 3. Time-Series Tracking     │
├────────────────────────────┼─────────────────────────────┼─────────────────────────────┤
│ • Consulta cada 60-120s    │ • Consulta cada 60s         │ • Tabla `game_sessions`     │
│ • Filtro `last_edited_time`│   `GetPlayerSummaries`      │ • Tabla `daily_playtime`    │
│ • Solo páginas modificadas │ • Detecta `gameextrainfo`   │ • Métricas para Spline,     │
│ • Cero N+1 y 0 rate limits │ • Estado "Jugando AHORA"    │   KPIs y ActivityTimeline   │
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

1. **Sondeo Incremental Inteligente (Notion Delta Polling):**
   - **Mecanismo:** La base de datos local en PostgreSQL almacena la marca de agua `sync_metadata.last_notion_sync_at`.
   - **Consulta Notion:** `POST /v1/databases/{id}/query` con payload:
     ```json
     {
       "filter": {
         "timestamp": "last_edited_time",
         "last_edited_time": { "after": "2026-10-25T14:00:00Z" }
       }
     }
     ```
   - **Ventaja:** Si no hay cambios, la API responde en <200ms con un array vacío. Se elimina la descarga y el procesamiento redundante de cientos de páginas en cada ciclo.

2. **Monitoreo en Tiempo Real de Steam (Active Gaming Monitor):**
   - **Mecanismo:** Bucle asíncrono con intervalo de 60 segundos consultando `ISteamUser/GetPlayerSummaries/v0002`.
   - **Detección de Sesión:** Si `gameid` está presente:
     - Si la sesión no existía en memoria/DB: se crea registro con `started_at = NOW()`.
     - Si `gameid` desaparece: se cierra la sesión actual, se calcula `duration_minutes = (NOW() - started_at)` y se persiste en `game_sessions`.
   - **Transmisión de Estado:** Un endpoint SSE (`/api/live/status`) o endpoint REST en Hono expone al instante:
     ```json
     { "isPlaying": true, "gameTitle": "Cyberpunk 2077", "appId": 1091500, "sessionMinutes": 42 }
     ```

3. **Tracking Histórico de Sesiones y Analítica Diaria:**
   - **Problema en Notion:** Notion sobreescribe `Horas Jugadas = 45.2`. Se desconoce la frecuencia, qué días se jugó y la velocidad de progreso.
   - **Modelo Relacional en PostgreSQL:**
     - `GameSession`: Registro atómico de cada bloque de juego continuo.
     - `DailyPlaytime`: Agregación diaria por fecha y juego.
   - **Impacto Visual en Frontend:** Alimenta directamente los componentes `DarkIslandSplineCard` (curva de horas semanales), `ConsolidatedMetricBand` (promedio de horas diarias/semanales) y `ActivityTimeline` (historial cronológico de sesiones).

---

### 3.2. Arquitectura de Enriquecimiento con LLM (Gemini 2.5 Flash)

- **SDK Oficial:** `@google/genai`
- **Modelo:** `gemini-2.5-flash` (alta velocidad, costo mínimo y soporte robusto de esquemas tipados).
- **Esquema Estructurado JSON (`responseJsonSchema`):**
  ```typescript
  import { GoogleGenAI, Type } from "@google/genai";

  const ai = new GoogleGenAI({});

  export const EntertainmentEnrichmentSchema = {
    type: Type.OBJECT,
    properties: {
      vibeTags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 a 4 etiquetas de ambientación, estado de ánimo y ocasión ideal (ej: 'Lluvia & Café', 'Adrenalina pura', 'Cerebral')"
      },
      personalizedPitch: {
        type: Type.STRING,
        description: "2 frases concisas y apasionadas explicando por qué Victor debería jugar o ver este título hoy según sus puntos fuertes."
      },
      thematicTropes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Tropos narrativos o mecánicas destacadas (ej: 'Time-Loop', 'Cyberpunk Noir', 'Pixel Art Atmosférico')"
      },
      completionEstimateWeeks: {
        type: Type.NUMBER,
        description: "Semanas estimadas para completarlo a un ritmo personal estándar de 5 a 7 horas semanales."
      }
    },
    required: ["vibeTags", "personalizedPitch", "thematicTropes"],
    propertyOrdering: ["vibeTags", "personalizedPitch", "thematicTropes", "completionEstimateWeeks"]
  };
  ```
- **Disparador del Pipeline:**
  1. *Automático:* Cuando el daemon detecta un nuevo juego en Steam o película en Notion sin enriquecimiento (`ai_enriched_at IS NULL`).
  2. *Manual On-Demand:* Botón de re-análisis en el dashboard web.
- **Persistencia Híbrida:** Los datos enriquecidos se guardan en PostgreSQL para renderizado instantáneo en la web, y opcionalmente se sincronizan con las propiedades `Vibe` y `Resumen IA` de Notion.

---

### 3.3. Catálogo de Componentes Reutilizables de Marca Personal

Los siguientes componentes ya desarrollados en el [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Catálogo de Marca Personal]] se mapean directamente al diseño del Showcase:

| Componente Origen | Rol en el Showcase de Entretenimiento | Ubicación en Marca Personal |
| :--- | :--- | :--- |
| `DarkIslandSplineCard.tsx` | Gráfico de distribución de horas de juego en los últimos 30 días con selector de temporalidad | `src/cards/DarkIslandSplineCard.tsx` |
| `ConsolidatedMetricBand.tsx` | Franja superior de KPIs: Total Juegos, Horas Totales, Tasa de Finalización, Películas Vistas | `src/cards/ConsolidatedMetricBand.tsx` |
| `SpotlightCard.tsx` | Tarjetas interactivas Bento de Videojuegos y Películas con resplandor radial dinámico | `src/effects/SpotlightCard.tsx` |
| `ShinyText.tsx` | Resaltado de títulos y estado "Jugando AHORA" en vivo | `src/effects/ShinyText.tsx` |
| `CountUp.tsx` | Animación numérica de horas jugadas y métricas globales | `src/effects/CountUp.tsx` |
| `ActivityTimeline.tsx` | Historial cronológico de sesiones completadas recientemente | `src/cards/ActivityTimeline.tsx` |
| `SegmentedProgressCard.tsx` | Progreso de campaña vs. HowLongToBeat Main Story | `src/cards/SegmentedProgressCard.tsx` |
| `FloatingIslandNavDock.tsx` | Barra de navegación flotante inferior para alternar entre "Videojuegos", "Cine" y "Analítica" | `src/layout/FloatingIslandNavDock.tsx` |
| `ThemeToggle.tsx` | Selector de tema claro/oscuro (por defecto Obsidian Zinc) | `src/layout/ThemeToggle.tsx` |
| `TopCommandBar.tsx` | Buscador rápido con atajo de teclado (`Cmd+K`) para filtrar catálogo | `src/layout/TopCommandBar.tsx` |

---

## 🛠️ 4. Fases de Ejecución Paso a Paso

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  CRONOGRAMA DE FASES V8                                        │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬────────────┤
│ Fase 1: SDD │ Fase 2: DB  │ Fase 3: Core│ Fase 4: IA  │ Fase 5: Web │ Fase 6: QA  │ Fase 7: Rel│
│ & Contratos │ & Prisma    │ & Daemon    │ & Gemini    │ & Showcase  │ & Audit ODD │ & Docker   │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────┴────────────┘
```

### Fase 1: Formalización de Contratos SDD y Abstracciones (`Project-Planner` / `Backend-Architect`)
1. Actualizar [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificación de API]] con los esquemas de tablas relacionales (`games`, `movies`, `game_sessions`, `daily_playtime`, `ai_enrichments`) y endpoints Hono RPC (`/api/games`, `/api/movies`, `/api/live/status`, `/api/analytics`).
2. Actualizar [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones del Sistema]] con las interfaces TypeScript puras de los clientes (`INotionSyncClient`, `ISteamClient`, `ITmdbClient`, `IGeminiEnricher`).
3. Verificar compatibilidad con la política Zero-Touch y generar diagrama de arquitectura actualizado en [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture_diagram.html|Diagrama de Arquitectura Interactivo]] vía Archify.

### Fase 2: Modelado de Datos y Persistencia con Prisma ORM (`Backend-Architect`)
1. Inicializar configuración de Prisma en `packages/database/` (o estructura modular en raíz) con SQLite para tests locales rápidos y PostgreSQL para entorno Docker.
2. Definir schema con tipos nativos, índices compuestos `@@index([status, lastEditedTime])` y claves foráneas en cascada.
3. Generar migraciones automáticas (`prisma migrate dev`).

### Fase 3: Construcción del Daemon en Segundo Plano y Hono RPC (`Backend-Architect`)
1. Configurar servidor Hono en Bun 1.4+ (`packages/server/` o `src/server/`) exponiendo endpoints con tipado estricto `AppType`.
2. Implementar `NotionDeltaPoller`: Sondeo inteligente cada 60s con filtro `last_edited_time` y preservación estricta de candados manuales.
3. Implementar `SteamLiveMonitor`: Consulta periódica cada 60s a Steam Web API para detección de sesiones activas.
4. Implementar `PlaytimeTracker`: Manejo de aperturas/cierres de sesión y agregación de series temporales en PostgreSQL.
5. Co-localizar pruebas unitarias de slices bajo `bun test` (< 500ms).

### Fase 4: Pipeline de Enriquecimiento Gemini Flash (`Backend-Architect`)
1. Implementar `GeminiEnricher` utilizando `@google/genai` con modelo `gemini-2.5-flash`.
2. Configurar `responseMimeType: "application/json"` con `responseJsonSchema` estructurado para generar Vibes, personalized pitch y tropos.
3. Implementar caché de análisis para evitar re-análisis redundantes de títulos ya enriquecidos.
4. Integrar worker de enriquecimiento en la cola del daemon de sincronización.

### Fase 5: Frontend Showcase Web Personal en Next.js 16 (`Frontend-UI`)
1. Inicializar aplicación Next.js 16 App Router con soporte Tailwind CSS v4 y tipado estricto.
2. Instalar y enlazar cliente tipado `hc<AppType>` con `@tanstack/react-query` para consumo reactivo.
3. Reutilizar y migrar componentes desde el [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Catálogo de Marca Personal]] (`SpotlightCard`, `DarkIslandSplineCard`, `ConsolidatedMetricBand`, `FloatingIslandNavDock`, etc.).
4. Diseñar vistas principales:
   - **Dashboard Principal (Bento Grid):** KPIs superiores, badge "Jugando AHORA" con pulso en vivo, carrusel de recomendación IA ("¿Por qué jugarlo hoy?"), grid de videojuegos y películas con filtros por estado y género.
   - **Vista de Detalle Modal / Slide-over:** Portada en alta definición, sinopsis, desglose HLTB, etiquetas Vibe y enlace directo a Steam/Wikipedia.
5. Garantizar cumplimiento del presupuesto DOM: < 800 nodos en vista principal, < 1400 límite fatal.

### Fase 6: Auditoría Imparcial ODD & Quality Gate (`Systems-Auditor`)
1. Nivel 1: Ejecutar suite de pruebas unitarias (`bun test`) verificando cobertura de funciones de normalización, fallbacks y esquemas.
2. Nivel 2: Ejecutar smoke tests deterministas de endpoints Hono y generación SSR de Next.js.
3. Nivel 3: Auditoría visual con Playwright MCP inspeccionando presupuesto de nodos DOM, contraste WCAG AA y ausencia de errores en consola.
4. Emitir veredicto formal vinculante en [[PRJ_Notion_Rastreador_de_Entretenimiento_audit_report|Reporte de Auditoría y Quality Gate]].

### Fase 7: Contenerización Docker y Calibración de Producción (`DevOps-Engineer`)
1. Diseñar `docker-compose.yml` con 3 servicios:
   - `postgres`: Imagen oficial `postgres:16-alpine` con volumen montado para persistencia de datos.
   - `daemon-api`: Dockerfile multi-stage con base `oven/bun:1.4-alpine`, corriendo servidor Hono y workers de sincronización.
   - `showcase-web`: Dockerfile optimizado para Next.js 16 (`standalone` output) en Node/Bun.
2. Configurar variables de entorno y secretos (`NOTION_TOKEN`, `STEAM_KEY`, `STEAM_USER_ID`, `TMDB_KEY`, `GEMINI_API_KEY`, `DATABASE_URL`).
3. Documentar comandos de despliegue (`docker compose up -d`) y scripts de migración.

---

## 🛡️ 5. Presupuesto de Rendimiento, DOM y Límites Técnicos

- **Presupuesto DOM (Frontend):** Máximo 800 nodos en la vista inicial de escritorio; paginación virtualizada en galerías densas para nunca superar 1400 nodos.
- **Tasa de Refresco de Sincronización:**
  - Sondeo Notion: Cada 120 segundos (delta incremental < 50ms de overhead).
  - Estado Steam Live: Cada 60 segundos (1 request liviana a Steam Web API).
- **Consumo de Tokens Gemini:** ~300 tokens por juego/película únicamente al registrarse o bajo demanda manual.

---

## 🚦 6. Criterio de Aprobación para Paso a Código

Este plan queda en estado `activo` para revisión exclusiva del usuario. Una vez aprobado formalmente por el usuario, el **Project-Planner** despachará de forma secuencial a los subagentes correspondientes (`Backend-Architect`, `Frontend-UI`, `Systems-Auditor`, `DevOps-Engineer`) según el checklist atómico de `artifacts/planning/task.md`.
