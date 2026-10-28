import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { CircuitBreaker } from "../../../scripts/circuit_breaker";
import { TelemetryDB } from "../src/telemetry_db";
import { handlePostToolUse } from "../src/post_tool_use";

describe("Harness³ PostToolUse Hook Handler (Telemetry & Silent Auto-Heal)", () => {
  const testCounterPath = resolve("_workspace/test_post_tool_counter.json");
  const testTelemetryPath = ":memory:";

  beforeEach(() => {
    if (existsSync(testCounterPath)) unlinkSync(testCounterPath);
  });

  afterEach(() => {
    if (existsSync(testCounterPath)) {
      try { unlinkSync(testCounterPath); } catch {}
    }
  });

  test("1. Returns empty object {} per Antigravity CLI contract", () => {
    const res = handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "bun test" } },
        stepIdx: 1,
      },
      { customCounterPath: testCounterPath, customTelemetryPath: testTelemetryPath }
    );

    expect(res).toEqual({});
  });

  test("2. Records successful execution and resets consecutive failures", () => {
    const breaker = new CircuitBreaker(testCounterPath);
    breaker.recordFailure("run_command");
    expect(breaker.getState().consecutive_failures["run_command"]).toBe(1);

    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "bun test" } },
        stepIdx: 2,
      },
      { customCounterPath: testCounterPath, customTelemetryPath: testTelemetryPath }
    );

    const updatedBreaker = new CircuitBreaker(testCounterPath);
    expect(updatedBreaker.getState().consecutive_failures["run_command"]).toBe(0);
    expect(updatedBreaker.getState().tools_since_last_test_runner).toBe(0);
  });

  test("3. Records failure and triggers silent auto-heal on repeated failures (>= 2)", () => {
    const res1 = handlePostToolUse(
      {
        toolCall: { name: "sqlite_query", args: { sql: "SELECT * FROM locked_table" } },
        stepIdx: 3,
        error: "sqlite_busy: database is locked",
      },
      { customCounterPath: testCounterPath, customTelemetryPath: testTelemetryPath }
    );
    expect(res1).toEqual({});

    const res2 = handlePostToolUse(
      {
        toolCall: { name: "sqlite_query", args: { sql: "SELECT * FROM locked_table" } },
        stepIdx: 4,
        error: "sqlite_busy: database is locked",
      },
      { customCounterPath: testCounterPath, customTelemetryPath: testTelemetryPath }
    );
    expect(res2).toEqual({});

    const breaker = new CircuitBreaker(testCounterPath);
    expect(breaker.getState().consecutive_failures["sqlite_query"]).toBe(2);
  });

  test("4. Test runner non-zero exit (TDD Red phase) resets tools_since_last_test_runner without incrementing run_command failures", () => {
    const breaker = new CircuitBreaker(testCounterPath);
    breaker.recordInvocation("view_file");
    breaker.recordInvocation("view_file");
    expect(breaker.getState().tools_since_last_test_runner).toBe(2);

    // Running bun test in Red phase reports exit code 1
    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "bun test" } },
        output: "Command exited with code 1",
      },
      { customCounterPath: testCounterPath, customTelemetryPath: testTelemetryPath }
    );

    const updatedBreaker = new CircuitBreaker(testCounterPath);
    expect(updatedBreaker.getState().tools_since_last_test_runner).toBe(0);
    expect(updatedBreaker.getState().consecutive_failures["run_command"] || 0).toBe(0);

    // Verifies that other commands (like git status) remain allowed and are not blocked
    const gitCheck = updatedBreaker.check("run_command", { CommandLine: "git status" });
    expect(gitCheck.allowed).toBe(true);
    expect(gitCheck.decision).toBe("allow");
  });
});
