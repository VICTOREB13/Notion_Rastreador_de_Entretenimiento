import type {
  ISteamClient,
  INotionSyncClient,
  IRawgClient,
  IHltbClient,
  IWikipediaClient,
  IGameRepository,
  NotionPageDelta,
  SteamOwnedGame,
} from "@repo/database";
import {
  gameRepository,
  cleanGameTitle,
  computeSimilarityRatio,
  formatLocalDate,
} from "@repo/database";
import { steamClient } from "../clients/steam.client";
import { notionClient } from "../clients/notion.client";
import { rawgClient } from "../clients/rawg.client";
import { hltbClient } from "../clients/hltb.client";
import { wikipediaClient } from "../clients/wikipedia.client";
import { broadcastEvent } from "../controllers/events.controller";
import { config } from "../config";
import {
  findNotionProp,
  findNotionPropKey,
  extractNotionTitle,
  extractNotionNumber,
  extractNotionStatus,
  hasNotionDate,
  hasNotionCover,
  hasNotionGenres,
} from "./notion-props.helper";

export interface SteamSyncResult {
  scannedSteam: number;
  updatedNotion: number;
  createdNotion: number;
  skippedLowPlaytime: number;
  durationMs: number;
}

export class SteamToNotionSyncService {
  constructor(
    private steam: ISteamClient = steamClient,
    private notion: INotionSyncClient = notionClient,
    private rawg: IRawgClient = rawgClient,
    private hltb: IHltbClient = hltbClient,
    private wiki: IWikipediaClient = wikipediaClient,
    private gameRepo: IGameRepository = gameRepository,
    private steamUserId: string = config.steamUserId,
    private gamesDbId: string = config.notionDatabaseIdGames,
    private rateLimitDelayMs: number = 350
  ) {}

