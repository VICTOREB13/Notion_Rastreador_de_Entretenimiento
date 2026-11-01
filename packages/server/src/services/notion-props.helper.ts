import type { NotionPageDelta } from "@repo/database";

/**
 * Utilidades unificadas para extracción e inspección segura y tolerante a fallos
 * de propiedades en páginas y deltas de Notion (SSoT única del sistema).
 */

export function normalizePropKey(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function findNotionProp(props: Record<string, any>, aliases: string[]): any {
  if (!props || typeof props !== "object" || !Array.isArray(aliases)) return undefined;
  for (const alias of aliases) {
    if (alias in props) return props[alias];
  }
  const lowerMap: Record<string, string> = {};
  const normMap: Record<string, string> = {};
  for (const key of Object.keys(props)) {
    lowerMap[key.toLowerCase()] = key;
    normMap[normalizePropKey(key)] = key;
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    if (lower in lowerMap) return props[lowerMap[lower]];
  }
  for (const alias of aliases) {
    const norm = normalizePropKey(alias);
    if (norm in normMap) return props[normMap[norm]];
  }
  return undefined;
}

export function findNotionPropKey(props: Record<string, any>, aliases: string[]): string | null {
  if (!props || typeof props !== "object" || !Array.isArray(aliases)) return null;
  for (const alias of aliases) {
    if (alias in props) return alias;
  }
  const lowerMap: Record<string, string> = {};
  const normMap: Record<string, string> = {};
  for (const key of Object.keys(props)) {
    lowerMap[key.toLowerCase()] = key;
    normMap[normalizePropKey(key)] = key;
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase();
    if (lower in lowerMap) return lowerMap[lower];
  }
  for (const alias of aliases) {
    const norm = normalizePropKey(alias);
    if (norm in normMap) return normMap[norm];
  }
  return null;
}

export function extractNotionTitle(props: Record<string, any>): string {
  if (!props || typeof props !== "object") return "";
  const prop = findNotionProp(props, [
    "Título",
    "Titulo",
    "Title",
    "Name",
    "Nombre",
    "Película",
    "Pelicula",
    "Juego",
    "Videojuego",
  ]);
  if (prop?.title && Array.isArray(prop.title) && prop.title.length > 0) {
    return prop.title
      .map((t: any) => t?.plain_text || t?.text?.content || "")
      .join("")
      .trim();
  }
  // Fallback dinámico: encontrar cualquier propiedad de tipo 'title' en Notion
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === "title" || (Array.isArray(p?.title) && p.title.length > 0)) {
      return (p.title || [])
        .map((t: any) => t?.plain_text || t?.text?.content || "")
        .join("")
        .trim();
    }
  }
  return "";
}

export function extractNotionNumber(props: Record<string, any>, aliases: string[]): number | null {
  const prop = findNotionProp(props, aliases);
  if (typeof prop?.number === "number") {
    return prop.number;
  }
  if (prop?.formula?.type === "number" && typeof prop.formula.number === "number") {
    return prop.formula.number;
  }
  return null;
}

export function extractNotionUrl(props: Record<string, any>, aliases: string[]): string | null {
  const prop = findNotionProp(props, aliases);
  if (prop?.url && typeof prop.url === "string") {
    return prop.url;
  }
  return null;
}

export function extractNotionFileUrl(props: Record<string, any>, aliases: string[]): string | null {
  const prop = findNotionProp(props, aliases);
  if (prop?.files && Array.isArray(prop.files) && prop.files.length > 0) {
    const fileObj = prop.files[0];
    return fileObj.file?.url || fileObj.external?.url || null;
  }
  return null;
}

export function extractNotionMultiSelect(props: Record<string, any>, aliases: string[]): string[] {
  const prop = findNotionProp(props, aliases);
  if (prop?.multi_select && Array.isArray(prop.multi_select)) {
    return prop.multi_select.map((item: any) => item.name).filter(Boolean);
  }
  if (prop?.select?.name) {
    return [prop.select.name];
  }
  return [];
}

