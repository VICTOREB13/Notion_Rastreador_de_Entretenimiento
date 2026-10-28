import { prisma } from "../client";
import type { Movie, Prisma } from "@prisma/client";
import type { IMovieRepository, MovieFilter } from "../interfaces";
import { cleanGameTitle } from "../utils/normalizer";

export class MovieRepository implements IMovieRepository {
  async findById(id: string): Promise<Movie | null> {
    return prisma.movie.findUnique({ where: { id } });
  }

  async findByNotionPageId(notionPageId: string): Promise<Movie | null> {
    return prisma.movie.findUnique({ where: { notionPageId } });
  }

  async findByTmdbId(tmdbId: number): Promise<Movie | null> {
    return prisma.movie.findFirst({ where: { tmdbId } });
  }

  async findByCleanTitle(cleanTitle: string): Promise<Movie | null> {
    const normalized = cleanGameTitle(cleanTitle);
    return prisma.movie.findFirst({ where: { cleanTitle: normalized } });
  }

  async upsert(data: Prisma.MovieCreateInput): Promise<Movie> {
    const normalizedCleanTitle = data.cleanTitle ? cleanGameTitle(data.cleanTitle) : cleanGameTitle(data.title);

    return prisma.movie.upsert({
      where: { notionPageId: data.notionPageId },
      create: {
        ...data,
        cleanTitle: normalizedCleanTitle,
      },
      update: {
        title: data.title,
        cleanTitle: normalizedCleanTitle,
        tmdbId: data.tmdbId,
        posterUrl: data.posterUrl,
        overview: data.overview,
        genres: data.genres,
        wikiUrl: data.wikiUrl,
        status: data.status,
        year: data.year,
        lastSyncAt: data.lastSyncAt,
      },
    });
  }

  async list(filter: MovieFilter = {}): Promise<{ items: Movie[]; total: number }> {
    const where: Prisma.MovieWhereInput = {};

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.search) {
      where.title = { contains: filter.search };
    }

    if (filter.year) {
      where.year = filter.year;
    }

    const [items, total] = await Promise.all([
      prisma.movie.findMany({
        where,
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
        orderBy: { title: "asc" },
      }),
      prisma.movie.count({ where }),
    ]);

    return { items, total };
  }

  async updateStatus(id: string, status: string): Promise<Movie> {
    return prisma.movie.update({
      where: { id },
      data: { status, lastSyncAt: new Date() },
    });
  }

  async delete(id: string): Promise<Movie> {
    return prisma.movie.delete({ where: { id } });
  }
}

export const movieRepository = new MovieRepository();
