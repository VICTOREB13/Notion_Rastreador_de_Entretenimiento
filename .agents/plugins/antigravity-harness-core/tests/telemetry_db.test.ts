import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { TelemetryDB } from "../src/telemetry_db";

describe("Harness³ TelemetryDB (SQLite Persistence)", () => {
  let db: TelemetryDB;

  beforeEach(() => {
    db = new TelemetryDB(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("1. Initializes SQLite tables in memory", () => {
    const metrics = db.getMetrics();
    expect(metrics.totalCalls).toBe(0);
    expect(metrics.successCount).toBe(0);
    expect(metrics.failureCount).toBe(0);
  });

  test("2. Records successful tool executions", () => {
    const id = db.recordToolExecution({
      conversationId: "test-conv-01",
      stepIdx: 1,
      toolName: "run_command",
      isSuccess: true,
      sanitized: false,
      executionTimeMs: 120,
    });

    expect(id).toBeGreaterThan(0);
    const metrics = db.getMetrics();
    expect(metrics.totalCalls).toBe(1);
    expect(metrics.successCount).toBe(1);
    expect(metrics.failureCount).toBe(0);
  });

  test("3. Records failed tool executions and error signatures", () => {
    db.recordToolExecution({
      conversationId: "test-conv-01",
      stepIdx: 2,
      toolName: "run_command",
      isSuccess: false,
      errorMessage: "Command exited with code 1: syntax error in main.py:42",
    });

    db.recordErrorSignature("run_command", "Command exited with code 1: syntax error in main.py:42");
    db.recordErrorSignature("run_command", "Command exited with code 1: syntax error in main.py:88");

    const metrics = db.getMetrics();
    expect(metrics.totalCalls).toBe(1);
    expect(metrics.failureCount).toBe(1);

    const signatures = db.getErrorSignatures();
    expect(signatures.length).toBe(1);
    expect(signatures[0].occurrence_count).toBe(2);
    expect(signatures[0].tool_name).toBe("run_command");
  });

  test("4. Records heuristic telemetry and usage increments", () => {
    db.recordHeuristicUsage({
      ruleId: "H-01",
      skill: "backend-architect",
      ruleText: "Use WAL mode for SQLite",
      workspacePath: "C:/Projects/AppA",
      success: true,
    });

    db.recordHeuristicUsage({
      ruleId: "H-01",
      skill: "backend-architect",
      ruleText: "Use WAL mode for SQLite",
      workspacePath: "C:/Projects/AppA",
      success: true,
    });

    db.recordHeuristicUsage({
      ruleId: "H-01",
      skill: "backend-architect",
      ruleText: "Use WAL mode for SQLite",
      workspacePath: "C:/Projects/AppA",
      success: false,
    });

    const list = db.getHeuristicsTelemetry();
    expect(list.length).toBe(1);
    expect(list[0].rule_id).toBe("H-01");
    expect(list[0].times_injected).toBe(3);
    expect(list[0].times_succeeded).toBe(2);
    expect(list[0].times_failed).toBe(1);
  });
});
