---
tipo: api_spec
proyecto: Notion_Rastreador_de_Entretenimiento
estado: activo
tags: [proyecto, api, backend, contratos, sqlite, hono-rpc, living-doc]
---

# 📡 Especificación de API y Modelos de Datos

> **Artefacto Vivo (Perpetuo / Zero-Touch):** Define el contrato vigente de datos y endpoints del sistema. No lleva versión volátil en el frontmatter. Únicamente se actualiza de forma incremental cuando se añade o modifica un endpoint o modelo de base de datos.
> **Sinergia con Vertical Slice (VSA):** Este archivo actúa como el índice maestro de contratos y esquemas consumidos por el daemon backend Hono, la base de datos local SQLite y el frontend Next.js 16.
> **Complemento Arquitectónico:** Consulta las interfaces TypeScript, puertos/adaptadores y data seams en [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Data Seams]].

---

## 🗄️ Modelos de Base de Datos Local: SQLite Embebido (`entertainment.db`)

El sistema utiliza un monolito modular con persistencia embebida en **SQLite 3** (`file:./data/entertainment.db`) administrado por **Prisma ORM**. Elimina dependencias de servicios externos pesados (cero PostgreSQL) garantizando latencias <1ms, transacciones ACID y portabilidad local-first.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ESQUEMA RELACIONAL SQLITE                              │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│ • games                    │ • movies                    │ • ai_settings               │
│   (Títulos, Steam, Notion) │   (Películas, TMDB, Wiki)   │   (Selector multi-proveedor)│
├────────────────────────────┼─────────────────────────────┼─────────────────────────────┤
│ • game_sessions            │ • daily_playtime            │ • ai_enrichments            │
│   (Sesiones en vivo/hist.) │   (Series agregadas día)    │   (Vibes, Pitch, Tropos)    │
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

### 1. Modelo: `Game`
- **Tabla:** `games`
- **Descripción:** Representa el catálogo unificado de videojuegos sincronizados desde Notion y Steam.
- **Campos:**
  - `id`: `String` (UUID / CUID, Primary Key)
  - `notionPageId`: `String` (Unique, Indexed - Identificador de página en Notion)
  - `title`: `String` (Título oficial del juego)
  - `cleanTitle`: `String` (Título normalizado para deduplicación fuzzy, Indexed)
  - `steamAppId`: `Int?` (Steam AppID numérico, Indexed)
  - `playtimeForever`: `Float` (Horas registradas en Steam, Default `0.0`)
  - `playtimeNotion`: `Float` (Horas persistidas en Notion, Default `0.0`)
  - `hltbMain`: `Float?` (Horas estimadas campaña principal HLTB)
  - `hltbCompletionist`: `Float?` (Horas estimadas 100% completista HLTB)
  - `coverUrl`: `String?` (URL de la portada en alta definición)
  - `genres`: `String` (JSON serializado de géneros `["Acción", "RPG"]`, Default `"[]"`)
  - `link`: `String?` (Enlace oficial / Wikipedia / Steam Store)
  - `platform`: `String` (Default `"PC"`)
  - `status`: `String` (Estado: `"Por Jugar" | "Jugando" | "Jugado"`, Default `"Por Jugar"`, Indexed)
  - `startDate`: `String?` (Fecha ISO `YYYY-MM-DD`)
  - `lastSyncAt`: `DateTime?` (Timestamp de última sincronización exitosa)
  - `createdAt`: `DateTime` (Default `now()`)
  - `updatedAt`: `DateTime` (Auto-updated)
- **Relaciones:**
  - `sessions`: `GameSession[]` (Historial de sesiones atómicas)
  - `dailyPlaytime`: `DailyPlaytime[]` (Series temporales diarias)
- **Índices:**
  - `@@index([status, cleanTitle])`
  - `@@index([steamAppId])`
  - `@@index([notionPageId])`

---

