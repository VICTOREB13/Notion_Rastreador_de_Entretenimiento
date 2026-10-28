import { describe, it, expect, beforeAll } from "bun:test";
import { app } from "../src/app";
import { prisma, configurePragmas } from "@repo/database";

describe("Analytics, Settings & Healthz API", () => {
  beforeAll(async () => {
    await configurePragmas(prisma);
  });

  describe("Healthcheck endpoint", () => {
    it("GET /healthz should return 200 with status ok and uptime", async () => {
      const res = await app.request("/healthz");
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
      expect(typeof body.uptime).toBe("number");
    });
  });

  describe("Analytics Controller (/api/analytics)", () => {
    it("GET /api/analytics should return consolidated summary, timeSeries, topGames and genreDistribution", async () => {
      const res = await app.request("/api/analytics?days=14");
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();

      const { summary, recentSessions, timeSeries, topGames, genreDistribution } = body.data;

      // Summary assertions
      expect(typeof summary.totalGames).toBe("number");
      expect(typeof summary.totalPlaytimeHours).toBe("number");
      expect(typeof summary.completedGames).toBe("number");
      expect(typeof summary.completionRate).toBe("number");
      expect(typeof summary.totalMovies).toBe("number");
      expect(typeof summary.watchedMovies).toBe("number");
      expect(typeof summary.currentStreakDays).toBe("number");

      // Array assertions
      expect(Array.isArray(recentSessions)).toBe(true);
      expect(Array.isArray(timeSeries)).toBe(true);
      expect(Array.isArray(topGames)).toBe(true);
      expect(Array.isArray(genreDistribution)).toBe(true);
    });
  });

  describe("Settings Controller (/api/settings/ai)", () => {
    it("GET /api/settings/ai should return provider options and masked configuration", async () => {
      const res = await app.request("/api/settings/ai");
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.activeProvider).toBeDefined();
      expect(body.data.selectedModel).toBeDefined();
      expect(typeof body.data.temperature).toBe("number");
      expect(typeof body.data.geminiConfigured).toBe("boolean");
      expect(Array.isArray(body.data.availableProviders)).toBe(true);
      expect(body.data.availableProviders.some((p: any) => p.id === "gemini")).toBe(true);
      expect(body.data.availableProviders.some((p: any) => p.id === "deepseek")).toBe(true);
      expect(body.data.availableProviders.some((p: any) => p.id === "groq")).toBe(true);
      expect(body.data.availableProviders.some((p: any) => p.id === "ollama")).toBe(true);
    });

    it("PUT /api/settings/ai should update settings and return success message", async () => {
      const updatePayload = {
        activeProvider: "groq",
        selectedModel: "llama-3.3-70b-versatile",
        temperature: 0.5,
        groqApiKey: "gsk_test_key_mock_123456",
      };

      const res = await app.request("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.message).toContain("actualizada");

      // Verificar que se persistió
      const getRes = await app.request("/api/settings/ai");
      const getBody = (await getRes.json()) as any;
      expect(getBody.data.activeProvider).toBe("groq");
      expect(getBody.data.selectedModel).toBe("llama-3.3-70b-versatile");
      expect(getBody.data.temperature).toBe(0.5);
      expect(getBody.data.groqConfigured).toBe(true);

      // Restaurar a gemini
      await app.request("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeProvider: "gemini",
          selectedModel: "gemini-2.5-flash",
          temperature: 0.7,
        }),
      });
    });

    it("PUT /api/settings/ai should return validation error on invalid provider or temperature", async () => {
      const res = await app.request("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeProvider: "invalid-provider-xyz",
          temperature: 5.0, // max 2
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.name).toBe("ZodError");
    });
  });
});
