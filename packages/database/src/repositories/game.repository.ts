import { prisma } from "../client";
import type { Game, Prisma } from "@prisma/client";
import type { IGameRepository, GameFilter } from "../interfaces";
import { cleanGameTitle } from "../utils/normalizer";

export class GameRepository implements IGameRepository {
  async findById(id: string): Promise<Game | null> {
    return prisma.game.findUnique({ where: { id } });
  }

  async findByNotionPageId(notionPageId: string): Promise<Game | null> {
    return prisma.game.findUnique({ where: { notionPageId } });
  }

  async findBySteamAppId(steamAppId: number): Promise<Game | null> {
    return prisma.game.findFirst({ where: { steamAppId } });
  }

  async findByCleanTitle(cleanTitle: string): Promise<Game | null> {
    const normalized = cleanGameTitle(cleanTitle);
    return prisma.game.findFirst({ where: { cleanTitle: normalized } });
  }

  async upsert(data: Prisma.GameCreateInput): Promise<Game> {
    const normalizedCleanTitle = data.cleanTitle ? cleanGameTitle(data.cleanTitle) : cleanGameTitle(data.title);

    const completedAt = data.completedAt ?? data.completionDate ?? null;
    const completionDate = data.completionDate ?? data.completedAt ?? null;
    const userNotes = data.userNotes ?? data.personalSummary ?? data.summary ?? null;
    const personalSummary = data.personalSummary ?? data.userNotes ?? data.summary ?? null;
    const summary = data.summary ?? data.personalSummary ?? data.userNotes ?? null;
    const genres = data.genres ?? data.notionGenres ?? "[]";
    const notionGenres = data.notionGenres ?? data.genres ?? "[]";

    // 1. Buscar si ya existe por notionPageId, steamAppId, o cleanTitle normalizado
    let existing: Game | null = null;
    if (data.notionPageId) {
      existing = await prisma.game.findUnique({ where: { notionPageId: data.notionPageId } });
    }
    if (!existing && data.steamAppId) {
      existing = await prisma.game.findFirst({ where: { steamAppId: data.steamAppId } });
    }
    if (!existing && normalizedCleanTitle) {
      if (data.steamAppId) {
        existing = await prisma.game.findFirst({
          where: {
            cleanTitle: normalizedCleanTitle,
            OR: [{ steamAppId: null }, { steamAppId: data.steamAppId }],
          },
        });
      } else {
        existing = await prisma.game.findFirst({ where: { cleanTitle: normalizedCleanTitle } });
      }
    }

    if (existing) {
      // Coalescencia anti-split-brain: buscar TODOS los registros divergentes que coincidan por steamAppId o cleanTitle
      const duplicateConditions: Prisma.GameWhereInput[] = [];
      if (data.steamAppId) {
        duplicateConditions.push({ steamAppId: data.steamAppId });
      }
      if (normalizedCleanTitle) {
        duplicateConditions.push({
          cleanTitle: normalizedCleanTitle,
          OR: [{ steamAppId: null }, ...(data.steamAppId ? [{ steamAppId: data.steamAppId }] : [])],
        });
      }

      const duplicates = duplicateConditions.length > 0
        ? await prisma.game.findMany({
            where: {
              id: { not: existing.id },
              OR: duplicateConditions,
            },
          })
        : [];

      // Consolidar datos de duplicados en existing antes de eliminarlos
      let inheritedSteamAppId = existing.steamAppId;
      let inheritedRating = existing.rating;
      let inheritedCompletedAt = existing.completedAt;
      let inheritedCompletionDate = existing.completionDate;
      let inheritedCoverUrl = existing.coverUrl;
      let inheritedHltbMain = existing.hltbMain;
      let inheritedHltbCompletionist = existing.hltbCompletionist;
      let inheritedUserNotes = existing.userNotes;
      let inheritedSummary = existing.summary;
      let inheritedPersonalSummary = existing.personalSummary;
      let inheritedLink = existing.link;
      let maxDuplicatePlaytime = existing.playtimeForever;

      for (const duplicate of duplicates) {
        if (!inheritedSteamAppId && duplicate.steamAppId) inheritedSteamAppId = duplicate.steamAppId;
        if (inheritedRating === null && duplicate.rating !== null) inheritedRating = duplicate.rating;
        if (!inheritedCompletedAt && duplicate.completedAt) inheritedCompletedAt = duplicate.completedAt;
        if (!inheritedCompletionDate && duplicate.completionDate) inheritedCompletionDate = duplicate.completionDate;
        if (!inheritedCoverUrl && duplicate.coverUrl) inheritedCoverUrl = duplicate.coverUrl;
        if (inheritedHltbMain === null && duplicate.hltbMain !== null) inheritedHltbMain = duplicate.hltbMain;
        if (inheritedHltbCompletionist === null && duplicate.hltbCompletionist !== null) inheritedHltbCompletionist = duplicate.hltbCompletionist;
        if (!inheritedUserNotes && duplicate.userNotes) inheritedUserNotes = duplicate.userNotes;
        if (!inheritedSummary && duplicate.summary) inheritedSummary = duplicate.summary;
        if (!inheritedPersonalSummary && duplicate.personalSummary) inheritedPersonalSummary = duplicate.personalSummary;
        if (!inheritedLink && duplicate.link) inheritedLink = duplicate.link;
        if (duplicate.playtimeForever > maxDuplicatePlaytime) maxDuplicatePlaytime = duplicate.playtimeForever;

        // Migrar sesiones activas e históricas
        await prisma.gameSession.updateMany({
          where: { gameId: duplicate.id },
          data: { gameId: existing.id },
        });

        // Migrar series temporales de DailyPlaytime sin pérdida de datos
        const duplicateDailyPlaytimes = await prisma.dailyPlaytime.findMany({
          where: { gameId: duplicate.id },
        });

        for (const dp of duplicateDailyPlaytimes) {
          const existingDp = await prisma.dailyPlaytime.findUnique({
            where: {
              date_gameId: {
                date: dp.date,
                gameId: existing.id,
              },
            },
          });

          if (existingDp) {
            await prisma.dailyPlaytime.update({
              where: { id: existingDp.id },
              data: { minutes: existingDp.minutes + dp.minutes },
            });
            await prisma.dailyPlaytime.delete({
              where: { id: dp.id },
            });
          } else {
            await prisma.dailyPlaytime.update({
              where: { id: dp.id },
              data: { gameId: existing.id },
            });
          }
        }

        // Eliminar registro duplicado coalescido
        await prisma.game.delete({
          where: { id: duplicate.id },
        });
      }

      const resolvedPlaytimeForever = Math.max(
        data.playtimeForever !== undefined ? data.playtimeForever : existing.playtimeForever,
        maxDuplicatePlaytime
      );

      const resolvedStatus = (existing.status === "Jugado" && data.status === "Por Jugar")
        ? "Jugado"
        : (data.status ?? existing.status);

      const updateData: Prisma.GameUpdateInput = {
        title: data.title ?? existing.title,
        cleanTitle: normalizedCleanTitle,
        notionPageId: data.notionPageId ?? existing.notionPageId,
        steamAppId: data.steamAppId ?? inheritedSteamAppId,
        playtimeForever: resolvedPlaytimeForever,
        playtimeNotion: data.playtimeNotion !== undefined ? data.playtimeNotion : existing.playtimeNotion,
        hltbMain: data.hltbMain ?? inheritedHltbMain,
        hltbCompletionist: data.hltbCompletionist ?? inheritedHltbCompletionist,
        coverUrl: data.coverUrl || inheritedCoverUrl,
        genres: data.genres ?? (existing.genres || genres),
        notionGenres: data.notionGenres ?? (existing.notionGenres || notionGenres),
        rating: data.rating !== undefined ? data.rating : inheritedRating,
        completedAt: completedAt ?? inheritedCompletedAt,
        completionDate: completionDate ?? inheritedCompletionDate,
        userNotes: userNotes ?? inheritedUserNotes,
        personalSummary: personalSummary ?? inheritedPersonalSummary,
        summary: summary ?? inheritedSummary,
        link: data.link ?? inheritedLink,
        platform: data.platform ?? existing.platform,
        status: resolvedStatus,
        startDate: data.startDate ?? existing.startDate,
        lastSyncAt: data.lastSyncAt ?? existing.lastSyncAt,
      };

      return prisma.game.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    return prisma.game.create({
      data: {
        ...data,
        cleanTitle: normalizedCleanTitle,
        genres,
        notionGenres,
        completedAt: completedAt ?? undefined,
        completionDate: completionDate ?? undefined,
        userNotes: userNotes ?? undefined,
        personalSummary: personalSummary ?? undefined,
        summary: summary ?? undefined,
      },
    });
  }

  async list(filter: GameFilter = {}): Promise<{ items: Game[]; total: number }> {
    const where: Prisma.GameWhereInput = {};

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.search) {
      where.title = { contains: filter.search };
    }

    const take = filter.all ? undefined : (filter.limit ?? 50);
    const skip = filter.all ? undefined : (filter.offset ?? 0);

    const [items, total] = await Promise.all([
      prisma.game.findMany({
        where,
        take,
        skip,
        orderBy: { title: "asc" },
      }),
      prisma.game.count({ where }),
    ]);

    return { items, total };
  }

  async updatePlaytime(id: string, playtimeForever: number, playtimeNotion?: number): Promise<Game> {
    return prisma.game.update({
      where: { id },
      data: {
        playtimeForever,
        ...(playtimeNotion !== undefined ? { playtimeNotion } : {}),
        lastSyncAt: new Date(),
      },
    });
  }

  async updateStatus(id: string, status: string): Promise<Game> {
    return prisma.game.update({
      where: { id },
      data: { status, lastSyncAt: new Date() },
    });
  }

  async delete(id: string): Promise<Game> {
    return prisma.game.delete({ where: { id } });
  }
}

export const gameRepository = new GameRepository();