### 2. Modelo: `Movie`
- **Tabla:** `movies`
- **Descripción:** Catálogo de películas curadas en Notion y enriquecidas con TMDB y Wikipedia.
- **Campos:**
  - `id`: `String` (UUID / CUID, Primary Key)
  - `notionPageId`: `String` (Unique, Indexed)
  - `title`: `String` (Título original o curado en Notion)
  - `cleanTitle`: `String` (Título normalizado para búsquedas heurísticas, Indexed)
  - `tmdbId`: `Int?` (ID numérico en TMDB, Indexed)
  - `posterUrl`: `String?` (URL del póster oficial TMDB)
  - `overview`: `String?` (Sinopsis oficial en español)
  - `genres`: `String` (JSON serializado de géneros cinematográficos, Default `"[]"`)
  - `wikiUrl`: `String?` (Enlace al artículo de Wikipedia)
  - `status`: `String` (Estado: `"Por Ver" | "Viendo" | "Vista"`, Default `"Por Ver"`, Indexed)
  - `year`: `Int?` (Año de estreno)
  - `lastSyncAt`: `DateTime?`
  - `createdAt`: `DateTime` (Default `now()`)
  - `updatedAt`: `DateTime` (Auto-updated)
- **Índices:**
  - `@@index([status, cleanTitle])`
  - `@@index([tmdbId])`
  - `@@index([notionPageId])`

---

### 3. Modelo: `GameSession`
- **Tabla:** `game_sessions`
- **Descripción:** Registro cronológico de bloques de juego continuo detectados en tiempo real por el monitor de Steam.
- **Campos:**
  - `id`: `String` (UUID / CUID, Primary Key)
  - `gameId`: `String` (Foreign Key -> `games.id`, Indexed)
  - `steamAppId`: `Int?` (AppID asociado a la sesión)
  - `startedAt`: `DateTime` (Momento de detección de inicio de sesión, Indexed)
  - `endedAt`: `DateTime?` (Momento de cierre de la sesión)
  - `durationMinutes`: `Int` (Minutos jugados en la sesión, Default `0`)
  - `isLive`: `Boolean` (Bandera activa si la sesión está en curso, Default `false`, Indexed)
  - `createdAt`: `DateTime` (Default `now()`)
  - `updatedAt`: `DateTime` (Auto-updated)
- **Relaciones:**
  - `game`: `Game` (Relation: `fields: [gameId], references: [id], onDelete: Cascade`)
- **Índices:**
  - `@@index([gameId, startedAt])`
  - `@@index([isLive])`

---

### 4. Modelo: `DailyPlaytime`
- **Tabla:** `daily_playtime`
- **Descripción:** Agregado diario de minutos invertidos por juego y fecha, optimizado para gráficos de serie temporal (`DarkIslandSplineCard`) y cálculo de rachas.
- **Campos:**
  - `id`: `String` (UUID / CUID, Primary Key)
  - `date`: `String` (Fecha en formato ISO estricto `YYYY-MM-DD`, Indexed)
  - `gameId`: `String` (Foreign Key -> `games.id`, Indexed)
  - `minutes`: `Int` (Total de minutos acumulados en el día, Default `0`)
  - `createdAt`: `DateTime` (Default `now()`)
  - `updatedAt`: `DateTime` (Auto-updated)
- **Relaciones:**
  - `game`: `Game` (Relation: `fields: [gameId], references: [id], onDelete: Cascade`)
- **Índices y Restricciones:**
  - `@@unique([date, gameId])`
  - `@@index([date])`

---

### 5. Modelo: `AiEnrichment`
- **Tabla:** `ai_enrichments`
- **Descripción:** Enriquecimiento contextual inferido por LLM estructurado para títulos de juegos o películas.
- **Campos:**
  - `id`: `String` (UUID / CUID, Primary Key)
  - `targetType`: `String` (`"GAME" | "MOVIE"`, Indexed)
  - `targetId`: `String` (ID foráneo referenciando `games.id` o `movies.id`, Indexed)
  - `vibeTags`: `String` (JSON array: `["Lluvia & Café", "Adrenalina Pura"]`, Default `"[]"`)
  - `personalizedPitch`: `String` (2 frases persuasivas contextuales)
  - `thematicTropes`: `String` (JSON array de tropos y mecánicas, Default `"[]"`)
  - `completionEstimateWeeks`: `Float?` (Semanas estimadas de completado al ritmo del usuario)
  - `provider`: `String` (Proveedor utilizado: `"gemini" | "deepseek" | "groq" | "ollama"`)
  - `modelUsed`: `String` (Nombre del modelo, ej: `"gemini-2.5-flash"`)
  - `rawResponse`: `String?` (Payload de respuesta cruda en JSON)
  - `createdAt`: `DateTime` (Default `now()`)
  - `updatedAt`: `DateTime` (Auto-updated)
