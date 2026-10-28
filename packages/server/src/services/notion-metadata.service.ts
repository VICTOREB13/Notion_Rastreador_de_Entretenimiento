import type {
  INotionSyncClient,
  ITmdbClient,
  IWikipediaClient,
  IMovieRepository,
  NotionPageDelta,
} from "@repo/database";
import { movieRepository, cleanGameTitle } from "@repo/database";
import { notionClient } from "../clients/notion.client";
import { tmdbClient, TmdbClient } from "../clients/tmdb.client";
import { wikipediaClient } from "../clients/wikipedia.client";
import { broadcastEvent } from "../controllers/events.controller";
import { config } from "../config";
import { findNotionProp, findNotionPropKey, extractNotionTitle } from "./notion-props.helper";

export interface MetadataEnricherResult {
  moviesProcessed: number;
  moviesEnriched: number;
  moviesSkipped: number;
  durationMs: number;
}

export class NotionMetadataEnricherService {
  constructor(
    private notion: INotionSyncClient = notionClient,
    private tmdb: ITmdbClient = tmdbClient,
    private wiki: IWikipediaClient = wikipediaClient,
    private movieRepo: IMovieRepository = movieRepository,
    private moviesDbId: string = config.notionDatabaseIdMovies,
    private rateLimitDelayMs: number = 350
  ) {}

  private async sleep(): Promise<void> {
    if (this.rateLimitDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs));
    }
  }

  /**
   * Revisa películas en Notion y enriquece metadatos faltantes (Portada, Sinopsis, Géneros, Wikipedia).
   * Implementa el candado de protección estricto de movies.py para evitar consultas innecesarias.
   */
  async enrichMovies(): Promise<MetadataEnricherResult> {
    const startMs = Date.now();
    let moviesProcessed = 0;
    let moviesEnriched = 0;
    let moviesSkipped = 0;

    if (!this.moviesDbId) {
      return {
        moviesProcessed: 0,
        moviesEnriched: 0,
        moviesSkipped: 0,
        durationMs: Date.now() - startMs,
      };
    }

    const pages = await this.notion.fetchAllPages(this.moviesDbId);
    moviesProcessed = pages.length;

    for (const page of pages) {
      if (page.archived) continue;
      const props = page.properties as Record<string, any>;
      const rawTitle = extractNotionTitle(props);

      if (!rawTitle) {
        moviesSkipped++;
        continue;
      }

      const portadaProp = findNotionProp(props, ["Portada", "Cover", "Imagen", "Poster", "Póster"]);
      const linkProp = findNotionProp(props, ["Link", "URL", "Wikipedia", "Enlace"]);
      const resumenProp = findNotionProp(props, [
        "Resumen",
        "Sinopsis",
        "Overview",
        "Descripción",
        "Descripcion",
      ]);
      const generosProp = findNotionProp(props, [
        "Géneros",
        "Género",
        "Generos",
        "Genero",
        "Genres",
        "Genre",
      ]);

      // CHEQUEO DE PROTECCIÓN ("Candado")
      const faltaFoto = !(
        (portadaProp?.files && Array.isArray(portadaProp.files) && portadaProp.files.length > 0) ||
        page.cover
      );
      const faltaLink = !linkProp?.url;
      const faltaResumen = !(
        resumenProp?.rich_text &&
        Array.isArray(resumenProp.rich_text) &&
        resumenProp.rich_text.length > 0
      );
      const faltaGenero = !(
        (generosProp?.multi_select &&
          Array.isArray(generosProp.multi_select) &&
          generosProp.multi_select.length > 0) ||
        generosProp?.select?.name
      );

      // Si no falta nada, omitir para ahorrar llamadas a las APIs de TMDB y Wikipedia
      if (!faltaFoto && !faltaLink && !faltaResumen && !faltaGenero) {
        moviesSkipped++;
        continue;
      }

      let tmdbData = null;
      if (faltaFoto || faltaResumen || faltaGenero) {
        tmdbData = await this.tmdb.searchMovie(rawTitle);
      }

      let wikiUrl: string | null = null;
      if (faltaLink) {
        wikiUrl = this.wiki.searchMovieWikiUrl
          ? await this.wiki.searchMovieWikiUrl(rawTitle)
          : await this.wiki.searchArticleUrl(rawTitle);
      }

      let hayCambios = false;
      const payloadProps: Record<string, any> = {};
      let coverPayload: any = undefined;
      let iconPayload: any = undefined;

      const targetPortada =
        findNotionPropKey(props, ["Portada", "Cover", "Imagen", "Poster", "Póster"]) || "Portada";
      const targetResumen =
        findNotionPropKey(props, ["Resumen", "Sinopsis", "Overview", "Descripción", "Descripcion"]) || "Resumen";
      const targetGeneros =
        findNotionPropKey(props, ["Géneros", "Género", "Generos", "Genero", "Genres", "Genre"]) || "Géneros";
      const targetLink =
        findNotionPropKey(props, ["Link", "URL", "Wikipedia", "Enlace"]) || "Link";

      if (faltaFoto && tmdbData?.posterPath) {
        payloadProps[targetPortada] = {
          files: [{ type: "external", name: "Poster", external: { url: tmdbData.posterPath } }],
        };
        coverPayload = { type: "external", external: { url: tmdbData.posterPath } };
        iconPayload = { type: "external", external: { url: tmdbData.posterPath } };
        hayCambios = true;
      }

      if (faltaResumen && tmdbData?.overview) {
        payloadProps[targetResumen] = {
          rich_text: [{ text: { content: tmdbData.overview.slice(0, 1900) } }],
        };
        hayCambios = true;
      }

      if (faltaGenero && tmdbData?.genres && tmdbData.genres.length > 0) {
        if (generosProp && "select" in generosProp) {
          payloadProps[targetGeneros] = { select: { name: tmdbData.genres[0] } };
        } else {
          payloadProps[targetGeneros] = {
            multi_select: tmdbData.genres.map((name) => ({ name })),
          };
        }
        hayCambios = true;
      }

      if (faltaLink && wikiUrl) {
        payloadProps[targetLink] = { url: wikiUrl };
        hayCambios = true;
      }

      if (hayCambios) {
        if (this.notion.updatePage) {
          await this.notion.updatePage(page.id, {
            properties: payloadProps,
            cover: coverPayload,
            icon: iconPayload,
          });
        } else {
          await this.notion.updatePageProperties(page.id, payloadProps);
        }
        moviesEnriched++;

        // Actualizar base local SQLite
        const { title: cleanBaseTitle, year: parsedYear } = TmdbClient.extractTitleAndYear(rawTitle);
        await this.movieRepo.upsert({
          notionPageId: page.id,
          title: rawTitle,
          cleanTitle: cleanGameTitle(cleanBaseTitle),
          tmdbId: tmdbData?.id || undefined,
          posterUrl: tmdbData?.posterPath || null,
          overview: tmdbData?.overview || null,
          genres: JSON.stringify(tmdbData?.genres || []),
          wikiUrl: wikiUrl || null,
          status: "Por Ver",
          year: parsedYear || undefined,
        });

        await this.sleep();
      } else {
        moviesSkipped++;
      }
    }

    const durationMs = Date.now() - startMs;
    if (moviesEnriched > 0) {
      broadcastEvent("catalog_updated", {
        type: "movies",
        enriched: moviesEnriched,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      moviesProcessed,
      moviesEnriched,
      moviesSkipped,
      durationMs,
    };
  }
}

export const notionMetadataEnricherService = new NotionMetadataEnricherService();
