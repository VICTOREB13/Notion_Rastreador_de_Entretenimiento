import type { NotionPageDelta, SteamOwnedGame } from "@repo/database";
import { formatLocalDate } from "@repo/database";
import {
  findNotionProp,
  findNotionPropKey,
  extractNotionNumber,
  extractNotionStatus,
  hasNotionDate,
  hasNotionCover,
  hasNotionGenres,
} from "./notion-props.helper";

export interface BuildUpdatePayloadParams {
  matchedPage: NotionPageDelta;
  game: SteamOwnedGame;
  hours: number;
  fetchHltb: (name: string) => Promise<{ mainHours?: number | null; completionistHours?: number | null }>;
  fetchRawg: (name: string) => Promise<any>;
  fetchWikiUrl: (name: string) => Promise<string | null>;
}

export interface BuildUpdatePayloadResult {
  payloadProps: Record<string, any>;
  coverPayload: any;
  iconPayload: any;
  needsUpdate: boolean;
  roundedNewHours: number;
  hltbPrincipal: number | null;
  estadoActual: string;
}

export async function buildNotionUpdatePayload(
  params: BuildUpdatePayloadParams
): Promise<BuildUpdatePayloadResult> {
  const { matchedPage, game, hours, fetchHltb, fetchRawg, fetchWikiUrl } = params;
  const props = matchedPage.properties as Record<string, any>;

  const horasPropKey = findNotionPropKey(props, ["Horas Jugadas", "Horas", "Playtime"]) || "Horas Jugadas";
  const steamIdPropKey = findNotionPropKey(props, ["Steam ID", "Steam App ID", "SteamId", "AppId"]) || "Steam ID";
  const estadoPropKey = findNotionPropKey(props, ["Estado", "Status"]) || "Estado";
  const fechaInicioPropKey = findNotionPropKey(props, ["Fecha de Inicio", "Fecha de inicio", "Start Date"]) || "Fecha de Inicio";
  const fechaCulmPropKey =
    findNotionPropKey(props, [
      "Fecha de Culminación (primera campaña)",
      "Fecha de Culminación",
      "Fecha de Finalización",
      "Fecha de Culminacion",
      "Completion Date",
    ]) || "Fecha de Culminación (primera campaña)";
  const hltbPrincipalPropKey = findNotionPropKey(props, ["HLTB Principal", "HLTB Main"]) || "HLTB Principal";
  const hltbCompletistaPropKey = findNotionPropKey(props, ["HLTB Completista", "HLTB 100%"]) || "HLTB Completista";
  const portadaPropKey = findNotionPropKey(props, ["Portada", "Cover", "Banner"]) || "Portada";
  const generosPropKey = findNotionPropKey(props, ["Géneros", "Género", "Generos", "Genero", "Genres", "Genre"]) || "Géneros";
  const linkPropKey = findNotionPropKey(props, ["Link", "URL", "Wikipedia", "Enlace"]) || "Link";

  const horasActuales = extractNotionNumber(props, ["Horas Jugadas", "Horas", "Playtime"]) ?? 0;
  const currentSteamId = extractNotionNumber(props, ["Steam ID", "Steam App ID", "SteamId", "AppId"]);
  const estadoActual = extractNotionStatus(props, ["Estado", "Status"]) || "";
  let hltbPrincipal = extractNotionNumber(props, ["HLTB Principal", "HLTB Main"]);
  const tieneFechaInicio = hasNotionDate(props, ["Fecha de Inicio", "Fecha de inicio", "Start Date"]);
  const tieneFechaCulm = hasNotionDate(props, [
    "Fecha de Culminación (primera campaña)",
    "Fecha de Culminación",
    "Fecha de Finalización",
    "Fecha de Culminacion",
    "Completion Date",
  ]);

  const payloadProps: Record<string, any> = {};
  let coverPayload: any = undefined;
  let iconPayload: any = undefined;
  let needsUpdate = false;

  // Regla 1: Horas Jugadas (solo si cambió el valor redondeado)
  const roundedNewHours = Math.round(hours * 10) / 10;
  const roundedOldHours = Math.round(horasActuales * 10) / 10;
  if (roundedNewHours !== roundedOldHours) {
    payloadProps[horasPropKey] = { number: roundedNewHours };
    needsUpdate = true;
  }

  // Regla 2: Steam ID (solo si falta o es diferente)
  if (!currentSteamId || currentSteamId !== game.appId) {
    payloadProps[steamIdPropKey] = { number: game.appId };
    needsUpdate = true;
  }

  // Regla 3: Fecha de Inicio (si tiene horas y no tiene fecha previa)
  if (hours > 0 && !tieneFechaInicio) {
    payloadProps[fechaInicioPropKey] = { date: { start: formatLocalDate() } };
    needsUpdate = true;
  }

  // Regla 4: Consulta HLTB solo si falta en Notion
  if (hltbPrincipal === null) {
    const hltbEst = await fetchHltb(game.name);
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
  const pageHasCover = hasNotionCover(matchedPage);
  const pageHasGenres = hasNotionGenres(props);

  if (!pageHasCover) {
    const rawgData = await fetchRawg(game.name);
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
            multi_select: rawgData.genres.map((name: string) => ({ name })),
          };
        }
        needsUpdate = true;
      }
    }
  }

  // Regla 7: Wikipedia (solo si falta link)
  const currentLink = findNotionProp(props, ["Link", "URL", "Wikipedia", "Enlace"])?.url;
  if (!currentLink) {
    const wikiUrl = await fetchWikiUrl(game.name);
    if (wikiUrl) {
      payloadProps[linkPropKey] = { url: wikiUrl };
      needsUpdate = true;
    }
  }

  return {
    payloadProps,
    coverPayload,
    iconPayload,
    needsUpdate,
    roundedNewHours,
    hltbPrincipal,
    estadoActual,
  };
}

export interface BuildCreatePayloadParams {
  game: SteamOwnedGame;
  hours: number;
  rawgData: any;
  hltbEst: { mainHours?: number | null; completionistHours?: number | null };
  wikiUrl: string | null;
}

export interface BuildCreatePayloadResult {
  newProps: Record<string, any>;
  newCover: any;
  newIcon: any;
  initialStatus: string;
  roundedHours: number;
  autoCulminated: boolean;
}

export function buildNotionCreatePayload(
  params: BuildCreatePayloadParams
): BuildCreatePayloadResult {
  const { game, hours, rawgData, hltbEst, wikiUrl } = params;
  const roundedHours = Math.round(hours * 10) / 10;
  const autoCulminated = Boolean(hltbEst.mainHours && hours >= hltbEst.mainHours);
  const initialStatus = autoCulminated || hours > 1 ? "Jugado" : "Por Jugar";

  const newProps: Record<string, any> = {
    "Título": { title: [{ text: { content: game.name } }] },
    "Steam ID": { number: game.appId },
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
      multi_select: rawgData.genres.map((name: string) => ({ name })),
    };
  }
  if (wikiUrl) {
    newProps["Link"] = { url: wikiUrl };
  }

  return {
    newProps,
    newCover,
    newIcon,
    initialStatus,
    roundedHours,
    autoCulminated,
  };
}