export function extractNotionSelect(props: Record<string, any>, aliases: string[], fallback: string = ""): string {
  const prop = findNotionProp(props, aliases);
  if (prop?.status?.name) {
    return prop.status.name;
  }
  if (prop?.select?.name) {
    return prop.select.name;
  }
  return fallback;
}

export function extractNotionRichText(props: Record<string, any>, aliases: string[]): string | null {
  const prop = findNotionProp(props, aliases);
  if (prop?.rich_text && Array.isArray(prop.rich_text) && prop.rich_text.length > 0) {
    return prop.rich_text.map((t: any) => t.plain_text || t.text?.content || "").join("").trim() || null;
  }
  if (prop?.formula?.type === "string" && typeof prop.formula.string === "string") {
    return prop.formula.string.trim() || null;
  }
  return null;
}

export function extractNotionDate(props: Record<string, any>, aliases: string[], preferEnd: boolean = false): string | null {
  const prop = findNotionProp(props, aliases);
  if (!prop) return null;

  if (preferEnd && prop?.date?.end) {
    return prop.date.end;
  }
  if (prop?.date?.start) {
    return prop.date.start;
  }
  if (prop?.date?.end) {
    return prop.date.end;
  }
  if (prop?.formula?.type === "date" && prop?.formula?.date) {
    if (preferEnd && prop.formula.date.end) return prop.formula.date.end;
    return prop.formula.date.start || prop.formula.date.end || null;
  }
  if (prop?.rollup?.type === "date" && prop?.rollup?.date) {
    if (preferEnd && prop.rollup.date.end) return prop.rollup.date.end;
    return prop.rollup.date.start || prop.rollup.date.end || null;
  }
  if (prop?.formula?.type === "string" && typeof prop.formula.string === "string") {
    return prop.formula.string.trim() || null;
  }
  return null;
}

