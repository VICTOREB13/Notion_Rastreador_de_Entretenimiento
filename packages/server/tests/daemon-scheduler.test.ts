import { describe, it, expect, mock, spyOn } from "bun:test";
import { DaemonScheduler } from "../src/daemon/scheduler";
import { notionSyncService } from "../src/services/notion-sync.service";
import { steamLiveService } from "../src/services/steam-live.service";

describe("DaemonScheduler Bootstrap & Lifecycle Resilience (Fase 5)", () => {
  it("should start workers, set isRunning to true, and stop cleanly", () => {
    const scheduler = new DaemonScheduler(100000, 200000);
    expect(scheduler.isRunning()).toBe(false);

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    // Idempotent start
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it("should cancel pending initial timeouts on immediate stop", async () => {
    let steamCheckCalled = false;
    let gamesSyncCalled = false;
    let moviesSyncCalled = false;

    const steamSpy = spyOn(steamLiveService, "check").mockImplementation(async () => {
      steamCheckCalled = true;
    });
    const gamesSpy = spyOn(notionSyncService, "syncGames").mockImplementation(async () => {
      gamesSyncCalled = true;
      return { created: 0, updated: 0, unchanged: 0 };
    });
    const moviesSpy = spyOn(notionSyncService, "syncMovies").mockImplementation(async () => {
      moviesSyncCalled = true;
      return { created: 0, updated: 0, unchanged: 0 };
    });

    try {
      const scheduler = new DaemonScheduler(50000, 50000);
      scheduler.start();
      // Immediately stop before the 2s / 3s timeouts trigger
      scheduler.stop();

      // Wait 3.5s to verify none of the timeouts fired
      await new Promise((resolve) => setTimeout(resolve, 3200));

      expect(steamCheckCalled).toBe(false);
      expect(gamesSyncCalled).toBe(false);
      expect(moviesSyncCalled).toBe(false);
    } finally {
      steamSpy.mockRestore();
      gamesSpy.mockRestore();
      moviesSpy.mockRestore();
    }
  });

  it("should execute movies sync even if games sync throws during bootstrap", async () => {
    let moviesSyncCalled = false;

    const gamesSpy = spyOn(notionSyncService, "syncGames").mockImplementation(async () => {
      throw new Error("Simulated Notion Games API Rate Limit / Failure");
    });
    const moviesSpy = spyOn(notionSyncService, "syncMovies").mockImplementation(async () => {
      moviesSyncCalled = true;
      return { created: 1, updated: 0, unchanged: 0 };
    });

    try {
      const scheduler = new DaemonScheduler(50000, 50000);
      scheduler.start();

      // Wait 3.2s for bootstrap timeout to fire
      await new Promise((resolve) => setTimeout(resolve, 3200));

      expect(moviesSyncCalled).toBe(true);
      scheduler.stop();
    } finally {
      gamesSpy.mockRestore();
      moviesSpy.mockRestore();
    }
  });
});
