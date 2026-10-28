import type { NotionPageDelta } from "@repo/database";

/**
 * Utilidades para extracción e inspección segura y tolerante a fallos
 * de propiedades en páginas y deltas de Notion.
 */

export function findNotionProp(props: Record<string, any>, aliases: string[]): any {
  for (const alias of aliases) {
    if (alias in props) return props[alias];
  }
  const lowerMap: Record<string, string> = {};
  for (const key of Object.keys(props)) {
    lowerMap[key.toLowerCase()] = key;
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    if (lower in lowerMap) return props[lowerMap[lower]];
  }
  return undefined;
}

export function findNotionPropKey(props: Record<string, any>, aliases: string[]): string | null {
  for (const alias of aliases) {
    if (alias in props) return alias;
  }
  const lowerMap: Record<string, string> = {};
  for (const key of Object.keys(props)) {
    lowerMap[key.toLowerCase()] = key;
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    if (lower in lowerMap) return lowerMap[lower];
  }
  return null;
}

export function extractNotionTitle(props: Record<string, any>): string {
  const prop = findNotionProp(props, [
    "Título",
    "Titulo",
    "Title",
    "Name",
    "Nombre",
    "Película",
    "Pelicula",
  ]);
  if (prop?.title && Array.isArray(prop.title) && prop.title.length > 0) {
    return prop.title[0]?.text?.content?.trim() || "";
  }
  return "";
}

export function extractNotionNumber(props: Record<string, any>, aliases: string[]): number | null {
  const prop = findNotionProp(props, aliases);
  if (typeof prop?.number === "number") {
    return prop.number;
  }
  return null;
}

export function extractNotionStatus(props: Record<string, any>, aliases: string[]): string | null {
  const prop = findNotionProp(props, aliases);
  if (prop?.status?.name) return prop.status.name;
  if (prop?.select?.name) return prop.select.name;
  return null;
}

export function hasNotionDate(props: Record<string, any>, aliases: string[]): boolean {
  const prop = findNotionProp(props, aliases);
  return Boolean(prop?.date?.start);
}

export function hasNotionCover(page: NotionPageDelta): boolean {
  const props = (page.properties || {}) as Record<string, any>;
  const portadaProp = findNotionProp(props, ["Portada", "Cover", "Imagen", "Poster", "Póster"]);
  const hasFiles = Boolean(
    portadaProp?.files && Array.isArray(portadaProp.files) && portadaProp.files.length > 0
  );
  const hasUrl = Boolean(portadaProp?.url);
  const hasRootCover = Boolean(page.cover);
  return hasFiles || hasRootCover || hasUrl;
}

export function hasNotionGenres(props: Record<string, any>): boolean {
  const genreProp = findNotionProp(props, ["Géneros", "Genero", "Género", "Genres", "Genre"]);
  if (genreProp?.multi_select && Array.isArray(genreProp.multi_select)) {
    return genreProp.multi_select.length > 0;
  }
  if (genreProp?.select?.name) {
    return true;
  }
  return false;
}