- **Índices y Restricciones:**
  - `@@unique([targetType, targetId])`
  - `@@index([targetType])`

---

### 6. Modelo: `AiSettings`
- **Tabla:** `ai_settings`
- **Descripción:** Configuración persistente del selector dinámico de IA, permitiendo alternar entre Gemini, DeepSeek, Groq u Ollama local en caliente.
- **Campos:**
  - `id`: `String` (Primary Key, fijo: `"default"`)
  - `activeProvider`: `String` (`"gemini" | "deepseek" | "groq" | "ollama"`, Default `"gemini"`)
  - `geminiApiKey`: `String?` (Clave API encriptada/enmascarada)
  - `deepseekApiKey`: `String?`
  - `groqApiKey`: `String?`
  - `ollamaBaseUrl`: `String?` (Default `"http://localhost:11434"`)
  - `selectedModel`: `String` (Default `"gemini-2.5-flash"`)
  - `temperature`: `Float` (Default `0.7`)
  - `createdAt`: `DateTime` (Default `now()`)
  - `updatedAt`: `DateTime` (Auto-updated)

---

## 🌐 Esquema de Propiedades Notion (Integración Bidireccional)

### 1. Base de Datos: Videojuegos (`DB_ID_GAMES`)
| Propiedad Notion | Tipo Notion | Propósito / Formato |
| :--- | :--- | :--- |
| `Título` | `title` | Nombre principal del videojuego (Texto plano) |
| `Steam ID` | `number` | AppID numérico de Steam (ej: `1091500`) |
| `Horas Jugadas` | `number` | Horas totales registradas con 1 decimal (ej: `45.2`) |
| `HLTB Principal` | `number` | Horas estimadas para la historia principal (HowLongToBeat) |
| `HLTB Completista` | `number` | Horas estimadas para completar al 100% |
| `Portada` | `files` | URL de la imagen de portada/banner del juego |
| `Géneros` | `multi_select` | Lista de géneros (ej: `Acción`, `RPG`, `Aventura`) |
| `Link` | `url` | Enlace a la página de Wikipedia o tienda Steam |
| `Plataforma` | `select` | Plataforma de juego (`PC`, `Console`, etc.) |
| `Estado` | `status` / `select` | `Por Jugar`, `Jugando`, `Jugado` |
| `Fecha de Inicio` | `date` | Fecha en formato ISO `YYYY-MM-DD` del primer registro |
| `Vibe IA` | `multi_select` | Etiquetas de ambientación generadas por IA |
| `Pitch IA` | `rich_text` | Recomendación personalizada generada por IA |

### 2. Base de Datos: Películas (`DB_ID_MOVIES`)
| Propiedad Notion | Tipo Notion | Propósito / Formato |
| :--- | :--- | :--- |
| `Título` | `title` | Nombre de la película, opcionalmente con año `Título (YYYY)` |
| `Portada` | `files` | URL pública del póster oficial en TMDB (`image.tmdb.org`) |
| `Resumen` | `rich_text` | Sinopsis oficial en español |
| `Géneros` | `select` / `multi_select` | Género cinematográfico principal o etiquetas |
| `Link` | `url` | URL directa al artículo de Wikipedia en español |
| `Año` | `number` | Año de lanzamiento |
| `Estado` | `status` / `select` | `Por Ver`, `Viendo`, `Vista` |

---

## 📡 Contratos de Endpoints Hono RPC (`/api/*`)

### 0. Healthcheck del Sistema: `/healthz`