export function extractNotionRating(props: Record<string, any>, aliases: string[]): number | null {
  const prop = findNotionProp(props, aliases);
  if (!prop) return null;

  let num: number | null = null;
  if (typeof prop?.number === "number") {
    num = prop.number;
  } else if (prop?.formula?.type === "number" && typeof prop.formula.number === "number") {
    num = prop.formula.number;
  } else if (prop?.rollup?.type === "number" && typeof prop.rollup.number === "number") {
    num = prop.rollup.number;
  } else if (prop?.rollup?.type === "array" && Array.isArray(prop.rollup.array) && prop.rollup.array.length > 0) {
    const first = prop.rollup.array[0];
    if (typeof first?.number === "number") num = first.number;
  }

  if (num !== null && !isNaN(num)) {
    if (num <= 0) return null;
    if (num > 5 && num <= 10) return Math.round((num / 2) * 10) / 10;
    if (num > 10 && num <= 100) return Math.round((num / 20) * 10) / 10;
    if (num > 100) return null;
    return Math.min(5, Math.max(0.5, Math.round(num * 10) / 10));
  }

  let textVal = "";
  if (prop?.select?.name) {
    textVal = prop.select.name;
  } else if (prop?.status?.name) {
    textVal = prop.status.name;
  } else if (prop?.multi_select && Array.isArray(prop.multi_select) && prop.multi_select.length > 0) {
    textVal = prop.multi_select.map((m: any) => m.name).join(" ");
  } else if (prop?.formula?.type === "string" && typeof prop.formula.string === "string") {
    textVal = prop.formula.string;
  } else if (prop?.rich_text && Array.isArray(prop.rich_text) && prop.rich_text.length > 0) {
    textVal = prop.rich_text.map((t: any) => t.plain_text || t.text?.content || "").join("").trim();
  } else if (prop?.rollup?.type === "array" && Array.isArray(prop.rollup.array) && prop.rollup.array.length > 0) {
    const first = prop.rollup.array[0];
    if (first?.select?.name) textVal = first.select.name;
    else if (first?.rich_text) textVal = first.rich_text.map((t: any) => t.plain_text || "").join("").trim();
  }

  textVal = textVal.trim();
  if (!textVal) return null;

  // Conteo o descarte de casos explícitos "sin calificar" o 0
  const lower = textVal.toLowerCase();
  if (
    lower === "0" ||
    lower === "0/5" ||
    lower === "0/10" ||
    lower === "0.0" ||
    lower === "sin calificar" ||
    lower === "unrated" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "-" ||
    lower === "--" ||
    lower === "☆☆☆☆☆"
  ) {
    return null;
  }

  // 1. Formato fraccionario (ej: "5/5", "4.5/5", "8/10", "9/10", "4.5 de 5", "9 de 10", "4.5 / 5 ⭐")
  const fracMatch = textVal.match(/(\d+(?:[\.,]\d+)?)\s*(?:\/|de|sobre)\s*(\d+(?:[\.,]\d+)?)/i);
  if (fracMatch) {
    const val = parseFloat(fracMatch[1].replace(",", "."));
    const max = parseFloat(fracMatch[2].replace(",", "."));
    if (val <= 0 || isNaN(val) || isNaN(max) || max <= 0) return null;
    if (max === 5) return Math.min(5, Math.max(0.5, Math.round(val * 10) / 10));
    if (max === 10) return Math.min(5, Math.max(0.5, Math.round((val / 2) * 10) / 10));
    if (max === 100) return Math.min(5, Math.max(0.5, Math.round((val / 20) * 10) / 10));
    return Math.min(5, Math.max(0.5, Math.round((val / max) * 5 * 10) / 10));
  }

  // 2. Número con estrella o texto de estrellas (ej: "4.5 ⭐", "5 ⭐", "4.5 estrellas", "5 stars", "⭐ 4.5", "5 ⭐ - Masterpiece")
  const numStarMatch =
    textVal.match(/(?:[⭐★🌟]\s*)?(\d+(?:[\.,]\d+)?)\s*(?:[⭐★🌟]|estrellas?|stars?)/i) ||
    textVal.match(/(?:estrellas?|stars?)\s*(\d+(?:[\.,]\d+)?)/i);
  if (numStarMatch) {
    const parsedVal = parseFloat(numStarMatch[1].replace(",", "."));
    if (parsedVal <= 0 || isNaN(parsedVal)) return null;
    if (parsedVal > 5 && parsedVal <= 10) return Math.round((parsedVal / 2) * 10) / 10;
    if (parsedVal > 10 && parsedVal <= 100) return Math.round((parsedVal / 20) * 10) / 10;
    if (parsedVal <= 5) return Math.min(5, Math.max(0.5, Math.round(parsedVal * 10) / 10));
  }

  // 3. Conteo de estrellas visuales exclusivamente o con medio símbolo (ej: "⭐⭐⭐⭐⭐", "⭐⭐⭐⭐½", "★★★★☆", "★★★½")
  const stars = textVal.match(/[⭐★🌟]/g);
  if (stars && stars.length > 0) {
    const hasHalf = textVal.includes("½") || textVal.toLowerCase().includes(".5");
    const computed = stars.length + (hasHalf ? 0.5 : 0);
    return Math.min(5, Math.max(0.5, Math.round(computed * 10) / 10));
  }

  // 4. Formato de select con etiqueta al inicio (ej: "5 - Obra Maestra", "4 - Muy Bueno", "4.5: Excelente")
  const leadingNumMatch = textVal.match(/^(\d+(?:[\.,]\d+)?)\s*(?:[-–—:]|\s)\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ]/);
  if (leadingNumMatch) {
    const parsed = parseFloat(leadingNumMatch[1].replace(",", "."));
    if (parsed <= 0 || isNaN(parsed)) return null;
    if (parsed > 5 && parsed <= 10) return Math.round((parsed / 2) * 10) / 10;
    if (parsed > 10 && parsed <= 100) return Math.round((parsed / 20) * 10) / 10;
    if (parsed <= 5) return Math.min(5, Math.max(0.5, Math.round(parsed * 10) / 10));
  }

  // 5. Número directo en texto (ej: "5", "4.5", "4,5", "8", "10")
  const parsed = parseFloat(textVal.replace(",", "."));
  if (!isNaN(parsed)) {
    if (parsed <= 0) return null;
    if (parsed > 5 && parsed <= 10) return Math.round((parsed / 2) * 10) / 10;
    if (parsed > 10 && parsed <= 100) return Math.round((parsed / 20) * 10) / 10;
    if (parsed <= 5) return Math.min(5, Math.max(0.5, Math.round(parsed * 10) / 10));
  }

  return null;
}

