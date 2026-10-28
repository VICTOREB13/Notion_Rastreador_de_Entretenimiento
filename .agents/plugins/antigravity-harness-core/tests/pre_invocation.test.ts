import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { TelemetryDB } from "../src/telemetry_db";
import { handlePreInvocation, extractActiveHeuristics } from "../src/pre_invocation";

describe("Harness³ PreInvocation Hook Handler (Ephemeral Zero-Prompt-Bloat)", () => {
  const workspaceRoot = resolve(".");

  test("1. Extracts active learned heuristics from repository skills (both bullet and numbered formats)", () => {
    const list = extractActiveHeuristics(workspaceRoot);
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(list.some((h) => h.includes("(backend-architect)"))).toBe(true);
    expect(list.some((h) => h.includes("(systems-auditor)"))).toBe(true);
  });

  test("2. Generates ephemeralMessage inside injectSteps without polluting permanent transcript", () => {
    const res = handlePreInvocation(
      {
        invocationNum: 1,
        initialNumSteps: 0,
        workspacePaths: [workspaceRoot],
      },
      { customWorkspace: workspaceRoot, customTelemetryPath: ":memory:" }
    );

    expect(res.injectSteps.length).toBe(1);
    expect(res.injectSteps[0].ephemeralMessage).toBeDefined();
    expect(res.injectSteps[0].ephemeralMessage).toContain("⚡ [HARNESS³ ACTIVE HEURISTICS (Zero-Prompt-Bloat)]");
    expect(res.injectSteps[0].ephemeralMessage).toContain("[H-");
  });

  test("3. Injects promoted cross-workspace heuristics from SQLite telemetry", () => {
    const db = new TelemetryDB(":memory:");
    (db as any).db.run(`
      INSERT INTO promoted_heuristics (rule_id, skill, rule_text, promotion_score, status)
      VALUES ('H-GLOBAL-99', 'systems-auditor', 'Never mock SQLite concurrency tests', 0.95, 'promoted');
    `);

    const res = handlePreInvocation(
      {
        invocationNum: 2,
        initialNumSteps: 5,
        workspacePaths: [workspaceRoot],
      },
      { customWorkspace: workspaceRoot, customTelemetryPath: ":memory:" }
    );

    db.close();
    expect(res.injectSteps.length).toBe(1);
    expect(res.injectSteps[0].ephemeralMessage).toBeDefined();
  });

  test("4. Returns empty injectSteps when no heuristics exist in empty workspace", () => {
    const res = handlePreInvocation(
      {
        invocationNum: 1,
        initialNumSteps: 0,
        workspacePaths: ["C:/NonExistentWorkspace"],
      },
      { customWorkspace: "C:/NonExistentWorkspace", customTelemetryPath: ":memory:" }
    );

    expect(res.injectSteps).toEqual([]);
  });
});
