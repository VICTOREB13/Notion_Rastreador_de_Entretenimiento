---
tipo: implementation_plan
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: 2
fecha: 2026-10-28
estado: activo
tags: [plan, refactorizacion, brand-components, daemon, pipeline, notion-sync, gemini, sse, event-driven]
---

# Plan de Implementacion Integral: Ecosistema Notion Rastreador de Entretenimiento (Arquitectura Event-Driven y Showcase Publico)

Objetivo: Subsanar y transformar el sistema bajo los acuerdos definitivos del proceso Grill-Me:
1. Notion como UNICA Fuente de la Verdad (SSoT) inmutable.
2. Sincronizacion Event-Driven reactiva: Steam detecta juego y tiempo, el Daemon escribe en Notion (con caratula RAWG/TMDB y horas), y al culminar en Notion dispara un evento reactivo via SSE (Server-Sent Events) hacia la web.
3. Seguridad Soberana de Credenciales: Las API Keys (Notion, Steam, RAWG, TMDB, Gemini) residen estrictamente en el `.env` del servidor. Cero inputs de credenciales en el cliente web.
4. Modal de 'Sistema y Telemetria' de alta fidelidad: Creado con los componentes autenticos de Marca Personal (`DialogModal`, `CustomSelect`, `SpringSegmentedControl`, `MorphButton`), enfocado en salud del daemon, modelo de IA activo y disparador manual de sincronizacion.
5. Dashboard Unificado con Tabs Animadas: Pildora elastica `SpringSegmentedControl` para alternar entre Juegos y Peliculas/Series.
6. Pipeline Unificado de GitHub Actions encadenado: 3 jobs secuenciales (`quality_gate` ➔ `docker_build` ➔ `github_release`).
7. Proxy Dinamico Runtime en Next.js 16 para liquidar definitivamente el error `ECONNREFUSED`.

---

## Indice de Fases

1. Fase 1: Blindaje de Credenciales en Servidor y Entorno (RAWG, TMDB, Steam, Notion, Gemini)
2. Fase 2: Clientes de Metadatos (RAWG, TMDB, Wikipedia, HLTB y Steam Family Sharing)
3. Fase 3: Motor de Sincronizacion Event-Driven (Steam hacia Notion y Emision SSE hacia Web)
4. Fase 4: Proxy Dinamico en Runtime Next.js 16 (Resolucion de ECONNREFUSED)
5. Fase 5: Flexibilizacion Total y Dinamica de Modelos de Inteligencia Artificial (Gemini / Argon)
6. Fase 6: Componentes Autenticos de Marca Personal, Microinteracciones, Logotipo y Modal de Telemetria
7. Fase 7: Pipeline Unificado de GitHub Actions Encadenado (Release Oficial)

---

## Fase 1: Blindaje de Credenciales en Servidor y Entorno

### Diagnostico y Necesidad
Dado que la web sera un Showcase publico para mostrar a terceros, las API Keys jamas deben ser editables ni expuestas desde el navegador. Toda configuracion sensible pertenece exclusivamente a las variables de entorno del servidor.

### Acciones Especificas:
1. **Configuracion Tipada en Backend (`packages/server/src/config.ts`):**
   - Incorporar `RAWG_KEY: process.env.RAWG_KEY || ""`
   - Incorporar `TMDB_KEY: process.env.TMDB_KEY || ""`
   - Proteger claves: el endpoint `/api/settings` solo devolvera flags booleanas de estado de conexion (`isNotionConnected: true`, `isSteamConnected: true`, `isRawgConnected: true`, `isGeminiConnected: true`) y el nombre del modelo activo, NUNCA los strings de los tokens.
2. **Actualizacion de Archivos de Despliegue:**
   - `.env.example`: Documentar `RAWG_KEY`, `TMDB_KEY`, `NOTION_TOKEN`, `STEAM_KEY`, `STEAM_USER_ID`, `GEMINI_API_KEY`.
   - `docker-compose.yml`: Inyectar variables en `daemon-api` asegurando persistencia en `./data:/app/data`.
3. **Criterios de Aceptacion:**
   - Cero tokens de API expuestos en respuestas HTTP del backend.
   - `bun run typecheck` pasa sin errores.

---

## Fase 2: Clientes de Metadatos y Soporte Steam Family Sharing

### Diagnostico y Necesidad
Replicar exactamente la extraccion de portadas y generos de `games.py` y `movies.py`, y permitir detectar juegos compartidos por Steam Family Sharing.

### Acciones Especificas:
1. **Cliente RAWG (`packages/server/src/clients/rawg.client.ts`):**
   - Busqueda por titulo con normalizacion. Extrae `background_image` (portada HD) y array de nombres de `genres`.
   - Cache en memoria y rate limiting preventivo.