export function extractNotionCompletionDate(props: Record<string, any>, aliases: string[]): string | null {
  const dateVal = extractNotionDate(props, aliases, true);
  if (dateVal) return dateVal;

  const prop = findNotionProp(props, aliases);
  if (!prop) return null;

  if (prop?.date?.end) return prop.date.end;
  if (prop?.date?.start) return prop.date.start;
  if (prop?.formula?.date?.end) return prop.formula.date.end;
  if (prop?.formula?.date?.start) return prop.formula.date.start;
  if (prop?.rollup?.date?.end) return prop.rollup.date.end;
  if (prop?.rollup?.date?.start) return prop.rollup.date.start;
  if (prop?.rollup?.type === "array" && Array.isArray(prop.rollup.array) && prop.rollup.array.length > 0) {
    const first = prop.rollup.array[0];
    if (first?.date?.end || first?.date?.start) return first.date.end || first.date.start;
    if (first?.select?.name) return first.select.name.trim();
    if (first?.rich_text) return first.rich_text.map((t: any) => t.plain_text || "").join("").trim() || null;
  }
  if (prop?.formula?.type === "string" && typeof prop.formula.string === "string" && prop.formula.string.trim()) {
    return prop.formula.string.trim();
  }
  if (prop?.select?.name && prop.select.name.trim()) {
    return prop.select.name.trim();
  }
  if (prop?.status?.name && prop.status.name.trim()) {
    return prop.status.name.trim();
  }

  const textVal = extractNotionRichText(props, aliases);
  if (textVal) return textVal;

  return null;
}

export function extractNotionSummary(props: Record<string, any>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const propKey = findNotionPropKey(props, [alias]);
    if (propKey) {
      const lowerKey = propKey.toLowerCase();
      if (
        lowerKey.includes("sinopsis") ||
        lowerKey.includes("overview") ||
        lowerKey.includes("plot") ||
        lowerKey.includes("descripcion") ||
        lowerKey.includes("descripción")
      ) {
        continue;
      }
      const val = extractNotionRichText(props, [propKey]);
      if (val) return val;
    }
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
  if (!page || typeof page !== "object") return false;
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
  if (!props || typeof props !== "object") return false;
  const genreProp = findNotionProp(props, ["Géneros", "Genero", "Género", "Genres", "Genre"]);
  if (genreProp?.multi_select && Array.isArray(genreProp.multi_select)) {
    return genreProp.multi_select.length > 0;
  }
  if (genreProp?.select?.name) {
    return true;
  }
  return false;
}

// Aliases para máxima compatibilidad
export {
  findNotionProp as findProp,
  findNotionPropKey as findPropKey,
  extractNotionTitle as extractTitle,
  extractNotionNumber as extractNumber,
  extractNotionUrl as extractUrl,
  extractNotionFileUrl as extractFileUrl,
  extractNotionMultiSelect as extractMultiSelect,
  extractNotionSelect as extractSelect,
  extractNotionRichText as extractRichText,
  extractNotionDate as extractDate,
  extractNotionRating as extractRating,
  extractNotionCompletionDate as extractCompletionDate,
  extractNotionSummary as extractSummary,
  extractNotionStatus as extractStatus,
};
