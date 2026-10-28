import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  isToolFailurePayload,
  runCLI,
} from "./circuit_breaker";

const TEST_COUNTER_PATH = resolve("_workspace/test_cli_tool_counter.json");

function cleanup() {
  if (existsSync(TEST_COUNTER_PATH)) {
    unlinkSync(TEST_COUNTER_PATH);
  }
}

describe("CircuitBreaker CLI Execution Tests", () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  test("CLI: allows normal tool calls with exit code 0", async () => {
    const exitCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "find_by_name"]);
    expect(exitCode).toBe(0);
  });

  test("CLI: blocks when exceeding consecutive reads with exit code 1", async () => {
    for (let i = 0; i < 12; i++) {
      const code = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "read_file"]);
      expect(code).toBe(0);
    }
    const blockedCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "read_file"]);
    expect(blockedCode).toBe(1);
  });

  test("CLI: resets counters with --reset flag", async () => {
    for (let i = 0; i < 5; i++) {
      await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "read_file"]);
    }
    const resetCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--reset"]);
    expect(resetCode).toBe(0);

    const checkCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--status"]);
    expect(checkCode).toBe(0);
  });

  test("CLI: records failures and blocks after 3 failures", async () => {
    const f1 = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "failing_mcp", "--fail"]);
    expect(f1).toBe(0);

    const f2 = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "failing_mcp", "--fail"]);
    expect(f2).toBe(0);

    const f3 = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "failing_mcp", "--fail"]);
    expect(f3).toBe(1);

    const nextCall = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "failing_mcp", "--check-only"]);
    expect(nextCall).toBe(1);
  });

  test("CLI: records successes and resets failure count", async () => {
    await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "test_tool", "--fail"]);
    await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "test_tool", "--fail"]);

    const succ = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "test_tool", "--success"]);
    expect(succ).toBe(0);

    const check = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "test_tool", "--check-only"]);
    expect(check).toBe(0);
  });

  test("CLI: parses json tool payload from command line", async () => {
    const payload = JSON.stringify({ CommandLine: "bun test" });
    const code = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "run_command", "--payload", payload]);
    expect(code).toBe(0);
  });

  test("CLI: --auto-heal in PreTool check injects heuristic when tool is blocked by breaker", async () => {
    const testDir = join(tmpdir(), `cb-pretool-autoheal-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const heuristicsFile = join(testDir, "learned_heuristics.md");

    try {
      await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "failing_mcp", "--fail"]);
      await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "failing_mcp", "--fail"]);
      await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "failing_mcp", "--fail"]);

      const checkCode = await runCLI([
        "--counter-file", TEST_COUNTER_PATH,
        "--tool", "failing_mcp",
        "--check-only",
        "--auto-heal",
        "--heuristics-file", heuristicsFile,
        "--skill", "systems-auditor",
      ]);
      expect(checkCode).toBe(1);

      expect(existsSync(heuristicsFile)).toBe(true);
      const content = readFileSync(heuristicsFile, "utf-8");
      expect(content).toContain("systems-auditor");
      expect(content).toContain("failing_mcp");
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("isToolFailurePayload correctly identifies non-zero exit codes, nested errors, and error strings", () => {
    expect(isToolFailurePayload({ exit_code: 1 })).toBe(true);
    expect(isToolFailurePayload({ exit_code: 0 })).toBe(false);
    expect(isToolFailurePayload({ exitCode: 2 })).toBe(true);
    expect(isToolFailurePayload({ exitCode: 0 })).toBe(false);
    expect(isToolFailurePayload({ tool_output: { exit_code: 1 } })).toBe(true);
    expect(isToolFailurePayload({ tool_output: { exit_code: 0 } })).toBe(false);
    expect(isToolFailurePayload({ result: { exit_code: 1 } })).toBe(true);
    expect(isToolFailurePayload({ result: { is_error: true } })).toBe(true);
    expect(isToolFailurePayload("Command exited with code 1")).toBe(true);
    expect(isToolFailurePayload("Command exited with code 0")).toBe(false);
    expect(isToolFailurePayload("Encountered error in step execution: crash")).toBe(true);
    expect(isToolFailurePayload("Normal tool execution completed.")).toBe(false);
    expect(isToolFailurePayload({ error: "some error" })).toBe(true);
    expect(isToolFailurePayload({ is_error: true })).toBe(true);
    expect(isToolFailurePayload({ status: "error" })).toBe(true);
    expect(isToolFailurePayload({ status: "success" })).toBe(false);
    expect(isToolFailurePayload(null)).toBe(false);
    expect(isToolFailurePayload(undefined)).toBe(false);
  });

  test("CLI: --post-tool mode with non-zero exit code triggers failure and auto-healing at 2nd failure", async () => {
    const testDir = join(tmpdir(), `cb-posttool-autoheal-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const heuristicsFile = join(testDir, "learned_heuristics.md");

    try {
      const p1 = await runCLI([
        "--counter-file", TEST_COUNTER_PATH,
        "--post-tool",
        "--tool", "run_command",
        "--exit-code", "1",
        "--error", "sqlite_busy database is locked",
        "--auto-heal",
        "--heuristics-file", heuristicsFile,
        "--skill", "backend-architect",
      ]);
      expect(p1).toBe(0);
      expect(existsSync(heuristicsFile)).toBe(false);

      const p2 = await runCLI([
        "--counter-file", TEST_COUNTER_PATH,
        "--post-tool",
        "--tool", "run_command",
        "--exit-code", "1",
        "--error", "sqlite_busy database is locked",
        "--auto-heal",
        "--heuristics-file", heuristicsFile,
        "--skill", "backend-architect",
      ]);
      expect(p2).toBe(0);
      expect(existsSync(heuristicsFile)).toBe(true);

      const content = readFileSync(heuristicsFile, "utf-8");
      expect(content).toContain("backend-architect");
      expect(content).toContain("busy_timeout");
      expect(content).toContain("reglas_count: 1");
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
