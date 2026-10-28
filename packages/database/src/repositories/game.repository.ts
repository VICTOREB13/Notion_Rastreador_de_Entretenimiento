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

    return prisma.game.upsert({
      where: { notionPageId: data.notionPageId },
      create: {
        ...data,
        cleanTitle: normalizedCleanTitle,
      },
      update: {
        title: data.title,
        cleanTitle: normalizedCleanTitle,
        steamAppId: data.steamAppId,
        playtimeForever: data.playtimeForever,
        playtimeNotion: data.playtimeNotion,
        hltbMain: data.hltbMain,
        hltbCompletionist: data.hltbCompletionist,
        coverUrl: data.coverUrl,
        genres: data.genres,
        link: data.link,
        platform: data.platform,
        status: data.status,
        startDate: data.startDate,
        lastSyncAt: data.lastSyncAt,
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

    const [items, total] = await Promise.all([
      prisma.game.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
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
