-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notionPageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cleanTitle" TEXT NOT NULL,
    "steamAppId" INTEGER,
    "playtimeForever" REAL NOT NULL DEFAULT 0.0,
    "playtimeNotion" REAL NOT NULL DEFAULT 0.0,
    "hltbMain" REAL,
    "hltbCompletionist" REAL,
    "coverUrl" TEXT,
    "genres" TEXT NOT NULL DEFAULT '[]',
    "link" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'PC',
    "status" TEXT NOT NULL DEFAULT 'Por Jugar',
    "startDate" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "movies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notionPageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cleanTitle" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "posterUrl" TEXT,
    "overview" TEXT,
    "genres" TEXT NOT NULL DEFAULT '[]',
    "wikiUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Por Ver',
    "year" INTEGER,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "steamAppId" INTEGER,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "game_sessions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_playtime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "daily_playtime_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_enrichments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "vibeTags" TEXT NOT NULL DEFAULT '[]',
    "personalizedPitch" TEXT NOT NULL,
    "thematicTropes" TEXT NOT NULL DEFAULT '[]',
    "completionEstimateWeeks" REAL,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "modelUsed" TEXT NOT NULL,
    "rawResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "activeProvider" TEXT NOT NULL DEFAULT 'gemini',
    "geminiApiKey" TEXT,
    "deepseekApiKey" TEXT,
    "groqApiKey" TEXT,
    "ollamaBaseUrl" TEXT DEFAULT 'http://localhost:11434',
    "selectedModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "games_notionPageId_key" ON "games"("notionPageId");

-- CreateIndex
CREATE INDEX "games_status_cleanTitle_idx" ON "games"("status", "cleanTitle");

-- CreateIndex
CREATE INDEX "games_steamAppId_idx" ON "games"("steamAppId");

-- CreateIndex
CREATE INDEX "games_notionPageId_idx" ON "games"("notionPageId");

-- CreateIndex
CREATE UNIQUE INDEX "movies_notionPageId_key" ON "movies"("notionPageId");

-- CreateIndex
CREATE INDEX "movies_status_cleanTitle_idx" ON "movies"("status", "cleanTitle");

-- CreateIndex
CREATE INDEX "movies_tmdbId_idx" ON "movies"("tmdbId");

-- CreateIndex
CREATE INDEX "movies_notionPageId_idx" ON "movies"("notionPageId");

-- CreateIndex
CREATE INDEX "game_sessions_gameId_startedAt_idx" ON "game_sessions"("gameId", "startedAt");

-- CreateIndex
CREATE INDEX "game_sessions_isLive_idx" ON "game_sessions"("isLive");

-- CreateIndex
CREATE INDEX "daily_playtime_date_idx" ON "daily_playtime"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_playtime_date_gameId_key" ON "daily_playtime"("date", "gameId");

-- CreateIndex
CREATE INDEX "ai_enrichments_targetType_idx" ON "ai_enrichments"("targetType");

-- CreateIndex
CREATE UNIQUE INDEX "ai_enrichments_targetType_targetId_key" ON "ai_enrichments"("targetType", "targetId");
