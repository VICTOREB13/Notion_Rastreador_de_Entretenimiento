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

    let existing: Movie | null = null;
    if (data.notionPageId) {
      existing = await prisma.movie.findUnique({ where: { notionPageId: data.notionPageId } });
    }
    if (!existing && data.tmdbId) {
      existing = await prisma.movie.findFirst({ where: { tmdbId: data.tmdbId } });
    }
    if (!existing && normalizedCleanTitle) {
      existing = await prisma.movie.findFirst({ where: { cleanTitle: normalizedCleanTitle } });
    }

    if (existing) {
      // Coalescer duplicados si existen
      const duplicateConditions: Prisma.MovieWhereInput[] = [];
      if (data.tmdbId) {
        duplicateConditions.push({ tmdbId: data.tmdbId });
      }
      if (normalizedCleanTitle) {
        duplicateConditions.push({ cleanTitle: normalizedCleanTitle });
      }

      const duplicates = duplicateConditions.length > 0
        ? await prisma.movie.findMany({
            where: {
              id: { not: existing.id },
              OR: duplicateConditions,
            },
          })
        : [];

      let inheritedTmdbId = existing.tmdbId;
      let inheritedPosterUrl = existing.posterUrl;
      let inheritedOverview = existing.overview;
      let inheritedWikiUrl = existing.wikiUrl;
      let inheritedYear = existing.year;
      let inheritedCompletionDate = existing.completionDate;
      let inheritedRating = existing.rating;
      let inheritedSummary = existing.summary;

      for (const duplicate of duplicates) {
        if (!inheritedTmdbId && duplicate.tmdbId) inheritedTmdbId = duplicate.tmdbId;
        if (!inheritedPosterUrl && duplicate.posterUrl) inheritedPosterUrl = duplicate.posterUrl;
        if (!inheritedOverview && duplicate.overview) inheritedOverview = duplicate.overview;
        if (!inheritedWikiUrl && duplicate.wikiUrl) inheritedWikiUrl = duplicate.wikiUrl;
        if (!inheritedYear && duplicate.year) inheritedYear = duplicate.year;
        if (!inheritedCompletionDate && duplicate.completionDate) inheritedCompletionDate = duplicate.completionDate;
        if (inheritedRating === null && duplicate.rating !== null) inheritedRating = duplicate.rating;
        if (!inheritedSummary && duplicate.summary) inheritedSummary = duplicate.summary;

        await prisma.movie.delete({ where: { id: duplicate.id } });
      }

      return prisma.movie.update({
        where: { id: existing.id },
        data: {
          title: data.title ?? existing.title,
          cleanTitle: normalizedCleanTitle,
          notionPageId: data.notionPageId ?? existing.notionPageId,
          tmdbId: data.tmdbId ?? inheritedTmdbId,
          posterUrl: data.posterUrl ?? inheritedPosterUrl,
          overview: data.overview ?? inheritedOverview,
          genres: data.genres ?? existing.genres,
          wikiUrl: data.wikiUrl ?? inheritedWikiUrl,
          status: data.status ?? existing.status,
          year: data.year ?? inheritedYear,
          completionDate: data.completionDate ?? inheritedCompletionDate,
          rating: data.rating !== undefined ? data.rating : inheritedRating,
          summary: data.summary ?? inheritedSummary,
          lastSyncAt: data.lastSyncAt ?? existing.lastSyncAt,
        },
      });
    }

    return prisma.movie.create({
      data: {
        ...data,
        cleanTitle: normalizedCleanTitle,
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