2. **Cliente TMDB y Wikipedia (`packages/server/src/clients/tmdb.client.ts`):**
   - Busqueda multi-idioma (espanol primario con fallback ingles). Extrae `poster_path` en resolucion w500, `overview` y generos.
   - Consulta a Wikipedia API para obtener el enlace de referencia enciclopedica.
3. **Ampliacion de Steam Client (`packages/server/src/clients/steam.client.ts`):**
   - Incorporar `getRecentlyPlayedGames(steamId)` para detectar titulos jugados bajo Family Sharing.
4. **Adaptador HowLongToBeat (HLTB):**
   - Estimacion de horas de la historia principal para auto-culminacion.
5. **Criterios de Aceptacion:**
   - Pruebas unitarias en `packages/server/tests/metadata-clients.test.ts` con 100% de mocks exitosos.

---

## Fase 3: Motor de Sincronizacion Event-Driven (Steam hacia Notion y SSE hacia Web)

### Diagnostico y Necesidad
La sincronizacion no debe hacer un polling ciego constante que agote cuotas. Opera bajo eventos:
1. Deteccion de fin de sesion de juego en Steam Live (o ejecucion manual).
2. Escritura atomica en Notion (SSoT).
3. Una vez confirmado Notion, actualizacion de cache SQLite y emision de evento reactivo `catalog_updated` via SSE.

### Acciones Especificas:
1. **Canal SSE Reactivo (`packages/server/src/controllers/events.controller.ts`):**
   - Endpoint `GET /api/events` con cabeceras `text/event-stream`, `Cache-Control: no-cache`.
   - Mantiene conexiones abiertas de clientes web.
2. **Servicio `SteamToNotionSyncService` (`packages/server/src/services/steam-notion-sync.service.ts`):**
   - Triple estrategia de matching en Notion:
     - 1. Coincidencia por `Steam ID`.
     - 2. Coincidencia por nombre limpio (`limpiar_nombre`).
     - 3. Coincidencia difusa (fuzzy ratio >= 0.90).
   - Actualiza horas, fecha de inicio y auto-culmina a 'Jugado' con fecha de fin si horas jugadas >= HLTB.
   - Si el juego es nuevo: crea la pagina en Notion con portada HD e icono de RAWG, y etiquetas de genero.
   - Al terminar de escribir en Notion: sincroniza el delta en SQLite y emite `broadcastEvent("catalog_updated")`.
3. **Servicio `NotionMetadataEnricherService` (`packages/server/src/services/notion-metadata.service.ts`):**
   - Proceso en segundo plano para peliculas: detecta peliculas sin portada en Notion y las enriquece con TMDB y Wikipedia.
4. **Trigger Manual en Backend:**
   - Endpoint protegido `POST /api/sync/trigger` para forzar sincronizacion inmediata desde el modal de telemetria.
5. **Criterios de Aceptacion:**
   - `packages/server/tests/steam-notion-sync.test.ts` valida el ciclo completo y la emision de eventos.

---

## Fase 4: Proxy Dinamico en Runtime Next.js 16 (Resolucion de ECONNREFUSED)

### Diagnostico y Necesidad
Eliminar definitivamente el rewrite estatico de `next.config.mjs` que quema `127.0.0.1:3001` durante la compilacion de Docker.

### Acciones Especificas:
1. **Route Handler Dinamico Catch-All (`apps/web/src/app/api/[...path]/route.ts`):**
   - `export const dynamic = 'force-dynamic'`
   - Resuelve `const targetUrl = process.env.INTERNAL_API_URL || "http://daemon-api:3001"`.
   - Proxy transparente para todos los metodos HTTP y soporte para streaming SSE.
2. **Limpieza de `apps/web/next.config.mjs`:**
   - Remover la propiedad `rewrites()`.
3. **Criterios de Aceptacion:**
   - Cero errores `ECONNREFUSED` en los logs de Dokploy/Docker.

---

## Fase 5: Flexibilizacion Total y Dinamica de Modelos de Inteligencia Artificial

### Diagnostico y Necesidad
Permitir que la herramienta utilice cualquier modelo de Google Gemini (Flash, Pro, Lite, series experimentales y Argon) sin hardcoding ni listas blancas restrictivas.

### Acciones Especificas:
1. **Modelo Predeterminado:**
   - `gemini-2.0-flash` como estandar balanceado y veloz.
2. **Entrada Dinamica:**
   - En backend (`settings.controller.ts`), se acepta cualquier string de modelo valido.
   - En frontend, el selector ofrece accesos rapidos (`gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-2.0-pro-exp-0205`, `gemini-1.5-pro`) y la opcion `Custom Model` que despliega un input de texto libre.
3. **Criterios de Aceptacion:**
   - Modificar el modelo desde el entorno o el modal aplica inmediatamente para analisis de Vibe y recomendaciones.

---

## Fase 6: Componentes Autenticos de Marca Personal, Microinteracciones, Logotipo y Modal de Telemetria