#### `GET /healthz`
- **Descripción:** Healthcheck del daemon y servidor Hono para Docker y monitoreo de infraestructura.
- **Autenticación:** Pública.
- **Respuesta 200 OK:**
```json
{
  "status": "ok",
  "timestamp": "2026-10-27T19:00:00.000Z",
  "uptime": 120.5
}
```

---

### 1. Videojuegos: `/api/games`

#### `GET /api/games`
- **Descripción:** Obtiene la lista paginada y filtrada de videojuegos con sus enriquecimientos de IA y datos de sesión.
- **Query Params:**
  - `status?: string` (`"Por Jugar" | "Jugando" | "Jugado"`)
  - `search?: string` (Búsqueda por título)
  - `limit?: number` (Default: `50`, Max: `100`)
  - `offset?: number` (Default: `0`)
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cuid_game_1",
      "notionPageId": "uuid-page-1",
      "title": "Cyberpunk 2077",
      "cleanTitle": "cyberpunk 2077",
      "steamAppId": 1091500,
      "playtimeForever": 54.2,
      "playtimeNotion": 54.2,
      "hltbMain": 25.0,
      "hltbCompletionist": 103.0,
      "coverUrl": "https://cdn.akamai.steamstatic.com/...",
      "genres": ["RPG", "Acción", "Mundo Abierto"],
      "link": "https://store.steampowered.com/app/1091500",
      "platform": "PC",
      "status": "Jugando",
      "startDate": "2026-09-15",
      "aiEnrichment": {
        "vibeTags": ["Distopía Neón", "Adrenalina Pura", "Cerebral"],
        "personalizedPitch": "Inmersión cruda en Night City perfecta para sesiones intensas nocturnas.",
        "thematicTropes": ["Ciberimplantes", "Mega-Corporaciones", "Anti-Héroe"],
        "completionEstimateWeeks": 3.5
      }
    }
  ],
  "pagination": { "total": 128, "limit": 50, "offset": 0 }
}
```

#### `POST /api/games/sync`
- **Descripción:** Dispara un ciclo de sincronización incremental bajo demanda con Notion y Steam.
- **Request Body:** `{ "forceFullSync"?: boolean }`
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "gamesProcessed": 14,
    "gamesUpdated": 3,
    "gamesCreated": 1,
    "durationMs": 420
  }
}
```

#### `GET /api/games/:id`
- **Descripción:** Obtiene un videojuego por su ID (CUID) o `cleanTitle` slug, incluyendo géneros parseados y enriquecimiento IA.
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "id": "cuid_game_1",
    "title": "Cyberpunk 2077",
    "cleanTitle": "cyberpunk 2077",
    "aiEnrichment": {
      "vibeTags": ["Distopía Neón", "Adrenalina Pura"],
      "personalizedPitch": "Inmersión cruda en Night City...",
      "thematicTropes": ["Ciberimplantes", "Anti-Héroe"],
      "completionEstimateWeeks": 3.5
    }
  }
}
```

#### `GET /api/games/:id/enrichment`
- **Descripción:** Recupera exclusivamente los metadatos contextuales generados por IA para un juego (`vibeTags`, `personalizedPitch`, `thematicTropes`, `completionEstimateWeeks`).
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "vibeTags": ["Distopía Neón", "Adrenalina Pura"],
    "personalizedPitch": "Inmersión cruda en Night City...",
    "thematicTropes": ["Ciberimplantes", "Anti-Héroe"],
    "completionEstimateWeeks": 3.5
  }
}
```

