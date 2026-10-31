# Context Brief & Project Handoff: Notion Rastreador de Entretenimiento

> **Documento de Continuidad para Nuevas Sesiones en Antigravity CLI**  
> **Fecha de Emisión:** 2026-10-31  
> **Versión Actual Estable:** `v2.0.1` (Patch Release / Official GHCR Release)  
> **Repositorio Canónico (SSoT):** `C:\Users\vmesp\Documents\Marca Personal\Sistemas\Notion_Rastreador_de_Entretenimiento`  
> *(ADVERTENCIA ESTRICTA: Jamás ejecutar ni escribir cambios en rutas obsoletas como `Cositas`)*  
> **Git Remote:** `https://github.com/VICTOREB13/Notion_Rastreador_de_Entretenimiento.git` (Rama `main`)

---

## 1. Comandos de Continuidad de Sesión en Antigravity CLI

Si deseas reanudar o consultar el historial completo de la sesión previa:
- **Reanudar última sesión activa:** `agy -c` o `agy --continue`
- **Reanudar esta conversación específica por UUID:**
  ```powershell
  agy --conversation f2411e7e-a397-435c-bcad-7ae071931571
  ```
- **Ruta del Transcript Forense:**
  `~/.gemini/antigravity-cli/brain/f2411e7e-a397-435c-bcad-7ae071931571/.system_generated/logs/transcript.jsonl`

---

## 2. Visión del Proyecto y Principios de Arquitectura

El **Rastreador de Entretenimiento** es una suite personal de comando y telemetría para videojuegos, cinefilia y enriquecimiento contextual con IA:
1. **Notion como Single Source of Truth (SSoT):** Notion almacena la base de datos definitiva de Videojuegos y Películas. El backend local con SQLite (WAL) y Prisma actúa como un caché de alto rendimiento y telemetría en tiempo real.
2. **Web Showcase de Solo Lectura:** La aplicación web Next.js es una interfaz de visualización pública y telemetría; **no expone credenciales ni formularios de modificación de API keys**. La configuración de proveedores de IA y modelos es 100% soberana desde variables de entorno (`.env`) en el servidor.
3. **Sincronización Inteligente de Steam:**
   - Filtro de juegos < 30 minutos (< 0.5h).
   - Triple estrategia de emparejamiento (Steam ID, título normalizado y fuzzy ratio $\ge 0.90$).
   - Preservación estricta de cuota RAWG: Si la tarjeta en Notion ya tiene portada, **nunca** consume la API de RAWG.
   - Preservación de estados manuales: Si el estado es "Jugando", solo actualiza las horas jugadas sin alterar el estado.
   - Regla de auto-culminación HLTB: Si las horas jugadas alcanzan o superan la duración de la historia principal de HLTB, el juego transiciona automáticamente a "Jugado" registrando la fecha de finalización.
   - Idempotencia: 0 llamadas de sobreescritura a Notion si nada ha cambiado.

---

## 3. Topología del Monorepo

```
Notion_Rastreador_de_Entretenimiento/
├── apps/
│   └── web/                               # Next.js 15 (App Router, Tailwind v4, Standalone Docker)
│       ├── src/app/                       # Rutas, API proxy (/api/[...path]/route.ts)
│       ├── src/components/                # Componentes Brand (DarkIslandSplineCard, Bento, etc.)
│       └── public/                        # Logos vectoriales (ve-logo-horizontal-*.svg)
├── packages/
│   ├── database/                          # Prisma ORM 6, SQLite WAL, repositorios atómicos
│   │   ├── prisma/schema.prisma
│   │   └── src/repositories/              # ai-settings, game, movie repositories
│   └── server/                            # Hono REST API & Daemon Scheduler (Puerto 3001)
│       ├── src/controllers/               # analytics, games, movies, settings, sync
│       ├── src/daemon/                    # scheduler.ts (Bootstrap sync 3s + cron)
│       └── src/services/                  # steam-notion-sync, notion-enricher, hltb
├── artifacts/                             # Artefactos vivos canónicos (overview, architecture, etc.)
├── scripts/                               # Linter SDD, pack_task, worktree, validadores
└── .github/workflows/                     # Pipeline unificado de release y CI determinista
```

---

## 4. Estado Actual: Release `v2.0.1` (Fix Version)

