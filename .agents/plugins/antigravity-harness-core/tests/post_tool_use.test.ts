import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CircuitBreaker } from "../../../scripts/circuit_breaker";
import { handlePostInvocation, parseStepOutcome } from "../src/post_invocation";
import { handlePostToolUse } from "../src/post_tool_use";

describe("Harness³ PostToolUse Hook Handler (Telemetry & Silent Auto-Heal)", () => {
  const testCounterPath = resolve("_workspace/test_post_tool_counter.json");
  const testTelemetryPath = ":memory:";
  // Workspace temporal: el auto-heal nunca debe escribir en las heurísticas reales
  const tempWorkspace = mkdtempSync(join(tmpdir(), "post-tool-ws-"));

  afterAll(() => {
    try { rmSync(tempWorkspace, { recursive: true, force: true }); } catch {}
  });

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
        workspacePaths: [tempWorkspace],
      },
      { customCounterPath: testCounterPath, customTelemetryPath: testTelemetryPath }
    );
    expect(res1).toEqual({});

    const res2 = handlePostToolUse(
      {
        toolCall: { name: "sqlite_query", args: { sql: "SELECT * FROM locked_table" } },
        stepIdx: 4,
        error: "sqlite_busy: database is locked",
        workspacePaths: [tempWorkspace],
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

  test("5. A command whose outcome never reaches the transcript does not stay pending forever", () => {
    const payload = {
      toolCall: { name: "run_command", args: { CommandLine: "git status" } },
      stepIdx: 7,
      error: "",
      transcriptPath: join(tempWorkspace, "missing_transcript.jsonl"),
      workspacePaths: [tempWorkspace],
    };
    const options = { customCounterPath: testCounterPath, customTelemetryPath: testTelemetryPath };

    const breakerState = () => new CircuitBreaker(testCounterPath).getState();
    new CircuitBreaker(testCounterPath).recordFailure("run_command", payload.toolCall.args);

    handlePostToolUse(payload, options);
    expect(breakerState().pending_outcomes.length).toBe(1);

    for (let i = 0; i < 5; i++) handlePostInvocation(payload, options);
    expect(breakerState().pending_outcomes.length).toBe(1);

    handlePostInvocation(payload, options);
    expect(breakerState().pending_outcomes.length).toBe(0);

    // Sin evidencia no se afirma éxito: el contador de fallos sigue intacto
    expect(breakerState().consecutive_failures["run_command:git status"]).toBe(1);
  });

  test("7. Reads the log of background commands, which never report an exit code", () => {
    const logPath = join(tempWorkspace, "task-9.log").replace(/\\/g, "/");
    const running = { status: "RUNNING", content: `Tool is running as a background task\nTask logs are available at: file:///${logPath} You MUST TAKE ONE OF THE FOLLOWING` };
    const options = { customCounterPath: testCounterPath, customTelemetryPath: testTelemetryPath };

    expect(parseStepOutcome(running)).toBeNull();

    writeFileSync(logPath, "compilando...\n");
    expect(parseStepOutcome(running)).toBeNull();

    writeFileSync(logPath, "rustc : El t�rmino 'rustc' no se reconoce como nombre de un cmdlet\n + CommandNotFoundException");
    expect(parseStepOutcome(running)?.failed).toBe(true);

    writeFileSync(logPath, "42 pass\n0 fail\n");
    expect(parseStepOutcome(running)?.failed).toBe(false);

    const transcriptPath = join(tempWorkspace, "bg_transcript.jsonl");
    writeFileSync(logPath, "1 pass\n3 fail\n");
    writeFileSync(transcriptPath, `${JSON.stringify({ step_index: 9, ...running })}\n`);
    const payload = { toolCall: { name: "run_command", args: { CommandLine: "bun test" } }, stepIdx: 9, error: "", transcriptPath, workspacePaths: [tempWorkspace] };
    handlePostToolUse(payload, options);
    handlePostInvocation(payload, options);

    expect(new CircuitBreaker(testCounterPath).getState().last_test_passed).toBe(false);
  });

  test("6. Telemetry failures never cost the breaker counter", () => {
    const blockedPath = join(tempWorkspace, "not-a-dir", "telemetry.db");
    Bun.write(join(tempWorkspace, "not-a-dir"), "file, not a directory");

    handlePostToolUse(
      { toolCall: { name: "grep_search", args: {} }, stepIdx: 8, error: "boom", workspacePaths: [tempWorkspace] },
      { customCounterPath: testCounterPath, customTelemetryPath: blockedPath }
    );

    expect(new CircuitBreaker(testCounterPath).getState().consecutive_failures["grep_search"]).toBe(1);
  });
});