#### `POST /api/games/:id/enrich`
- **Descripción:** Dispara el pipeline de enriquecimiento con Gemini 2.5 Flash para un juego. Si ya está cacheado en SQLite, retorna el caché a menos que se envíe `force: true`. Opcionalmente sincroniza con propiedades de Notion (`Vibe IA`, `Pitch IA`).
- **Request Body (JSON, opcional):**
```json
{
  "force": false,
  "model": "gemini-2.5-flash",
  "syncToNotion": true
}
```
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "gameId": "cuid_game_1",
    "title": "Cyberpunk 2077",
    "cached": false,
    "enrichment": {
      "vibeTags": ["Distopía Neón", "Adrenalina Pura"],
      "personalizedPitch": "Inmersión cruda en Night City...",
      "thematicTropes": ["Ciberimplantes", "Anti-Héroe"],
      "completionEstimateWeeks": 3.5
    }
  }
}
```

---

### 2. Películas: `/api/movies`

#### `GET /api/movies`
- **Descripción:** Obtiene el catálogo de películas con metadatos de TMDB y Wikipedia.
- **Query Params:**
  - `status?: string` (`"Por Ver" | "Viendo" | "Vista"`)
  - `search?: string`
  - `year?: number`
  - `limit?: number`
  - `offset?: number`
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cuid_movie_1",
      "notionPageId": "uuid-page-movie-1",
      "title": "Oppenheimer",
      "cleanTitle": "oppenheimer",
      "tmdbId": 872585,
      "posterUrl": "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
      "overview": "Historia del físico teórico estadounidense J. Robert Oppenheimer...",
      "genres": ["Drama", "Historia"],
      "wikiUrl": "https://es.wikipedia.org/wiki/Oppenheimer_(pel%C3%ADcula)",
      "status": "Vista",
      "year": 2023,
      "aiEnrichment": {
        "vibeTags": ["Tensión Intelectual", "Cine Histórico"],
        "personalizedPitch": "Una obra maestra sobre el peso del conocimiento y las consecuencias morales."
      }
    }
  ],
  "pagination": { "total": 45, "limit": 50, "offset": 0 }
}
```

#### `GET /api/movies/:id`
- **Descripción:** Obtiene una película por su ID (CUID) o `cleanTitle` slug con metadatos TMDB y enriquecimiento IA.
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "id": "cuid_movie_1",
    "title": "Oppenheimer",
    "cleanTitle": "oppenheimer",
    "year": 2023,
    "aiEnrichment": {
      "vibeTags": ["Tensión Intelectual", "Cine de Autor"],
      "personalizedPitch": "Una obra maestra sobre el peso del conocimiento...",
      "thematicTropes": ["Destrucción Mutua", "Culpa Existencial"]
    }
  }
}
```

#### `GET /api/movies/:id/enrichment`
- **Descripción:** Recupera exclusivamente los metadatos contextuales generados por IA para una película.
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "vibeTags": ["Tensión Intelectual", "Cine de Autor"],
    "personalizedPitch": "Una obra maestra sobre el peso del conocimiento...",
    "thematicTropes": ["Destrucción Mutua", "Culpa Existencial"]
  }
}
```

#### `POST /api/movies/:id/enrich`
- **Descripción:** Dispara el enriquecimiento con Gemini para una película específica por su ID/slug.
- **Request Body (JSON, opcional):**
```json
{
  "force": false,
  "model": "gemini-2.5-flash",
  "syncToNotion": true
}
```
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "movieId": "cuid_movie_1",
    "title": "Oppenheimer",
    "cached": false,
    "enrichment": {
      "vibeTags": ["Tensión Intelectual", "Cine de Autor"],
      "personalizedPitch": "Una obra maestra sobre el peso del conocimiento...",
      "thematicTropes": ["Destrucción Mutua", "Culpa Existencial"]
    }
  }
}
```

#### `POST /api/movies/sync`
- **Descripción:** Dispara la sincronización incremental bajo demanda del catálogo de películas curadas en Notion.
- **Request Body:** `{ "forceFullSync"?: boolean }`
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "moviesProcessed": 8,
    "moviesUpdated": 2,
    "moviesCreated": 1,
    "durationMs": 310
  }
}
```