  private async sleep(): Promise<void> {
    if (this.rateLimitDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.rateLimitDelayMs));
    }
  }

  /**
   * Ejecuta la sincronización completa y determinista desde Steam hacia Notion (SSoT).
   * Respeta fielmente todas las validaciones de games.py:
   * - Filtro mínimo de 30 minutos (0.5h).
   * - Triple estrategia de matching (Steam ID, nombre limpio, fuzzy ratio >= 0.90).
   * - Preservación absoluta de cuota RAWG: NUNCA consulta si la página ya tiene portada y géneros.
   * - Preservación de estados: solo actualiza horas a menos que aplique la auto-culminación HLTB.
   * - Auto-culminación HLTB: horas >= HLTB Principal pasa a "Jugado" con fecha de culminación.
   * - Emisión reactiva de evento SSE catalog_updated.
   */
  async syncSteamToNotion(): Promise<SteamSyncResult> {
    const startMs = Date.now();
    let scannedSteam = 0;
    let updatedNotion = 0;
    let createdNotion = 0;
    let skippedLowPlaytime = 0;

    if (!this.gamesDbId) {
      console.warn("[SteamToNotionSync] No games database ID configured. Skipping.");
      return {
        scannedSteam: 0,
        updatedNotion: 0,
        createdNotion: 0,
        skippedLowPlaytime: 0,
        durationMs: Date.now() - startMs,
      };
    }

    // 1. Leer todas las páginas actuales de Notion
    const notionPages = await this.notion.fetchAllPages(this.gamesDbId);
    console.log(`[SteamToNotionSync] Leídas ${notionPages.length} páginas desde Notion`);

    // Índices auxiliares para búsqueda rápida en Notion
    const notionBySteamId = new Map<number, NotionPageDelta>();
    const notionByCleanTitle = new Map<string, NotionPageDelta>();
    const allNotionRecords: Array<{ cleanTitle: string; page: NotionPageDelta }> = [];

    for (const page of notionPages) {
      if (page.archived) continue;
      const props = page.properties as Record<string, any>;
      const title = extractNotionTitle(props);
      const steamId = extractNotionNumber(props, ["Steam ID", "SteamId", "AppId"]);

      if (steamId) {
        notionBySteamId.set(steamId, page);
      }
      if (title) {
        const clean = cleanGameTitle(title);
        notionByCleanTitle.set(clean, page);
        allNotionRecords.push({ cleanTitle: clean, page });
      }
    }

    // 2. Obtener catálogo combinado de Steam (propios + Family Sharing)
    let steamGames: SteamOwnedGame[] = [];
    if (this.steam.getCombinedGames) {
      steamGames = await this.steam.getCombinedGames(this.steamUserId);
    } else {
      steamGames = await this.steam.getOwnedGames(this.steamUserId);
    }

    scannedSteam = steamGames.length;
    console.log(`[SteamToNotionSync] Obtenidos ${steamGames.length} juegos desde Steam`);

    // 3. Procesar cada juego de Steam
    for (const g of steamGames) {
      const hours = g.playtimeMinutes / 60;

      // FILTRO ESTRICTO: Ignorar juegos con menos de 30 minutos (0.5 horas)
      if (hours < 0.5) {
        skippedLowPlaytime++;
        continue;
      }

      const steamCleanTitle = cleanGameTitle(g.name);

      // TRIPLE ESTRATEGIA DE MATCHING
      let matchedPage: NotionPageDelta | null = null;

      // Intento 1: Búsqueda exacta por Steam ID
      if (notionBySteamId.has(g.appId)) {
        matchedPage = notionBySteamId.get(g.appId)!;
      }
      // Intento 2: Búsqueda exacta por título normalizado/limpio
      else if (notionByCleanTitle.has(steamCleanTitle)) {
        matchedPage = notionByCleanTitle.get(steamCleanTitle)!;
      }
      // Intento 3: Búsqueda por similitud difusa (fuzzy ratio >= 0.90)
      else {
        let bestRatio = 0.9;
        for (const record of allNotionRecords) {
          const ratio = computeSimilarityRatio(steamCleanTitle, record.cleanTitle);
          if (ratio >= bestRatio) {
            bestRatio = ratio;
            matchedPage = record.page;
          }
        }
      }

      if (matchedPage) {
        // --- JUEGO YA EXISTE EN NOTION ---
        const props = matchedPage.properties as Record<string, any>;
        const horasActuales = extractNotionNumber(props, ["Horas Jugadas", "Horas jugadas", "Hours Played"]) ?? 0;
        const tieneFechaInicio = hasNotionDate(props, ["Fecha de Inicio", "Fecha de inicio", "Start Date", "StartDate"]);
        const tieneFechaCulm = hasNotionDate(props, [
          "Fecha de Culminación (primera campaña)",
          "Fecha de Finalización",
          "Fecha de Finalizacion",
          "Fecha de Culminacion",
          "Fecha de Fin",
        ]);
        let hltbPrincipal = extractNotionNumber(props, ["HLTB Principal", "HLTB Main"]);
        const currentSteamId = extractNotionNumber(props, ["Steam ID", "SteamID", "AppId"]);
        const estadoActual = extractNotionStatus(props, ["Estado", "Status"]) || "";

        // Resolución dinámica de nombres de columna para compatibilidad total con Notion
        const horasPropKey = findNotionPropKey(props, ["Horas Jugadas", "Horas jugadas", "Hours Played"]) || "Horas Jugadas";
        const steamIdPropKey = findNotionPropKey(props, ["Steam ID", "SteamID", "Steam Id", "AppId"]) || "Steam ID";
        const fechaInicioPropKey = findNotionPropKey(props, ["Fecha de Inicio", "Fecha de inicio", "Start Date", "StartDate"]) || "Fecha de Inicio";
        const hltbPrincipalPropKey = findNotionPropKey(props, ["HLTB Principal", "HLTB Main"]) || "HLTB Principal";
        const hltbCompletistaPropKey = findNotionPropKey(props, ["HLTB Completista", "HLTB 100%"]) || "HLTB Completista";
        const estadoPropKey = findNotionPropKey(props, ["Estado", "Status"]) || "Estado";
        const fechaCulmPropKey = findNotionPropKey(props, [
          "Fecha de Culminación (primera campaña)",
          "Fecha de Finalización",
          "Fecha de Finalizacion",
          "Fecha de Culminacion",
          "Fecha de Fin",
        ]) || "Fecha de Culminación (primera campaña)";
        const portadaPropKey = findNotionPropKey(props, ["Portada", "Cover", "Imagen", "Poster", "Póster"]) || "Portada";
        const generosPropKey = findNotionPropKey(props, ["Géneros", "Género", "Generos", "Genero", "Genres", "Genre"]) || "Géneros";
        const linkPropKey = findNotionPropKey(props, ["Link", "URL", "Wikipedia", "Enlace"]) || "Link";

        let needsUpdate = false;
        const payloadProps: Record<string, any> = {};
        let coverPayload: any = undefined;
        let iconPayload: any = undefined;

        // Regla 1: Horas Jugadas (solo si cambió el valor redondeado)
        const roundedNewHours = Math.round(hours * 10) / 10;
        const roundedOldHours = Math.round(horasActuales * 10) / 10;
        if (roundedNewHours !== roundedOldHours) {
          payloadProps[horasPropKey] = { number: roundedNewHours };
          needsUpdate = true;
        }

        // Regla 2: Steam ID (solo si falta o es diferente)
        if (!currentSteamId || currentSteamId !== g.appId) {
          payloadProps[steamIdPropKey] = { number: g.appId };
          needsUpdate = true;
        }

        // Regla 3: Fecha de Inicio (si tiene horas y no tiene fecha previa)
        if (hours > 0 && !tieneFechaInicio) {
          payloadProps[fechaInicioPropKey] = { date: { start: formatLocalDate() } };
          needsUpdate = true;
        }

        // Regla 4: Consulta HLTB solo si falta en Notion
        if (hltbPrincipal === null) {
          const hltbEst = await this.hltb.searchDuration(g.name);
          if (hltbEst.mainHours) {
            payloadProps[hltbPrincipalPropKey] = { number: hltbEst.mainHours };
            hltbPrincipal = hltbEst.mainHours;
            needsUpdate = true;
          }
          if (hltbEst.completionistHours) {
            payloadProps[hltbCompletistaPropKey] = { number: hltbEst.completionistHours };
            needsUpdate = true;
          }
        }

        // Regla 5: Auto-Culminación HLTB (si horas >= HLTB Principal y no estaba jugado)
        if (
          hltbPrincipal &&
          hltbPrincipal > 0 &&
          hours >= hltbPrincipal &&
          estadoActual.trim().toLowerCase() !== "jugado"
        ) {
          payloadProps[estadoPropKey] = { status: { name: "Jugado" } };
          if (!tieneFechaCulm) {
            payloadProps[fechaCulmPropKey] = {
              date: { start: formatLocalDate() },
            };
          }
          needsUpdate = true;
        }

        // Regla 6: Preservación absoluta de cuota RAWG (ahorro total de cuota)
        // Si la página de Notion ya tiene Portada o cover definida, NUNCA consultar RAWG de nuevo
        const pageHasCover = hasNotionCover(matchedPage);
        const pageHasGenres = hasNotionGenres(props);

        if (!pageHasCover) {
          const rawgData = await this.rawg.searchGame(g.name);
          if (rawgData) {
            if (rawgData.backgroundImage) {
              payloadProps[portadaPropKey] = {
                files: [
                  {
                    type: "external",
                    name: "Cover",
                    external: { url: rawgData.backgroundImage },
                  },
                ],
              };
              coverPayload = { type: "external", external: { url: rawgData.backgroundImage } };
              iconPayload = { type: "external", external: { url: rawgData.backgroundImage } };
              needsUpdate = true;
            }
            if (!pageHasGenres && rawgData.genres.length > 0) {
              const genreProp = findNotionProp(props, ["Géneros", "Género", "Generos", "Genero", "Genres", "Genre"]);
              if (genreProp && "select" in genreProp) {
                payloadProps[generosPropKey] = { select: { name: rawgData.genres[0] } };
              } else {
                payloadProps[generosPropKey] = {
                  multi_select: rawgData.genres.map((name) => ({ name })),
                };
              }
              needsUpdate = true;
            }
          }
        }

        // Regla 7: Wikipedia (solo si falta link)
        const currentLink = findNotionProp(props, ["Link", "URL", "Wikipedia", "Enlace"])?.url;
        if (!currentLink) {
          const wikiUrl = this.wiki.searchGameWikiUrl
            ? await this.wiki.searchGameWikiUrl(g.name)
            : await this.wiki.searchArticleUrl(g.name);
          if (wikiUrl) {
            payloadProps[linkPropKey] = { url: wikiUrl };
            needsUpdate = true;
          }
        }

        // Si nada cambió, NO enviar petición a Notion (cero tráfico inútil)
        if (needsUpdate) {
          if (this.notion.updatePage) {
            await this.notion.updatePage(matchedPage.id, {
              properties: payloadProps,
              cover: coverPayload,
              icon: iconPayload,
            });
          } else {
            await this.notion.updatePageProperties(matchedPage.id, payloadProps);
          }
          updatedNotion++;

          // Actualizar SQLite cache de forma idempotente
          const resolvedTitle = extractNotionTitle(props) || g.name;
          await this.gameRepo.upsert({
            notionPageId: matchedPage.id,
            title: resolvedTitle,
            cleanTitle: cleanGameTitle(resolvedTitle),
            steamAppId: g.appId,
            playtimeForever: roundedNewHours,
            playtimeNotion: roundedNewHours,
            hltbMain: hltbPrincipal,
            status: payloadProps["Estado"]?.status?.name || estadoActual || "Por Jugar",
            platform: "PC",
          });

          await this.sleep();
        }
      } else {
        // --- JUEGO NUEVO: CREAR EN NOTION ---
        const roundedHours = Math.round(hours * 10) / 10;
        const rawgData = await this.rawg.searchGame(g.name);
        const hltbEst = await this.hltb.searchDuration(g.name);
        const wikiUrl = this.wiki.searchGameWikiUrl
          ? await this.wiki.searchGameWikiUrl(g.name)
          : await this.wiki.searchArticleUrl(g.name);

        const autoCulminated = Boolean(hltbEst.mainHours && hours >= hltbEst.mainHours);
        const initialStatus = autoCulminated || hours > 1 ? "Jugado" : "Por Jugar";

        const newProps: Record<string, any> = {
          "Título": { title: [{ text: { content: g.name } }] },
          "Steam ID": { number: g.appId },
          "Horas Jugadas": { number: roundedHours },
          "Plataforma": { select: { name: "PC" } },
          "Estado": { status: { name: initialStatus } },
        };

        if (hours > 0) {
          newProps["Fecha de Inicio"] = { date: { start: formatLocalDate() } };
        }
        if (autoCulminated) {
          newProps["Fecha de Culminación (primera campaña)"] = {
            date: { start: formatLocalDate() },
          };
        }
        if (hltbEst.mainHours) {
          newProps["HLTB Principal"] = { number: hltbEst.mainHours };
        }
        if (hltbEst.completionistHours) {
          newProps["HLTB Completista"] = { number: hltbEst.completionistHours };
        }

        let newCover: any = undefined;
        let newIcon: any = undefined;

        if (rawgData?.backgroundImage) {
          newProps["Portada"] = {
            files: [
              {
                type: "external",
                name: "Cover",
                external: { url: rawgData.backgroundImage },
              },
            ],
          };
          newCover = { type: "external", external: { url: rawgData.backgroundImage } };
          newIcon = { type: "external", external: { url: rawgData.backgroundImage } };
        }
        if (rawgData?.genres && rawgData.genres.length > 0) {
          newProps["Géneros"] = {
            multi_select: rawgData.genres.map((name) => ({ name })),
          };
        }
        if (wikiUrl) {
          newProps["Link"] = { url: wikiUrl };
        }

        const newPageId = await this.notion.createPage(
          this.gamesDbId,
          newProps,
          newCover,
          newIcon
        );
        createdNotion++;

        // Registrar en SQLite cache
        await this.gameRepo.upsert({
          notionPageId: newPageId,
          title: g.name,
          cleanTitle: steamCleanTitle,
          steamAppId: g.appId,
          playtimeForever: roundedHours,
          playtimeNotion: roundedHours,
          hltbMain: hltbEst.mainHours,
          hltbCompletionist: hltbEst.completionistHours,
          coverUrl: rawgData?.backgroundImage || null,
          genres: JSON.stringify(rawgData?.genres || []),
          link: wikiUrl,
          platform: "PC",
          status: initialStatus,
          startDate: hours > 0 ? formatLocalDate() : null,
        });

        // Registrar en índices en memoria para subsiguientes coincidencias
        const mockNewPage: NotionPageDelta = {
          id: newPageId,
          lastEditedTime: new Date().toISOString(),
          properties: newProps,
          cover: newCover,
        };
        notionBySteamId.set(g.appId, mockNewPage);
        notionByCleanTitle.set(steamCleanTitle, mockNewPage);
        allNotionRecords.push({ cleanTitle: steamCleanTitle, page: mockNewPage });

        await this.sleep();
      }
    }

    const durationMs = Date.now() - startMs;
    console.log(
      `[SteamToNotionSync] Sincronización completada en ${durationMs}ms: ${updatedNotion} actualizados, ${createdNotion} creados, ${skippedLowPlaytime} omitidos (<0.5h).`
    );

    // 4. Notificar a clientes web vía Server-Sent Events si hubo cambios o sync
    broadcastEvent("catalog_updated", {
      type: "games",
      updated: updatedNotion,
      created: createdNotion,
      timestamp: new Date().toISOString(),
    });

    return {
      scannedSteam,
      updatedNotion,
      createdNotion,
      skippedLowPlaytime,
      durationMs,
    };
  }
}

export const steamToNotionSyncService = new SteamToNotionSyncService();
