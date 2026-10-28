---
tipo: abstracciones
proyecto: Notion_Rastreador_de_Entretenimiento
estado: activo
tags: [proyecto, arquitectura, abstracciones, backend, ports-adapters, typescript, living-doc]
---

# 🏛️ Abstracciones del Sistema y Arquitectura de Código

> **Artefacto Vivo (Perpetuo / Zero-Touch):** Este documento es el plano arquitectónico permanente del código fuente. No lleva versión ni fecha volátil en el frontmatter. Documenta las clases maestras, interfaces de dominio, servicios de negocio, puertos/adaptadores y data seams.
> **Evolución Modular Monolith:** Define la arquitectura en TypeScript 100% Type-Safe sobre Bun, con persistencia desacoplada en SQLite local (`packages/database`), contratos Hono RPC y selector dinámico de IA multi-proveedor.

---

## 🏛️ Filosofía de Diseño y Paradigmas de Código

- **Patrón Arquitectónico:** **Monolito Modular con Arquitectura Hexagonal (Ports & Adapters)** y **Vertical Slice Architecture (VSA)**.
- **División de Capas:**
  - `packages/database/`: Modelado declarativo Prisma, migraciones SQLite y repositorios concretos.
  - `packages/core/`: Entidades de dominio, contratos e interfaces puras (cero dependencias de infraestructura).
  - `packages/server/`: Daemon en segundo plano (workers periódicos) y API HTTP Hono RPC con tipado exportado `AppType`.
- **Principios Rectores:**
  - **Inversión de Dependencias (DIP):** Todos los servicios de aplicación dependen de interfaces abstractas (`INotionSyncClient`, `ISteamClient`, `IAiProvider`, repositorios), nunca de implementaciones concretas.
  - **Local-First & Offline Resilience:** Persistencia primaria en SQLite embebido (`entertainment.db`); el sistema continúa operando incluso sin conexión a Notion o Steam.
  - **Zero-Overwrite (Protección de Candados):** Las propiedades curadas manualmente por el usuario o en estados terminales (`Jugado`, `Vista`) están protegidas contra sobreescrituras por sincronizaciones automáticas.
  - **Fuzzy Deduplication:** Normalización ortográfica y cálculo de similitud Levenshtein / Dice Coefficient para evitar duplicados entre Steam, TMDB y Notion.

---

## 📐 Interfaces y Contratos de Dominio (Ports & Adapters)

### 1. Clientes de Integración Externa (Driven Ports)

#### `INotionSyncClient`
Abstracción de comunicación con Notion REST API (v2022-06-28):
```typescript
export interface NotionPageDelta {
  id: string;
  lastEditedTime: string;
  properties: Record<string, unknown>;
}

export interface INotionSyncClient {
  fetchModifiedPages(databaseId: string, lastEditedAfter: Date): Promise<NotionPageDelta[]>;
  fetchAllPages(databaseId: string): Promise<NotionPageDelta[]>;
  createPage(databaseId: string, properties: Record<string, unknown>): Promise<string>;
  updatePageProperties(pageId: string, properties: Record<string, unknown>): Promise<void>;
  queryDatabase(databaseId: string, filter?: Record<string, unknown>): Promise<NotionPageDelta[]>;
}
```

#### `ISteamClient`
Abstracción de interacción con Steam Web API y Store API:
```typescript
export interface SteamOwnedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  imgIconUrl?: string;
}

export interface SteamPlayerSummary {
  steamId: string;
  personaName: string;
  isPlaying: boolean;
  gameId?: number;
  gameExtraInfo?: string;
}

export interface SteamStoreDetails {
  appId: number;
  name: string;
  headerImage: string;
  genres: string[];
  shortDescription?: string;
}

export interface ISteamClient {
  getOwnedGames(steamId: string): Promise<SteamOwnedGame[]>;
  getPlayerSummary(steamId: string): Promise<SteamPlayerSummary>;
  getAppDetails(appId: number): Promise<SteamStoreDetails | null>;
}
```

