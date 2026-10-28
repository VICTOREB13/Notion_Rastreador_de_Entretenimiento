import { prisma, configurePragmas } from "./client";

export async function seedDatabase() {
  console.log("🌱 Inicializando seed en SQLite (entertainment.db)...");

  // Configurar pragmas SQLite (WAL mode, busy_timeout, foreign_keys)
  await configurePragmas(prisma);

  // 1. Configuración por defecto de IA
  const aiSettings = await prisma.aiSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      activeProvider: "gemini",
      selectedModel: "gemini-2.5-flash",
      temperature: 0.7,
      ollamaBaseUrl: "http://localhost:11434",
    },
  });
  console.log(`✅ AiSettings configurado con proveedor: ${aiSettings.activeProvider}`);

  // 2. Videojuego de prueba
  const game = await prisma.game.upsert({
    where: { notionPageId: "seed-notion-game-1" },
    update: {},
    create: {
      notionPageId: "seed-notion-game-1",
      title: "Cyberpunk 2077",
      cleanTitle: "cyberpunk 2077",
      steamAppId: 1091500,
      playtimeForever: 54.2,
      playtimeNotion: 54.2,
      hltbMain: 25.0,
      hltbCompletionist: 103.0,
      coverUrl: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg",
      genres: JSON.stringify(["RPG", "Acción", "Mundo Abierto"]),
      link: "https://store.steampowered.com/app/1091500",
      platform: "PC",
      status: "Jugando",
      startDate: "2026-09-15",
      lastSyncAt: new Date(),
    },
  });
  console.log(`✅ Juego creado/actualizado: ${game.title} (${game.id})`);

  // 3. Película de prueba
  const movie = await prisma.movie.upsert({
    where: { notionPageId: "seed-notion-movie-1" },
    update: {},
    create: {
      notionPageId: "seed-notion-movie-1",
      title: "Oppenheimer",
      cleanTitle: "oppenheimer",
      tmdbId: 872585,
      posterUrl: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
      overview: "Historia del físico teórico estadounidense J. Robert Oppenheimer y el desarrollo de la bomba atómica.",
      genres: JSON.stringify(["Drama", "Historia"]),
      wikiUrl: "https://es.wikipedia.org/wiki/Oppenheimer_(pel%C3%ADcula)",
      status: "Vista",
      year: 2023,
      lastSyncAt: new Date(),
    },
  });
  console.log(`✅ Película creada/actualizada: ${movie.title} (${movie.id})`);

  // 4. Sesión de juego de prueba
  const session = await prisma.gameSession.create({
    data: {
      gameId: game.id,
      steamAppId: game.steamAppId,
      startedAt: new Date(Date.now() - 45 * 60 * 1000),
      endedAt: new Date(),
      durationMinutes: 45,
      isLive: false,
    },
  });
  console.log(`✅ Sesión registrada: ${session.durationMinutes} min`);

  // 5. Agregado diario de tiempo (Idempotente)
  const today = new Date().toISOString().slice(0, 10);
  await prisma.dailyPlaytime.upsert({
    where: {
      date_gameId: {
        date: today,
        gameId: game.id,
      },
    },
    update: {
      minutes: 45,
    },
    create: {
      date: today,
      gameId: game.id,
      minutes: 45,
    },
  });
  console.log(`✅ Tiempo diario actualizado para ${today}`);

  // 6. Enriquecimiento de IA de prueba
  await prisma.aiEnrichment.upsert({
    where: {
      targetType_targetId: {
        targetType: "GAME",
        targetId: game.id,
      },
    },
    update: {},
    create: {
      targetType: "GAME",
      targetId: game.id,
      vibeTags: JSON.stringify(["Distopía Neón", "Adrenalina Pura", "Cerebral"]),
      personalizedPitch: "Inmersión cruda en Night City ideal para sesiones nocturnas con historia madura.",
      thematicTropes: JSON.stringify(["Ciberimplantes", "Mega-Corporaciones", "Anti-Héroe"]),
      completionEstimateWeeks: 3.5,
      provider: "gemini",
      modelUsed: "gemini-2.5-flash",
    },
  });
  console.log(`✅ Enriquecimiento IA registrado`);
}

if (import.meta.main) {
  seedDatabase()
    .catch((err) => {
      console.error("❌ Error en seed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