#### `POST /api/movies/enrich`
- **Descripción:** Reintenta la búsqueda de metadatos TMDB/Wikipedia y enriquecimiento de IA para una película concreta (formato body legacy).
- **Request Body:** `{ "movieId": "cuid_movie_1" }`
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": { "id": "cuid_movie_1", "tmdbId": 872585, "enriched": true }
}
```

---

### 3. Monitor en Tiempo Real: `/api/live/status`

#### `GET /api/live/status`
- **Descripción:** Expone el estado de actividad de juego de Steam en vivo. Consultado periódicamente por la UI para activar el pulso en vivo del badge "Jugando AHORA" y registrar sesiones activas.
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "isPlaying": true,
    "game": {
      "id": "cuid_game_1",
      "title": "Cyberpunk 2077",
      "steamAppId": 1091500,
      "coverUrl": "https://cdn.akamai.steamstatic.com/...",
      "sessionStartedAt": "2026-10-25T14:15:00.000Z",
      "sessionMinutes": 48
    }
  }
}
```
*(Si no hay ningún juego ejecutándose: `isPlaying: false, game: null`)*

#### `POST /api/live/check`
- **Descripción:** Dispara una comprobación forzada e inmediata del estado de actividad en vivo contra Steam Web API.
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "isPlaying": true,
    "game": {
      "id": "cuid_game_1",
      "title": "Cyberpunk 2077",
      "steamAppId": 1091500
    }
  }
}
```

---

### 4. Telemetría y Salud del Sistema: `/api/settings`

#### `GET /api/settings`
- **Descripción:** Obtiene las banderas booleanas de salud y conectividad de proveedores (Notion, Steam, RAWG, TMDB, Gemini) y el modelo activo de IA sin exponer claves sensibles de API.
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "isNotionConnected": true,
    "isSteamConnected": true,
    "isRawgConnected": true,
    "isTmdbConnected": true,
    "isGeminiConnected": true,
    "activeProvider": "gemini",
    "activeModel": "gemini-2.5-flash",
    "daemonOnline": true,
    "uptime": 120.5
  }
}
```

---

### 5. Selector Dinámico de IA: `/api/settings/ai`

#### `GET /api/settings/ai`
- **Descripción:** Obtiene la configuración actual del selector de IA con las API Keys enmascaradas.
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "activeProvider": "gemini",
    "selectedModel": "gemini-2.5-flash",
    "temperature": 0.7,
    "geminiConfigured": true,
    "deepseekConfigured": false,
    "groqConfigured": true,
    "ollamaBaseUrl": "http://localhost:11434",
    "availableProviders": [
      { "id": "gemini", "label": "Google Gemini", "defaultModel": "gemini-2.5-flash" },
      { "id": "deepseek", "label": "DeepSeek API", "defaultModel": "deepseek-chat" },
      { "id": "groq", "label": "Groq LPU", "defaultModel": "llama-3.3-70b-versatile" },
      { "id": "ollama", "label": "Ollama Local", "defaultModel": "llama3.2:latest" }
    ]
  }
}
```

#### `PUT /api/settings/ai`
- **Descripción:** Actualiza el proveedor activo, las credenciales y el modelo. Valida la conexión con el proveedor antes de guardar.
- **Request Body (JSON):**
```json
{
  "activeProvider": "gemini",
  "selectedModel": "gemini-2.5-flash",
  "temperature": 0.7,
  "geminiApiKey": "AIzaSy..."
}
```
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "message": "Configuración de IA actualizada y verificada con éxito."
}
```

#### `POST /api/settings/ai/test`
- **Descripción:** Verifica la conectividad y validez de la API Key con el proveedor configurado (Gemini). Acepta credenciales opcionales en el body para validar claves antes de persistirlas.
- **Request Body (JSON, opcional):**
```json
{
  "apiKey": "AIzaSy...",
  "model": "gemini-2.5-flash"
}
```
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "connected": true,
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

---

### 5. Métricas y Analítica: `/api/analytics`