#### `ITmdbClient`
Abstracción para la búsqueda y extracción de metadatos cinematográficos:
```typescript
export interface TmdbMovieMatch {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string;
  genres: string[];
}

export interface ITmdbClient {
  searchMovie(title: string, year?: number, language?: string): Promise<TmdbMovieMatch | null>;
  getMovieDetails(tmdbId: number, language?: string): Promise<TmdbMovieMatch | null>;
}
```

#### `IWikipediaClient` & `IHltbClient`
```typescript
export interface IWikipediaClient {
  searchArticleUrl(title: string, language?: string): Promise<string | null>;
}

export interface HltbEstimate {
  mainHours: number | null;
  completionistHours: number | null;
}

export interface IHltbClient {
  searchDuration(title: string): Promise<HltbEstimate>;
}
```

---

### 2. Selector Dinámico de IA Multi-Proveedor

#### `IAiProvider`
Contrato polimórfico implementado por cada motor de inferencia (Google Gemini, DeepSeek, Groq, Ollama):
```typescript
export interface AiEnrichmentResult {
  vibeTags: string[];
  personalizedPitch: string;
  thematicTropes: string[];
  completionEstimateWeeks?: number;
  rawResponse?: string;
}

export interface AiPromptPayload {
  title: string;
  type: "GAME" | "MOVIE";
  overview?: string;
  genres: string[];
  playtimeOrDuration?: string;
  userContext?: string;
}

export interface IAiProvider {
  readonly id: "gemini" | "deepseek" | "groq" | "ollama";
  readonly defaultModel: string;
  generateEnrichment(payload: AiPromptPayload, modelOverride?: string): Promise<AiEnrichmentResult>;
  testConnection(): Promise<boolean>;
}
```

#### `IGeminiEnricher` (Implementación Especializada `@google/genai`)
- Utiliza `gemini-2.5-flash` con `responseMimeType: "application/json"` y `responseJsonSchema` determinista.

---

### 3. Repositorios de Persistencia (SQLite / Prisma Ports)

#### `IGameRepository`
```typescript
export interface GameFilter {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface IGameRepository {
  findById(id: string): Promise<Game | null>;
  findByNotionPageId(notionPageId: string): Promise<Game | null>;
  findBySteamAppId(steamAppId: number): Promise<Game | null>;
  findByCleanTitle(cleanTitle: string): Promise<Game | null>;
  upsert(gameData: Partial<Game>): Promise<Game>;
  list(filter?: GameFilter): Promise<{ items: Game[]; total: number }>;
  updatePlaytime(id: string, playtimeForever: number, notionPlaytime?: number): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
}
```

#### `IMovieRepository`
```typescript
export interface MovieFilter {
  status?: string;
  search?: string;
  year?: number;
  limit?: number;
  offset?: number;
}

export interface IMovieRepository {
  findById(id: string): Promise<Movie | null>;
  findByNotionPageId(notionPageId: string): Promise<Movie | null>;
  findByTmdbId(tmdbId: number): Promise<Movie | null>;
  upsert(movieData: Partial<Movie>): Promise<Movie>;
  list(filter?: MovieFilter): Promise<{ items: Movie[]; total: number }>;
  updateStatus(id: string, status: string): Promise<void>;
}
```

#### `ISessionRepository` & `IDailyPlaytimeRepository`
```typescript
export interface ISessionRepository {
  findActiveSession(): Promise<GameSession | null>;
  startSession(gameId: string, steamAppId?: number, startedAt?: Date): Promise<GameSession>;
  closeSession(sessionId: string, endedAt: Date, durationMinutes: number): Promise<GameSession>;
  getRecentSessions(limit?: number): Promise<(GameSession & { game: Game })[]>;
}

export interface IDailyPlaytimeRepository {
  recordPlaytime(date: string, gameId: string, additionalMinutes: number): Promise<DailyPlaytime>;
  getTimeSeries(days: number): Promise<{ date: string; hours: number }[]>;
}
```

