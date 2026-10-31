import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/app";
import { prisma, configurePragmas, aiSettingsRepository } from "@repo/database";

describe("Settings Concurrency & Zero-Crash Resilience (Fase 1)", () => {
  beforeAll(async () => {
    await configurePragmas(prisma);
  });

  afterAll(async () => {
    // Restaurar settings por defecto limpios
    await prisma.aiSettings.upsert({
      where: { id: "default" },
      update: {
        activeProvider: "gemini",
        selectedModel: "gemini-2.5-flash",
        temperature: 0.7,
      },
      create: {
        id: "default",
        activeProvider: "gemini",
        selectedModel: "gemini-2.5-flash",
        temperature: 0.7,
      },
    });
  });

  it("should handle simultaneous concurrent bursts on empty DB with 0 error 500s", async () => {
    // 1. Forzar base de datos vacía en aiSettings
    await prisma.aiSettings.deleteMany({ where: { id: "default" } });
    const countBefore = await prisma.aiSettings.count({ where: { id: "default" } });
    expect(countBefore).toBe(0);

    // 2. Disparar ráfagas concurrentes simultáneas de /api/settings y /api/settings/ai
    const requests: Promise<Response>[] = [];
    for (let i = 0; i < 15; i++) {
      requests.push(app.request("/api/settings"));
      requests.push(app.request("/api/settings/ai"));
    }

    const responses = await Promise.all(requests);
    expect(responses.length).toBe(30);

    // 3. Verificar que todas las peticiones devolvieron 200 OK y 0 errores 500
    for (const res of responses) {
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    }

    // 4. Verificar unicidad atómica: exactamente 1 registro creado en SQLite
    const countAfter = await prisma.aiSettings.count({ where: { id: "default" } });
    expect(countAfter).toBe(1);
  });

  it("should enforce process.env.GEMINI_MODEL precedence across concurrent calls", async () => {
    const customModel = "gemini-2.5-pro-override";
    const originalEnv = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = customModel;

    try {
      const [resSettings, resAi] = await Promise.all([
        app.request("/api/settings"),
        app.request("/api/settings/ai"),
      ]);

      expect(resSettings.status).toBe(200);
      expect(resAi.status).toBe(200);

      const jsonSettings = (await resSettings.json()) as any;
      const jsonAi = (await resAi.json()) as any;

      expect(jsonSettings.data.activeModel).toBe(customModel);
      expect(jsonAi.data.selectedModel).toBe(customModel);
    } finally {
      if (originalEnv !== undefined) {
        process.env.GEMINI_MODEL = originalEnv;
      } else {
        delete process.env.GEMINI_MODEL;
      }
    }
  });

  it("should gracefully return fallback telemetry if database query throws", async () => {
    const originalGetSettings = aiSettingsRepository.getSettings;
    // Simular falla catastrófica de conexión a base de datos
    (aiSettingsRepository as any).getSettings = async () => {
      throw new Error("Simulated SQLite BUSY / Lock Error");
    };

    try {
      const resSettings = await app.request("/api/settings");
      expect(resSettings.status).toBe(200);
      const jsonSettings = (await resSettings.json()) as any;
      expect(jsonSettings.success).toBe(true);
      expect(jsonSettings.data.activeProvider).toBe("gemini");
      expect(jsonSettings.data.daemonOnline).toBe(true);

      const resAi = await app.request("/api/settings/ai");
      expect(resAi.status).toBe(200);
      const jsonAi = (await resAi.json()) as any;
      expect(jsonAi.success).toBe(true);
      expect(jsonAi.data.activeProvider).toBe("gemini");
    } finally {
      aiSettingsRepository.getSettings = originalGetSettings;
    }
  });
});