### Diagnostico y Necesidad
Restaurar el diseno premium de Marca Personal, integrando microinteracciones cineticas, el logotipo oficial y un modal de telemetria profesional.

### Acciones Especificas:
1. **Activos Vectoriales Oficiales:**
   - Copiar `ve-logo-horizontal-dark-mode.svg` (7.7 KB) e isotipo desde Marca Personal hacia `apps/web/public/brand/`.
   - Crear `BrandHeader.tsx` con el logotipo oficial, brillo sutil carmesí y badge de version.
2. **Importacion de Componentes Primitivos:**
   - Copiar a `apps/web/src/components/ui/`:
     - `DialogModal.tsx`: Render en portal `document.body`, bloqueo reactivo de scroll, animacion spring zoom-in y backdrop blur.
     - `CustomSelect.tsx`: Popover Obsidian Zinc y Crimson, navegacion por teclado, chevrons rotativos y badges.
     - `SpringSegmentedControl.tsx`: Pildora deslizante con fisica de resortes y compresion squash.
     - `MorphButton.tsx`: Morfismo reactivo (Idle, Spinner, Exito cinetico).
     - `CountUp.tsx`: Conteo numerico animado para contadores de horas y titulos.
3. **Dashboard Unificado con Tabs Animadas:**
   - Implementar `SpringSegmentedControl` en la parte superior del catalogo para alternar entre "🎮 Videojuegos" y "🎬 Películas & Series", compartiendo la barra de busqueda y filtros de genero.
4. **Modal de 'Sistema y Telemetria' (`TelemetryModal.tsx`):**
   - Reemplazar el viejo modal de ajustes.
   - Secciones:
     - **Estado de Servicios:** Indicadores visuales de salud (Daemon Online, Notion SSoT Conectado, Steam Live Activo, RAWG Listo).
     - **Motor de Inteligencia:** Muestra el modelo activo de Gemini con boton de prueba interactiva de prompt.
     - **Sincronizacion Manual:** Boton `MorphButton` ("Sincronizar Steam hacia Notion") con spinner y check de confirmacion.
     - **Acerca del Sistema:** Enlaces a GitHub, documentacion y creditos de Marca Personal.
5. **Consumo de Eventos SSE en la Web:**
   - Hook reactivo `useServerEvents` en `apps/web`: al recibir `catalog_updated`, refresca el catalogo suavemente sin recargar la pagina.
6. **Criterios de Aceptacion:**
   - Cero modales HTML planos. Microinteracciones fluidas y presencia impecable de la identidad visual.

---

## Fase 7: Pipeline Unificado de GitHub Actions Encadenado (Release Oficial)

### Diagnostico y Necesidad
Unificar todo el ciclo de entrega en un solo workflow secuencial en GitHub Actions (`.github/workflows/release.yml`), exactamente como en la referencia visual del usuario.

### Acciones Especificas:
1. **Arquitectura del Workflow:**
   - **Job 1: `quality_gate`:** Bun & Node 22, `db:generate`, `db:push`, `typecheck`, `bun test`, `lint:contracts`, `test:artifacts`, `web:build`.
   - **Job 2: `docker_build` (`needs: [quality_gate]`):** QEMU, Buildx, login GHCR, build & push de `daemon-api` y `showcase-web` con cache `gha`.
   - **Job 3: `github_release` (`needs: [docker_build]`):** Generacion de release notes desde `changelog_v1.md`, empaquetado y publicacion oficial en GitHub via `softprops/action-gh-release@v2`.
2. **Consolidacion:**
   - Eliminar workflows desacoplados redundantes (`docker-build.yml`).
3. **Criterios de Aceptacion:**
   - Pipeline de 3 jobs secuenciales encadenados visible en la interfaz de GitHub Actions.

---

## Matriz de Validacion y Quality Gate

| Fase | Verificacion Determinista | Herramienta | Resultado Requerido |
| :--- | :--- | :--- | :--- |
| Fase 1 y 2 | Tipado estricto y clientes de metadatos | `bun run typecheck` | Cero errores de TypeScript |
| Fase 2 y 3 | Pruebas de sincronizacion, matching y eventos | `bun test` | 100% tests passing |
| Fase 3 | Paridad de Contratos SDD | `bun run lint:contracts` | 0 contratos faltantes, 0 huerfanos |
| Fase 4 | Proxy dinamico y compilacion Next.js | `bun run web:build` | Build standalone limpio sin rewrites estaticos |
| Fase 5 y 6 | Auditoria de UI, microinteracciones y logo | Inspeccion de DOM y assets | DialogModal, SpringSegmentedControl, BrandHeader |
| Fase 7 | Workflow encadenado de GitHub Actions | GitHub Actions Runner | 3 jobs secuenciales en verde |

---

## Referencias de Artefactos Vivos
- [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture|Arquitectura del Sistema]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Contratos]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificacion de API]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Sistema de Diseno]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_task|Lista de Tareas]]
