import { describe, it, expect } from "bun:test";
import { app } from "../src/app";

describe("Steam & Notion Sync Endpoints (/api/settings & /api/sync/trigger)", () => {
  it("GET /api/settings: Protege credenciales y devuelve solo banderas booleanas de salud", async () => {
    const res = await app.request("/api/settings");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(typeof body.data.isNotionConnected).toBe("boolean");
    expect(typeof body.data.isSteamConnected).toBe("boolean");
    expect(typeof body.data.isRawgConnected).toBe("boolean");
    expect(typeof body.data.isTmdbConnected).toBe("boolean");
    expect(typeof body.data.isGeminiConnected).toBe("boolean");
    expect(typeof body.data.daemonOnline).toBe("boolean");
    expect(typeof body.data.activeModel).toBe("string");

    // Seguridad estricta: NINGÚN token sensible debe estar presente
    const rawString = JSON.stringify(body);
    expect(rawString).not.toContain("secret_");
    expect(rawString).not.toContain("AIzaSy");
    expect(rawString).not.toContain("key_");
  });

  it("POST /api/sync/trigger: Dispara sincronización manual y devuelve 200", async () => {
    const res = await app.request("/api/sync/trigger", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.games).toBeDefined();
    expect(body.data.movies).toBeDefined();
  });
});