#### `GET /api/analytics`
- **Descripción:** Entrega las métricas consolidadas para las tarjetas Bento, KPIs globales y la curva de serie temporal de `DarkIslandSplineCard`.
- **Query Params:**
  - `days?: number` (Default: `30`)
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalGames": 128,
      "totalPlaytimeHours": 1420.5,
      "completedGames": 34,
      "completionRate": 26.56,
      "totalMovies": 86,
      "watchedMovies": 62,
      "currentStreakDays": 5
    },
    "recentSessions": [
      {
        "id": "cuid_session_1",
        "gameTitle": "Cyberpunk 2077",
        "startedAt": "2026-10-25T14:15:00.000Z",
        "endedAt": "2026-10-25T15:30:00.000Z",
        "durationMinutes": 75
      }
    ],
    "timeSeries": [
      { "date": "2026-10-23", "hours": 2.5 },
      { "date": "2026-10-24", "hours": 4.0 },
      { "date": "2026-10-25", "hours": 1.25 }
    ],
    "topGames": [
      { "title": "Cyberpunk 2077", "hours": 115.4, "coverUrl": "..." },
      { "title": "The Witcher 3", "hours": 98.2, "coverUrl": "..." }
    ]
  }
}
```

---

### 6. Eventos Reactivos y Sincronización Manual: `/api/events` & `/api/sync`

#### `GET /api/events`
- **Descripción:** Canal Server-Sent Events (SSE) para emitir eventos reactivos en tiempo real (`catalog_updated`, `ping`, `connected`) hacia el cliente web.
- **Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- **Eventos:**
  - `connected`: Handshake inicial con ID de cliente.
  - `catalog_updated`: Emitido tras persistir cambios en Notion y actualizar la cache SQLite.
  - `ping`: Keep-alive periódico.

#### `POST /api/sync/trigger`
- **Descripción:** Disparo manual de sincronización completa desde Steam hacia Notion (SSoT) y enriquecimiento de películas.
- **Respuesta 200 OK:**
```json
{
  "success": true,
  "message": "Sincronización manual completada con éxito.",
  "data": {
    "games": {
      "scannedSteam": 50,
      "updatedNotion": 2,
      "createdNotion": 0,
      "skippedLowPlaytime": 10,
      "durationMs": 1420
    },
    "movies": {
      "moviesProcessed": 30,
      "moviesEnriched": 1,
      "moviesSkipped": 29,
      "durationMs": 850
    },
    "timestamp": "2026-10-28T20:00:00.000Z"
  }
}
```

---

## 📡 Especificación de Integración de APIs Externas (Consumidas)

### 1. Notion REST API (`https://api.notion.com/v1`)
- **Autenticación:** `Authorization: Bearer {NOTION_TOKEN}`
- **Versión:** `Notion-Version: 2022-06-28`
- **Consulta Delta:** `POST https://api.notion.com/v1/databases/{database_id}/query` (Sondeo Incremental Inteligente)
  - **Filtro Delta por Marca de Agua:**
```json
{
  "filter": {
    "timestamp": "last_edited_time",
    "last_edited_time": { "after": "2026-10-25T14:00:00.000Z" }
  },
  "page_size": 100
}
```
- **Mutación de Registros:** `POST https://api.notion.com/v1/pages` / `PATCH https://api.notion.com/v1/pages/{page_id}` (mutación atómica sin sobreescribir candados).

---

### 2. Steam Web API (`https://api.steampowered.com`)
- **Biblioteca de Juegos:** `GET https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={STEAM_KEY}&steamid={STEAM_USER_ID}&include_appinfo=1&format=json`
- **Resumen en Tiempo Real:** `GET https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={STEAM_KEY}&steamids={STEAM_USER_ID}` (detección de `gameid` y `gameextrainfo`).
- **Detalles de Tienda:** `GET https://store.steampowered.com/api/appdetails?appids={appid}&l=spanish` (portadas y géneros).

---

### 3. The Movie Database (TMDB v3 API)
- **Búsqueda Cinematográfica:** `GET https://api.themoviedb.org/3/search/movie?api_key={TMDB_KEY}&query={titulo}&year={año}&language=es-ES`

---

### 4. Wikipedia OpenSearch API
- **Búsqueda de Artículos:** `GET https://es.wikipedia.org/w/api.php?action=opensearch&search={titulo}&limit=1&namespace=0&format=json`

---

## 📚 Especificaciones Técnicas y Contratos Relacionados

- **Arquitectura del Sistema:** [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture|Arquitectura del Sistema]]
- **Abstracciones del Sistema y Código:** [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Data Seams]]
- **Sistema de Diseño y Tokens:** [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Sistema de Diseño y Tokens UI/UX]]

