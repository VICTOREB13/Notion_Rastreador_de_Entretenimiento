import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CircuitBreaker } from "../../../scripts/circuit_breaker";
import { handlePreToolUse } from "../src/pre_tool_use";

describe("Harness³ PreToolUse Hook Handler (In-Flight & Circuit Breaker V9)", () => {
  const testCounterPath = resolve("_workspace/test_pre_tool_counter.json");
  // Workspace temporal: un "deny" dispara auto-heal y nunca debe escribir en las heurísticas reales
  const workspaceRoot = mkdtempSync(join(tmpdir(), "pre-tool-ws-")).replace(/\\/g, "/");
  const originalPluginData = process.env.PLUGIN_DATA;

  beforeEach(() => {
    process.env.PLUGIN_DATA = workspaceRoot;
    if (existsSync(testCounterPath)) unlinkSync(testCounterPath);
  });

  afterEach(() => {
    if (originalPluginData === undefined) delete process.env.PLUGIN_DATA;
    else process.env.PLUGIN_DATA = originalPluginData;
    if (existsSync(testCounterPath)) {
      try { unlinkSync(testCounterPath); } catch {}
    }
  });

  afterAll(() => {
    try { rmSync(workspaceRoot, { recursive: true, force: true }); } catch {}
  });

  test("1. Allows valid tool calls without overwrite when arguments are clean", () => {
    const res = handlePreToolUse(
      {
        toolCall: {
          name: "run_command",
          args: { CommandLine: "bun test" },
        },
        stepIdx: 1,
        workspacePaths: [workspaceRoot],
      },
      { customCounterPath: testCounterPath }
    );

    expect(res.decision).toBe("allow");
    expect(res.overwrite).toBeUndefined();
  });

  test("2. Generates overwrite dictionary when paths are relative or need sanitization", () => {
    const res = handlePreToolUse(
      {
        toolCall: {
          name: "view_file",
          args: { AbsolutePath: "package.json" },
        },
        stepIdx: 2,
        workspacePaths: [workspaceRoot],
      },
      { customCounterPath: testCounterPath }
    );

    expect(res.decision).toBe("allow");
    expect(res.overwrite).toBeDefined();
    expect(res.overwrite?.AbsolutePath).toContain("package.json");
    expect(res.overwrite?.AbsolutePath).toMatch(/^(?:[a-zA-Z]:\/|\/)/);
  });

  test("3. Immutable Whitelist tools are ALWAYS allowed even under read streak pressure", () => {
    const breaker = new CircuitBreaker(testCounterPath);
    for (let i = 0; i < 15; i++) {
      breaker.recordInvocation("read_file");
    }

    const res = handlePreToolUse(
      {
        toolCall: {
          name: "send_message",
          args: { Message: "Report status", Recipient: "parent" },
        },
        stepIdx: 16,
        workspacePaths: [workspaceRoot],
      },
      { customCounterPath: testCounterPath }
    );

    expect(res.decision).toBe("allow");
  });

  test("4. Returns taxatively 'decision: deny' when blind sequential reads exceed 12", () => {
    const breaker = new CircuitBreaker(testCounterPath);
    for (let i = 0; i < 12; i++) {
      breaker.recordInvocation("view_file");
    }

    const res = handlePreToolUse(
      {
        toolCall: {
          name: "view_file",
          args: { AbsolutePath: `${workspaceRoot}/package.json` },
        },
        stepIdx: 13,
        workspacePaths: [workspaceRoot],
      },
      { customCounterPath: testCounterPath }
    );

    expect(res.decision).toBe("deny");
    expect(res.reason).toContain("CIRCUIT_BREAKER_BLOCKED");
    expect(res.reason).toContain("12 lecturas secuenciales consecutivas");
  });

  test("5. Returns taxatively 'decision: deny' when consecutive failures reach 3", () => {
    const breaker = new CircuitBreaker(testCounterPath);
    breaker.recordFailure("custom_api");
    breaker.recordFailure("custom_api");
    breaker.recordFailure("custom_api");

    const res = handlePreToolUse(
      {
        toolCall: {
          name: "custom_api",
          args: { endpoint: "/data" },
        },
        stepIdx: 4,
        workspacePaths: [workspaceRoot],
      },
      { customCounterPath: testCounterPath }
    );

    expect(res.decision).toBe("deny");
    expect(res.reason).toContain("ha fallado 3 veces consecutivas");
    expect(res.reason).toContain("Anti-Loop");
  });

  test("6. Returns taxatively 'decision: deny' when TDD budget is exhausted (14 tools without test)", () => {
    const breaker = new CircuitBreaker(testCounterPath);
    for (let i = 0; i < 14; i++) {
      breaker.recordInvocation("edit_file");
    }

    const res = handlePreToolUse(
      {
        toolCall: {
          name: "grep_search",
          args: { Query: "function foo", SearchPath: workspaceRoot },
        },
        stepIdx: 15,
        workspacePaths: [workspaceRoot],
      },
      { customCounterPath: testCounterPath }
    );

    expect(res.decision).toBe("deny");
    expect(res.reason).toContain("14 herramientas consecutivas sin validar la suite de pruebas");
  });
});
