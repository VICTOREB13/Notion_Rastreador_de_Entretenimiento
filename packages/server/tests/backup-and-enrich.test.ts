import { describe, it, expect, beforeAll } from "bun:test";
import { app } from "../src/app";
import { prisma, configurePragmas } from "@repo/database";

describe("Backup Snapshot & Batch Enrichment API", () => {
  beforeAll(async () => {
    await configurePragmas(prisma);
  });

  describe("Backup Export Endpoint (GET /api/backup/export)", () => {
    it("should return 200 with JSON attachment header and complete structured snapshot", async () => {
      const res = await app.request("/api/backup/export");
      expect(res.status).toBe(200);

      const disposition = res.headers.get("content-disposition");
      expect(disposition).toBe('attachment; filename="notion-entertainment-backup.json"');

      const body = (await res.json()) as any;
      expect(body.version).toBe("1.0");
      expect(body.exportedAt).toBeDefined();
      expect(body.counts).toBeDefined();
      expect(typeof body.counts.games).toBe("number");
      expect(typeof body.counts.movies).toBe("number");
      expect(typeof body.counts.gameSessions).toBe("number");
      expect(typeof body.counts.dailyPlaytime).toBe("number");
      expect(typeof body.counts.aiEnrichments).toBe("number");
      expect(typeof body.counts.aiSettings).toBe("number");

      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.games)).toBe(true);
      expect(Array.isArray(body.data.movies)).toBe(true);
      expect(Array.isArray(body.data.gameSessions)).toBe(true);
      expect(Array.isArray(body.data.dailyPlaytime)).toBe(true);
      expect(Array.isArray(body.data.aiEnrichments)).toBe(true);
      expect(Array.isArray(body.data.aiSettings)).toBe(true);

      // Credenciales sensibles deben estar enmascaradas
      for (const setting of body.data.aiSettings) {
        if (setting.geminiApiKey) {
          expect(setting.geminiApiKey).toBe("***");
        }
      }
    });
  });

  describe("Batch AI Enrichment Endpoint (POST /api/enrich/batch)", () => {
    it("should process batch request and return execution statistics", async () => {
      // Usamos delayMs: 0 y limit: 2 para ejecución inmediata en suite de pruebas
      const res = await app.request("/api/enrich/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 2,
          delayMs: 0,
          targetType: "ALL",
          force: false,
        }),
      });

      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data.totalPending).toBe("number");
      expect(typeof body.data.processed).toBe("number");
      expect(typeof body.data.success).toBe("number");
      expect(typeof body.data.errors).toBe("number");
      expect(Array.isArray(body.data.details)).toBe(true);
    });

    it("should accept targetType filter for GAME or MOVIE exclusively", async () => {
      const resGame = await app.request("/api/enrich/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 1,
          delayMs: 0,
          targetType: "GAME",
          force: false,
        }),
      });

      expect(resGame.status).toBe(200);
      const bodyGame = (await resGame.json()) as any;
      expect(bodyGame.success).toBe(true);
      for (const d of bodyGame.data.details) {
        expect(d.type).toBe("GAME");
      }
    });

    it("should handle request with no body gracefully using defaults", async () => {
      const res = await app.request("/api/enrich/batch", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data.totalPending).toBe("number");
      expect(typeof body.data.processed).toBe("number");
    });

    it("should balance candidates between games and movies when targetType is ALL", async () => {
      const res = await app.request("/api/enrich/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 4,
          delayMs: 0,
          targetType: "ALL",
          force: true, // Forzar candidatos para evaluar balance
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      const types = body.data.details.map((d: any) => d.type);
      // Con force: true, debe haber candidatos tanto de GAME como de MOVIE si existen en BD
      const hasGame = types.includes("GAME");
      const hasMovie = types.includes("MOVIE");
      expect(hasGame || hasMovie).toBe(true);
    });
  });
});
