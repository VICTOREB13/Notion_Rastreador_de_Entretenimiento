import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { TelemetryDB } from "../src/telemetry_db";
import { PromotionEngine } from "../src/promotion";

describe("Harness³ Heuristic Promotion Engine (Cross-Workspace)", () => {
  let db: TelemetryDB;
  let engine: PromotionEngine;
  const tempGlobalPath = resolve("_workspace/test_global_heuristics.md");

  beforeEach(() => {
    if (existsSync(tempGlobalPath)) unlinkSync(tempGlobalPath);
    db = new TelemetryDB(":memory:");
    engine = new PromotionEngine(db, tempGlobalPath);
  });

  afterEach(() => {
    db.close();
    if (existsSync(tempGlobalPath)) {
      try { unlinkSync(tempGlobalPath); } catch {}
    }
  });

  test("1. Does not promote heuristics with low volume (< 3 successes)", () => {
    db.recordHeuristicUsage({
      ruleId: "H-LOW-01",
      skill: "backend-architect",
      ruleText: "Use transactions",
      workspacePath: "C:/Projects/A",
      success: true,
    });
    db.recordHeuristicUsage({
      ruleId: "H-LOW-01",
      skill: "backend-architect",
      ruleText: "Use transactions",
      workspacePath: "C:/Projects/A",
      success: true,
    });

    const res = engine.evaluateAndPromote(3, 0.8);
    expect(res.newlyPromoted.length).toBe(0);
    expect(res.allPromoted.length).toBe(0);
  });

  test("2. Does not promote heuristics with low success rate (< 80%)", () => {
    for (let i = 0; i < 3; i++) {
      db.recordHeuristicUsage({
        ruleId: "H-FAIL-01",
        skill: "devops-engineer",
        ruleText: "Always rebuild docker",
        workspacePath: "C:/Projects/A",
        success: true,
      });
    }
    for (let i = 0; i < 3; i++) {
      db.recordHeuristicUsage({
        ruleId: "H-FAIL-01",
        skill: "devops-engineer",
        ruleText: "Always rebuild docker",
        workspacePath: "C:/Projects/B",
        success: false,
      });
    }

    // Success rate is 50% (3 / 6) -> Score is 0.50
    const res = engine.evaluateAndPromote(3, 0.8);
    expect(res.newlyPromoted.length).toBe(0);
  });

  test("3. Successfully promotes qualifying heuristics and exports global markdown", () => {
    for (let i = 0; i < 4; i++) {
      db.recordHeuristicUsage({
        ruleId: "H-GOLD-01",
        skill: "backend-architect",
        ruleText: "Configure PRAGMA busy_timeout = 5000 in SQLite WAL",
        workspacePath: `C:/Projects/App${i}`,
        success: true,
      });
    }

    const res = engine.evaluateAndPromote(3, 0.8);
    expect(res.newlyPromoted.length).toBe(1);
    expect(res.newlyPromoted[0].rule_id).toBe("H-GOLD-01");
    expect(res.newlyPromoted[0].promotion_score).toBeGreaterThanOrEqual(0.8);

    expect(existsSync(tempGlobalPath)).toBe(true);
  });

  test("4. Prevents duplicate promotion on second evaluation", () => {
    for (let i = 0; i < 3; i++) {
      db.recordHeuristicUsage({
        ruleId: "H-STABLE-01",
        skill: "systems-auditor",
        ruleText: "Verify DOM node budget < 800",
        workspacePath: "C:/Projects/Web",
        success: true,
      });
    }

    const firstEval = engine.evaluateAndPromote(3, 0.8);
    expect(firstEval.newlyPromoted.length).toBe(1);

    const secondEval = engine.evaluateAndPromote(3, 0.8);
    expect(secondEval.newlyPromoted.length).toBe(0);
    expect(secondEval.allPromoted.length).toBe(1);
  });
});