El release oficial `v2.0.1` corrigió 6 anomalías críticas de producción:
1. **Concurrencia SQLite / Error 500:** Implementado `prisma.aiSettings.upsert({ where: { id: "default" } })` sincronizado dinámicamente con `process.env.GEMINI_MODEL`, evitando fallas de clave primaria duplicada al consultar concurrentemente `/api/settings`.
2. **Bufferización en Proxy Web:** Bufferizado de peticiones HTTP en `apps/web/src/app/api/[...path]/route.ts` mediante `arrayBuffer()` y control de abortos, extinguiendo `failed to pipe response` y errores de socket `UND_ERR_SOCKET`.
3. **Consistencia de Modo Dual (Claro & Oscuro):** Agregada la directiva `@custom-variant dark (&:where(.dark, .dark *));` en `apps/web/src/app/globals.css` para Tailwind CSS v4. Todas las tarjetas ahora usan tokens adaptativos (`bg-white dark:bg-[#111113]`).
4. **Selector Temporal Animado:** Integrado `SpringSegmentedControl` con físicas de resorte para alternar rangos (7D, 30D, 90D) en la tarjeta de ritmo de entretenimiento.
5. **Modal de Telemetría Purificado:** Se eliminó `AiModelConfigForm.tsx` (cero campos de entrada de API keys en frontend). El modal muestra una tarjeta de solo lectura con el modelo activo (`gemini-2.5-flash`, `pro`, `argon`, etc.), estado de servicios y disparador manual de sincronización.
6. **Daemon Bootstrap Sync:** `DaemonScheduler` ejecuta una sincronización diferida (3s) al iniciar el contenedor para poblar métricas en el primer arranque.
7. **Docker Runner Assets:** Copia explícita de `apps/web/public` hacia `./public` en el runner stage de `apps/web/Dockerfile`.
8. **CI Workflow Reparado:** `.github/workflows/harness-ci.yml` ahora ejecuta `bun install` y `bun run db:generate` antes de `bun run test`.

---

## 5. Comandos de Verificación & Quality Gate

Todos los comandos deben ejecutarse desde la raíz del proyecto con `bun`:

```powershell
# 1. Ejecutar la suite completa de pruebas unitarias y de integración (198 tests en verde)
bun test

# 2. Auditar paridad de contratos SDD y esquemas canónicos de artefactos (0 drift)
bun run validate

# 3. Comprobar tipado estático en todo el monorepo
bun run typecheck

# 4. Probar compilación del frontend web en modo standalone
bun run web:build

# 5. Estado del Circuit Breaker del arnés
bun run breaker:status
```

---

## 6. Variables de Entorno Críticas (`.env`)

Para ejecutar en producción (Dokploy / Docker Compose) o en desarrollo local:

```env
# Base de Datos SQLite WAL
DATABASE_URL="file:./data/entertainment.db"
NODE_ENV="production"
PORT="3001"
INTERNAL_API_URL="http://daemon-api:3001"

# Notion SSoT
NOTION_TOKEN="secret_xxx..."
DB_ID_GAMES="xxx..."
DB_ID_MOVIES="xxx..."

# Integraciones de Videojuegos
STEAM_API_KEY="xxx..."
STEAM_ID="76561198xxx..."
RAWG_API_KEY="xxx..."

# Cinefilia
TMDB_API_KEY="xxx..."

# Motor de Inteligencia Artificial (Server-Side)
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-2.5-flash"  # Soporta cualquier variante: pro, flash, modelos argon
```

---

## 7. Despliegue en Dokploy

Las imágenes de producción están compiladas y publicadas en GitHub Container Registry (GHCR):
- **Daemon API:** `ghcr.io/victoreb13/notion-entertainment-daemon-api:v2.0.1` (o `:latest`)
- **Web App:** `ghcr.io/victoreb13/notion-entertainment-web:v2.0.1` (o `:latest`)

En Dokploy, basta con apuntar el servicio al tag `v2.0.1` o presionar **Redeploy** asegurándose de tener las variables de entorno anteriores debidamente configuradas.

---

## 8. Siguientes Pasos Recomendados para la Próxima Sesión

1. **Monitoreo en Vivo en Dokploy:** Verificar los logs del daemon en producción tras la primera sincronización de Steam hacia Notion.
2. **Cinefilia (TMDB):** Si se desea sincronizar películas/series automáticamente, extender los workers del scheduler de forma análoga a la sincronización de Steam.
3. **Reglas de Negocio Futuras:** Si se requieren nuevos filtros o tags en Notion, verificar que se respete el protocolo SDD editando primero `api_spec.md` y ejecutando `bun run lint:contracts`.
