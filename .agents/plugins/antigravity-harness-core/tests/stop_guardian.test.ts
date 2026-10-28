import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { handleStop } from "../src/stop_guardian";

describe("Harness³ Stop Guardian Hook Handler (Quality Gate Guard)", () => {
  const workspaceRoot = resolve(".");
  const testRetryPath = resolve("_workspace/test_stop_retries.json");

  beforeEach(() => {
    if (existsSync(testRetryPath)) unlinkSync(testRetryPath);
  });

  afterEach(() => {
    if (existsSync(testRetryPath)) {
      try { unlinkSync(testRetryPath); } catch {}
    }
  });

  test("1. Allows termination immediately when reason is not NO_TOOL_CALL (e.g., USER_CANCELED)", () => {
    const res = handleStop(
      {
        terminationReason: "USER_CANCELED",
        fullyIdle: true,
        workspacePaths: [workspaceRoot],
      },
      { customWorkspace: workspaceRoot, customRetryStatePath: testRetryPath }
    );

    expect(res.decision).toBe("allow");
  });

  test("2. Allows termination when agent is not fully idle", () => {
    const res = handleStop(
      {
        terminationReason: "NO_TOOL_CALL",
        fullyIdle: false,
        workspacePaths: [workspaceRoot],
      },
      { customWorkspace: workspaceRoot, customRetryStatePath: testRetryPath }
    );

    expect(res.decision).toBe("allow");
  });

  test("3. Allows termination when all contracts and tests are in clean state", () => {
    const res = handleStop(
      {
        terminationReason: "NO_TOOL_CALL",
        fullyIdle: true,
        workspacePaths: [workspaceRoot],
      },
      { customWorkspace: workspaceRoot, customRetryStatePath: testRetryPath }
    );

    expect(res.decision).toBe("allow");
  });

  test("4. Anti-Loop: Limits continuation to max 2 retries, then allows termination", () => {
    // Seed retry file with 2 retries already consumed
    writeFileSync(testRetryPath, JSON.stringify({ retryCount: 2 }), "utf-8");

    const res = handleStop(
      {
        terminationReason: "NO_TOOL_CALL",
        fullyIdle: true,
        workspacePaths: [workspaceRoot],
      },
      { customWorkspace: workspaceRoot, customRetryStatePath: testRetryPath }
    );

    expect(res.decision).toBe("allow");
    expect(res.reason).toContain("Se alcanzó el límite de 2 reintentos");
  });

  test("5. Quality Gate: Returns decision: 'continue' when TDD budget is exhausted without running tests", () => {
    const testCounterPath = resolve("_workspace/test_stop_tool_counter.json");
    writeFileSync(testCounterPath, JSON.stringify({ tools_since_last_test_runner: 15 }), "utf-8");

    try {
      const res = handleStop(
        {
          terminationReason: "NO_TOOL_CALL",
          fullyIdle: true,
          workspacePaths: [workspaceRoot],
        },
        {
          customWorkspace: workspaceRoot,
          customRetryStatePath: testRetryPath,
          customCounterPath: testCounterPath,
        }
      );

      expect(res.decision).toBe("continue");
      expect(res.reason).toContain("HARNESS³ QUALITY GATE GUARDIAN");
      expect(res.reason).toContain("Presupuesto TDD agotado");
    } finally {
      if (existsSync(testCounterPath)) unlinkSync(testCounterPath);
    }
  });
});