#### `IAiSettingsRepository` & `IAiEnrichmentRepository`
```typescript
export interface IAiSettingsRepository {
  getSettings(): Promise<AiSettings>;
  updateSettings(data: Partial<AiSettings>): Promise<AiSettings>;
}

export interface IAiEnrichmentRepository {
  findByTarget(targetType: "GAME" | "MOVIE", targetId: string): Promise<AiEnrichment | null>;
  findManyByTargets(targetType: "GAME" | "MOVIE", targetIds: string[]): Promise<Map<string, AiEnrichmentResult>>;
  getParsedEnrichment?(targetType: "GAME" | "MOVIE", targetId: string): Promise<AiEnrichmentResult | null>;
  upsert(data: Partial<AiEnrichment>): Promise<AiEnrichment>;
}
```

---

## ⚙️ Servicios Núcleo y Casos de Uso (Application Services)

### 1. `NotionDeltaPoller`
- **Responsabilidad:** Consultar periódicamente Notion con filtro `last_edited_time > watermark`.
- **Efectos Secundarios:**
  - Actualiza catálogo local SQLite sin sobreescribir campos protegidos.
  - Dispara enriquecimiento automático si el título no cuenta con metadatos.
  - Actualiza la marca de agua `sync_metadata.last_notion_sync_at`.

### 2. `SteamLiveMonitor`
- **Responsabilidad:** Consulta cada 60s `GetPlayerSummaries` de Steam.
- **Lógica de Transición de Estados:**
  - Si `isPlaying === true` y no hay sesión activa: invoca `startSession()`.
  - Si `isPlaying === false` y existe sesión activa: invoca `closeSession()`, calcula `durationMinutes` y actualiza `DailyPlaytime`.
  - Si el juego activo está en estado `"Por Jugar"`, promueve automáticamente su estado a `"Jugando"` tanto en SQLite como en Notion.

### 3. `AiSelectorService`
- **Responsabilidad:** Cargar el proveedor activo configurado en `ai_settings`, orquestar la llamada con fallback resiliente en caso de cuota excedida y persistir el resultado en `ai_enrichments`.

---

## 🛠️ Funciones Puras de Utilidad y Deduplicación

### `cleanGameTitle(title: string): string`
- Elimina sufijos de plataforma, marcas registradas (`™`, `®`, `©`), caracteres no alfanuméricos y espacios redundantes.
- Garantiza idempotencia: `cleanGameTitle("Cyberpunk 2077® (2020)") === "cyberpunk 2077 2020"`.

### `computeSimilarityRatio(strA: string, strB: string): number`
- Computa coeficiente Dice / Levenshtein normalizado entre 0.0 y 1.0.
- Si `ratio >= 0.85`, se consideran el mismo título para deduplicación.

---

## 🔄 Costuras de Flujo de Datos (Data Seams)

1. **Ingesta y Delta Polling:**
   `Notion REST API (Delta)` ➔ `NotionSyncClient` ➔ `NotionDeltaPoller` ➔ `GameRepository` / `MovieRepository` ➔ `SQLite (entertainment.db)`.
2. **Monitor en Vivo:**
   `Steam Web API` ➔ `SteamClient` ➔ `SteamLiveMonitor` ➔ `SessionRepository` ➔ `DailyPlaytimeRepository` ➔ SSE / Hono RPC `/api/live/status`.
3. **Pipeline de Enriquecimiento IA:**
   `Game / Movie sin Vibe` ➔ `AiSelectorService` ➔ `IAiProvider (Gemini/Groq/Ollama)` ➔ `AiEnrichmentRepository` ➔ `NotionSyncClient (Patch Vibe & Pitch)` ➔ `Next.js Showcase UI`.
