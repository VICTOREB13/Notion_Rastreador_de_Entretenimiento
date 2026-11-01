import { describe, it, expect } from "bun:test";
import {
  normalizePropKey,
  findNotionProp,
  findNotionPropKey,
  extractNotionTitle,
  extractNotionNumber,
  extractNotionUrl,
  extractNotionFileUrl,
  extractNotionMultiSelect,
  extractNotionSelect,
  extractNotionRichText,
  extractNotionDate,
  extractNotionRating,
  extractNotionCompletionDate,
  extractNotionSummary,
  extractNotionStatus,
  hasNotionDate,
  hasNotionCover,
  hasNotionGenres,
} from "../src/services/notion-props.helper";

describe("NotionPropsHelper (SSoT Notion Extraction & Resilience)", () => {
  describe("normalizePropKey", () => {
    it("normalizes diacritics, spaces, and punctuation to lowercase alphanumeric", () => {
      expect(normalizePropKey("Calificación")).toBe("calificacion");
      expect(normalizePropKey("Fecha de Culminación (primera campaña)")).toBe("fechadeculminacionprimeracampana");
      expect(normalizePropKey("Género / Categoría")).toBe("generocategoria");
      expect(normalizePropKey("Steam ID #123")).toBe("steamid123");
    });

    it("handles null, undefined, empty, and non-string values gracefully", () => {
      expect(normalizePropKey("")).toBe("");
      expect(normalizePropKey(null as any)).toBe("");
      expect(normalizePropKey(undefined as any)).toBe("");
      expect(normalizePropKey(123 as any)).toBe("");
    });
  });

  describe("findNotionProp & findNotionPropKey", () => {
    const props = {
      "Título Original": { title: [{ plain_text: "Cyberpunk 2077" }] },
      "Calificación Personal": { number: 4.5 },
      "Fecha de Fin": { date: { start: "2026-10-30" } },
      link: { url: "https://wikipedia.org" },
    };

    it("matches exact keys", () => {
      expect(findNotionProp(props, ["Título Original"])).toEqual({ title: [{ plain_text: "Cyberpunk 2077" }] });
      expect(findNotionPropKey(props, ["Título Original"])).toBe("Título Original");
    });

    it("matches case-insensitively", () => {
      expect(findNotionProp(props, ["LINK"])).toEqual({ url: "https://wikipedia.org" });
      expect(findNotionPropKey(props, ["LINK"])).toBe("link");
    });

    it("matches normalized diacritic-insensitive keys", () => {
      expect(findNotionProp(props, ["calificacion personal"])).toEqual({ number: 4.5 });
      expect(findNotionPropKey(props, ["calificacion personal"])).toBe("Calificación Personal");
    });

    it("returns undefined/null on missing aliases or invalid inputs without crashing", () => {
      expect(findNotionProp(props, ["NonExistent"])).toBeUndefined();
      expect(findNotionPropKey(props, ["NonExistent"])).toBeNull();
      expect(findNotionProp(null as any, ["Title"])).toBeUndefined();
      expect(findNotionPropKey(null as any, ["Title"])).toBeNull();
      expect(findNotionProp(props, null as any)).toBeUndefined();
      expect(findNotionPropKey(props, null as any)).toBeNull();
    });
  });

  describe("extractNotionTitle", () => {
    it("extracts title from standard title property", () => {
      const props = {
        Título: { title: [{ plain_text: "Elden " }, { plain_text: "Ring" }] },
      };
      expect(extractNotionTitle(props)).toBe("Elden Ring");
    });

    it("falls back to generic title type if alias does not match standard list", () => {
      const props = {
        CustomNameField: { type: "title", title: [{ plain_text: "Hollow Knight" }] },
      };
      expect(extractNotionTitle(props)).toBe("Hollow Knight");
    });

    it("handles empty or missing props safely", () => {
      expect(extractNotionTitle({})).toBe("");
      expect(extractNotionTitle(null as any)).toBe("");
    });
  });

  describe("extractNotionRating", () => {
    it("handles 1-5 scale numbers directly", () => {
      expect(extractNotionRating({ Cal: { number: 4.5 } }, ["Cal"])).toBe(4.5);
      expect(extractNotionRating({ Cal: { number: 5 } }, ["Cal"])).toBe(5);
      expect(extractNotionRating({ Cal: { number: 1 } }, ["Cal"])).toBe(1);
    });

    it("converts 0-10 and 0-100 scales down to 1-5 scale", () => {
      expect(extractNotionRating({ Cal: { number: 9 } }, ["Cal"])).toBe(4.5);
      expect(extractNotionRating({ Cal: { number: 85 } }, ["Cal"])).toBe(4.3);
      expect(extractNotionRating({ Cal: { number: 150 } }, ["Cal"])).toBeNull();
    });

    it("handles fractional string ratings", () => {
      expect(extractNotionRating({ Cal: { select: { name: "9/10" } } }, ["Cal"])).toBe(4.5);
      expect(extractNotionRating({ Cal: { select: { name: "4.5 / 5" } } }, ["Cal"])).toBe(4.5);
      expect(extractNotionRating({ Cal: { select: { name: "90 de 100" } } }, ["Cal"])).toBe(4.5);
    });

    it("handles emoji stars and half stars", () => {
      expect(extractNotionRating({ Cal: { select: { name: "⭐⭐⭐⭐½" } } }, ["Cal"])).toBe(4.5);
      expect(extractNotionRating({ Cal: { select: { name: "★★★★☆" } } }, ["Cal"])).toBe(4);
      expect(extractNotionRating({ Cal: { select: { name: "4.5 ⭐" } } }, ["Cal"])).toBe(4.5);
      expect(extractNotionRating({ Cal: { select: { name: "5 estrellas" } } }, ["Cal"])).toBe(5);
    });

    it("returns null on zero, unrated, or negative values", () => {
      expect(extractNotionRating({ Cal: { number: 0 } }, ["Cal"])).toBeNull();
      expect(extractNotionRating({ Cal: { select: { name: "0/5" } } }, ["Cal"])).toBeNull();
      expect(extractNotionRating({ Cal: { select: { name: "Sin calificar" } } }, ["Cal"])).toBeNull();
      expect(extractNotionRating({ Cal: { select: { name: "unrated" } } }, ["Cal"])).toBeNull();
      expect(extractNotionRating({ Cal: { select: { name: "☆☆☆☆☆" } } }, ["Cal"])).toBeNull();
      expect(extractNotionRating(null as any, ["Cal"])).toBeNull();
    });
  });

  describe("extractNotionCompletionDate & extractNotionDate", () => {
    it("extracts start and end dates correctly", () => {
      const props = {
        Fecha: { date: { start: "2026-01-01", end: "2026-01-15" } },
      };
      expect(extractNotionDate(props, ["Fecha"], false)).toBe("2026-01-01");
      expect(extractNotionDate(props, ["Fecha"], true)).toBe("2026-01-15");
      expect(extractNotionCompletionDate(props, ["Fecha"])).toBe("2026-01-15");
    });

    it("extracts date from rollup or formula strings", () => {
      const rollupProps = {
        Fin: { rollup: { date: { start: "2026-05-20" } } },
      };
      expect(extractNotionCompletionDate(rollupProps, ["Fin"])).toBe("2026-05-20");

      const formulaProps = {
        Fin: { formula: { type: "string", string: "2026-06-01" } },
      };
      expect(extractNotionCompletionDate(formulaProps, ["Fin"])).toBe("2026-06-01");
    });
  });

  describe("extractNotionSummary", () => {
    it("extracts user personal notes while ignoring external synopsis aliases", () => {
      const props = {
        Sinopsis: { rich_text: [{ plain_text: "Sinopsis externa de TMDB" }] },
        "Opinión Personal": { rich_text: [{ plain_text: "Una obra maestra absoluta." }] },
      };

      const extracted = extractNotionSummary(props, ["Sinopsis", "Opinión Personal"]);
      expect(extracted).toBe("Una obra maestra absoluta.");
    });
  });

  describe("hasNotionCover & hasNotionGenres", () => {
    it("detects cover via file, url, or root cover", () => {
      expect(hasNotionCover({ id: "1", properties: { Cover: { files: [{ file: { url: "https://img.png" } }] } } } as any)).toBe(true);
      expect(hasNotionCover({ id: "2", cover: { external: { url: "https://img.png" } } } as any)).toBe(true);
      expect(hasNotionCover({ id: "3", properties: { Portada: { url: "https://img.png" } } } as any)).toBe(true);
      expect(hasNotionCover({ id: "4", properties: {} } as any)).toBe(false);
      expect(hasNotionCover(null as any)).toBe(false);
    });

    it("detects genres via multi_select or select", () => {
      expect(hasNotionGenres({ Géneros: { multi_select: [{ name: "RPG" }] } })).toBe(true);
      expect(hasNotionGenres({ Género: { select: { name: "Acción" } } })).toBe(true);
      expect(hasNotionGenres({ Géneros: { multi_select: [] } })).toBe(false);
      expect(hasNotionGenres({})).toBe(false);
      expect(hasNotionGenres(null as any)).toBe(false);
    });
  });
});
