/**
 * Normaliza y limpia un título de videojuego o película para deduplicación fuzzy.
 * - Elimina símbolos de marcas registradas (™, ®, ©)
 * - Convierte caracteres con tildes/diacríticos a ASCII plano
 * - Reemplaza caracteres no alfanuméricos por espacios
 * - Colapsa espacios en blanco repetidos y convierte a minúsculas
 * - Garantiza idempotencia: cleanGameTitle(cleanGameTitle(x)) === cleanGameTitle(x)
 */
export function cleanGameTitle(title: string): string {
  if (!title) return "";

  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve marcas diacríticas (á -> a)
    .replace(/[™®©]/g, "") // Remueve símbolos de marcas
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "") // Remueve emojis
    .replace(/[^a-zA-Z0-9\s]/g, " ") // Caracteres no alfanuméricos -> espacio
    .toLowerCase()
    .replace(/\s+/g, " ") // Colapsa múltiples espacios
    .trim();
}

/**
 * Calcula el coeficiente de similitud de Sørensen-Dice entre dos cadenas.
 * Retorna un valor entre 0.0 (totalmente distintas) y 1.0 (idénticas).
 */
export function computeSimilarityRatio(strA: string, strB: string): number {
  const a = cleanGameTitle(strA);
  const b = cleanGameTitle(strB);

  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;

  const getBigrams = (str: string): Map<string, number> => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.slice(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  for (const [bigram, countA] of bigramsA.entries()) {
    const countB = bigramsB.get(bigram);
    if (countB) {
      intersection += Math.min(countA, countB);
    }
  }

  const totalBigrams = (a.length - 1) + (b.length - 1);
  return Number(((2 * intersection) / totalBigrams).toFixed(4));
}

/**
 * Formatea una fecha en formato estricto ISO 'YYYY-MM-DD' normalizado a la zona horaria
 * local del sistema/servidor, evitando el desfase de día que ocurre con toISOString()
 * en husos horarios occidentales negativos (ej: GMT-3, GMT-4, GMT-5).
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normaliza y extrae el identificador canónico de una base de datos de Notion.
 * Tolera:
 * - URLs completas de Notion (ej: https://notion.so/workspace/8a92f0b3c4d5e6f7a8b9c0d1e2f3a4b5?v=...)
 * - URLs con slugs (ej: https://notion.so/workspace/Videojuegos-8a92f0b3c4d5e6f7a8b9c0d1e2f3a4b5)
 * - Identificadores con guiones (UUID v4 de 36 caracteres)
 * - Cadenas con comillas dobles/simples o espacios residuales
 */
export function cleanNotionDatabaseId(rawId: string): string {
  if (!rawId) return "";
  const cleaned = rawId.trim().replace(/^["']|["']$/g, "");
  // Strip query params and hashes first to never confuse view id (?v=) with database id
  const withoutQuery = cleaned.split("?")[0].split("#")[0];

  // Si contiene un UUID estándar con guiones
  const uuidMatch = withoutQuery.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  if (uuidMatch) {
    return uuidMatch[0].toLowerCase();
  }

  // Si contiene 32 caracteres hexadecimales consecutivos (formato habitual de Notion sin guiones)
  const hex32Match = withoutQuery.match(/[a-f0-9]{32}/i);
  if (hex32Match) {
    return hex32Match[0].toLowerCase();
  }

  // Fallback: remover query params y slashes
  return withoutQuery.split("/").pop() || withoutQuery;
}

/**
 * Normaliza y limpia el token de integración de Notion.
 * Remueve comillas envolventes y espacios accidentales.
 */
export function cleanNotionToken(rawToken: string): string {
  if (!rawToken) return "";
  return rawToken.trim().replace(/^["']|["']$/g, "");
}

/**
 * Normaliza el nombre del modelo de IA (elimina comillas, espacios residuales y
 * convierte espacios en guiones, ej. 'gemini 3.8 flash' -> 'gemini-3.8-flash').
 */
export function cleanAiModelName(rawModel?: string): string {
  if (!rawModel) return "";
  const cleaned = rawModel.trim().replace(/^["']|["']$/g, "").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\s+/g, "-");
}

