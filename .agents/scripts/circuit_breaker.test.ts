import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  CircuitBreaker,
  DEFAULT_COUNTER_PATH,
  IMMUTABLE_WHITELIST,
  isTestRunner,
  isToolFailurePayload,
  MAX_CONSECUTIVE_FAILURES,
  MAX_CONSECUTIVE_READS,
  MAX_TOOLS_WITHOUT_TESTS,
  runCLI,
  TEST_RUNNER_REGEX,
} from "./circuit_breaker";

const TEST_COUNTER_PATH = resolve("_workspace/test_tool_counter.json");

function cleanup() {
  if (existsSync(TEST_COUNTER_PATH)) {
    unlinkSync(TEST_COUNTER_PATH);
  }
}

describe("CircuitBreaker Unit Tests", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  test("1. Initializes with empty state and creates file on save", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);
    const state = breaker.getState();
    expect(state.consecutive_reads).toBe(0);
    expect(state.tools_since_last_test_runner).toBe(0);
    expect(state.consecutive_failures).toEqual({});
    expect(state.tool_counts).toEqual({});

    breaker.recordInvocation("list_dir");
    expect(existsSync(TEST_COUNTER_PATH)).toBe(true);
  });

  test("2. Immutable Whitelist tools are ALWAYS allowed, even under failure or read pressure", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

    // Simulate 15 consecutive reads and high failure count
    for (let i = 0; i < 15; i++) {
      breaker.recordInvocation("read_file");
    }
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure("send_message");
      breaker.recordFailure("write_to_file");
    }

    // Whitelist tools MUST still be allowed!
    for (const tool of IMMUTABLE_WHITELIST) {
      const res = breaker.check(tool);
      expect(res.allowed).toBe(true);
      expect(res.decision).toBe("allow");
    }

    // Also with namespace prefixes (e.g., default_api:send_message)
    const prefixedRes = breaker.check("default_api:send_message");
    expect(prefixedRes.allowed).toBe(true);
  });

  test("3. Blind sequential reads threshold blocks at >12 consecutive reads", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

    // Exactly 12 calls should be accepted
    for (let i = 1; i <= MAX_CONSECUTIVE_READS; i++) {
      const res = breaker.checkAndRecord("read_file");
      expect(res.allowed).toBe(true);
      expect(res.stats.consecutive_reads).toBe(i);
    }

    // The 13th call must be blocked
    const blockedRes = breaker.check("read_file");
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.decision).toBe("block");
    expect(blockedRes.reason).toContain("CIRCUIT_BREAKER_BLOCKED");
    expect(blockedRes.reason).toContain("12 lecturas secuenciales consecutivas");

    // view_file must also be blocked while streak is active
    const blockedViewRes = breaker.check("view_file");
    expect(blockedViewRes.allowed).toBe(false);
    expect(blockedViewRes.decision).toBe("block");
  });

  test("4. Search or write tools break the consecutive reads streak", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

    for (let i = 0; i < 12; i++) {
      breaker.checkAndRecord("read_file");
    }
    expect(breaker.check("read_file").allowed).toBe(false);

    // grep_search resets streak
    breaker.checkAndRecord("grep_search");
    expect(breaker.getState().consecutive_reads).toBe(0);

    // read_file is allowed again
    const postGrepRes = breaker.checkAndRecord("read_file");
    expect(postGrepRes.allowed).toBe(true);
    expect(breaker.getState().consecutive_reads).toBe(1);

    // Reset test runner counter to isolate read streak testing from TDD enforcer
    breaker.recordInvocation("bun test");

    // Now push to 12 again
    for (let i = 0; i < 11; i++) {
      breaker.checkAndRecord("view_file");
    }
    expect(breaker.check("view_file").allowed).toBe(false);

    // write_to_file resets streak
    breaker.checkAndRecord("write_to_file");
    expect(breaker.getState().consecutive_reads).toBe(0);
    expect(breaker.check("view_file").allowed).toBe(true);
  });

  test("5. Repetitive tool failures block tool after 3 consecutive failures", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);
    const tool = "custom_mcp_query";

    // 1st failure: still allowed to retry
    breaker.recordFailure(tool);
    expect(breaker.check(tool).allowed).toBe(true);

    // 2nd failure: still allowed to retry (Anti-Loop allows up to 2 retries)
    breaker.recordFailure(tool);
    expect(breaker.check(tool).allowed).toBe(true);

    // 3rd failure: MUST BE BLOCKED
    breaker.recordFailure(tool);
    const blockedRes = breaker.check(tool);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.decision).toBe("block");
    expect(blockedRes.reason).toContain("Protocolo Anti-Loop");
    expect(blockedRes.reason).toContain("3 veces consecutivas");

    // Success on recovery resets failure count and unblocks
    breaker.recordSuccess(tool);
    expect(breaker.getState().consecutive_failures[tool]).toBe(0);
    expect(breaker.check(tool).allowed).toBe(true);
  });

  test("6. Reset clears all counters cleanly", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

    breaker.checkAndRecord("read_file");
    breaker.recordFailure("external_api");
    expect(breaker.getState().consecutive_reads).toBe(1);
    expect(breaker.getState().tools_since_last_test_runner).toBe(1);
    expect(breaker.getState().consecutive_failures["external_api"]).toBe(1);

    breaker.reset();
    const fresh = breaker.getState();
    expect(fresh.consecutive_reads).toBe(0);
    expect(fresh.tools_since_last_test_runner).toBe(0);
    expect(fresh.consecutive_failures).toEqual({});
    expect(fresh.tool_counts).toEqual({});
    expect(fresh.history).toEqual([]);
    expect(breaker.check("read_file").allowed).toBe(true);
  });

  test("7. Handles corrupted state file gracefully", () => {
    writeFileSync(TEST_COUNTER_PATH, "{ invalid json content ...!#$", "utf-8");
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);
    expect(breaker.getState().consecutive_reads).toBe(0);
    expect(breaker.getState().tools_since_last_test_runner).toBe(0);
    expect(breaker.check("view_file").allowed).toBe(true);
  });

  test("8. Normalizes tool names with namespaces or slashes", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);
    expect(breaker.normalizeToolName("default_api:view_file")).toBe("view_file");
    expect(breaker.normalizeToolName("context7/query-docs")).toBe("query-docs");
    expect(breaker.isWhitelisted("default_api:write_file")).toBe(true);
    expect(breaker.isReadTool("default_api:read_file")).toBe(true);
  });

  test("9. Case insensitivity and combined namespaces are normalized properly", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);
    expect(breaker.normalizeToolName("READ_FILE")).toBe("read_file");
    expect(breaker.normalizeToolName("mcp:context7/query-docs")).toBe("query-docs");
    expect(breaker.normalizeToolName("default_api:VIEW_FILE")).toBe("view_file");

    // Case-insensitive whitelist
    expect(breaker.isWhitelisted("SEND_MESSAGE")).toBe(true);
    expect(breaker.isWhitelisted("default_api:WRITE_TO_FILE")).toBe(true);

    // Case-insensitive read tool detection
    expect(breaker.isReadTool("READ_FILE")).toBe(true);
    expect(breaker.isReadTool("VIEW_FILE")).toBe(true);

    // Consecutive reads track case-insensitively
    breaker.recordInvocation("READ_FILE");
    expect(breaker.getState().consecutive_reads).toBe(1);
    expect(breaker.getState().tool_counts["read_file"]).toBe(1);
  });

  test("10. Object payload formats are parsed without TypeError", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

    // Object formats
    const res1 = breaker.check({ tool: { name: "read_file" } });
    expect(res1.allowed).toBe(true);

    const res2 = breaker.check({ tool_call: { name: "send_message" } });
    expect(res2.allowed).toBe(true);

    const res3 = breaker.check({ tool_name: "find_by_name" });
    expect(res3.allowed).toBe(true);

    breaker.recordInvocation({ tool: { name: "read_file" } });
    expect(breaker.getState().consecutive_reads).toBe(1);
    expect(breaker.getState().tool_counts["read_file"]).toBe(1);
  });

  test("11. Intermittent failure pattern: 2 failures -> 1 success -> 2 failures -> allowed; 3rd failure -> blocked", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);
    const tool = "intermittent_mcp";

    // 2 consecutive failures
    breaker.recordFailure(tool);
    breaker.recordFailure(tool);
    expect(breaker.check(tool).allowed).toBe(true);
    expect(breaker.getState().consecutive_failures[tool]).toBe(2);

    // 1 success resets failure streak
    breaker.recordSuccess(tool);
    expect(breaker.getState().consecutive_failures[tool]).toBe(0);
    expect(breaker.check(tool).allowed).toBe(true);

    // 2 more failures -> still allowed (2/3)
    breaker.recordFailure(tool);
    breaker.recordFailure(tool);
    expect(breaker.check(tool).allowed).toBe(true);
    expect(breaker.getState().consecutive_failures[tool]).toBe(2);

    // 3rd consecutive failure -> blocked!
    breaker.recordFailure(tool);
    const blockedRes = breaker.check(tool);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.decision).toBe("block");
    expect(blockedRes.reason).toContain("Protocolo Anti-Loop");
  });

  test("12. In-Flight TDD Enforcer: tracks tools_since_last_test_runner and blocks at 14 consecutive non-test calls", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

    // Execute 14 non-test tools (alternating read and search to avoid read streak breaker)
    for (let i = 1; i <= MAX_TOOLS_WITHOUT_TESTS; i++) {
      const toolName = i % 2 === 0 ? "grep_search" : "find_by_name";
      const res = breaker.checkAndRecord(toolName);
      expect(res.allowed).toBe(true);
      expect(res.stats.tools_since_last_test_runner).toBe(i);
    }

    expect(breaker.getState().tools_since_last_test_runner).toBe(14);

    // 15th non-test tool call MUST be blocked by TDD Enforcer
    const blockedRes = breaker.check("grep_search");
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.decision).toBe("block");
    expect(blockedRes.reason).toBe(
      "CIRCUIT_BREAKER_BLOCKED: Se han ejecutado 14 herramientas consecutivas sin validar la suite de pruebas. Aplique el ciclo TDD (Red -> Green -> Refactor) con el runner nativo ('bun test', 'flutter test', etc.) antes de continuar."
    );
  });

  test("13. Native test runners reset tools_since_last_test_runner = 0 and are allowed when budget is exhausted", () => {
    const testRunners = [
      "bun test",
      "bun run test",
      "flutter test",
      "pytest",
      "pest",
      "vitest",
      "cargo test",
      "go test",
    ];

    for (const runner of testRunners) {
      cleanup();
      const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

      // Saturate counter to 14
      for (let i = 0; i < 14; i++) {
        breaker.recordInvocation(i % 2 === 0 ? "grep_search" : "find_by_name");
      }
      expect(breaker.getState().tools_since_last_test_runner).toBe(14);

      // Runner check MUST be allowed even though counter is 14!
      const checkRes = breaker.check(runner);
      expect(checkRes.allowed).toBe(true);
      expect(checkRes.decision).toBe("allow");

      // Invoking runner resets counter to 0
      breaker.recordInvocation(runner);
      expect(breaker.getState().tools_since_last_test_runner).toBe(0);

      // Now normal tools are unblocked again
      expect(breaker.check("grep_search").allowed).toBe(true);
    }
  });

  test("14. Whitelist tools are NEVER blocked by TDD Enforcer even when budget is exhausted (>14 calls)", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

    // Saturate counter to 20
    for (let i = 0; i < 20; i++) {
      breaker.recordInvocation("grep_search");
    }
    expect(breaker.getState().tools_since_last_test_runner).toBe(20);

    // Non-whitelist tool is blocked
    expect(breaker.check("grep_search").allowed).toBe(false);

    // All whitelist tools MUST be allowed (Immutable Whitelist guarantee)
    for (const tool of IMMUTABLE_WHITELIST) {
      const res = breaker.check(tool);
      expect(res.allowed).toBe(true);
      expect(res.decision).toBe("allow");
    }
  });

  test("15. run_command with CommandLine payload is recognized as test runner and resets counter", () => {
    const breaker = new CircuitBreaker(TEST_COUNTER_PATH);

    for (let i = 0; i < 14; i++) {
      breaker.recordInvocation("grep_search");
    }
    expect(breaker.getState().tools_since_last_test_runner).toBe(14);

    // Normal run_command (e.g. git status) is blocked
    const gitCheck = breaker.check("run_command", { CommandLine: "git status" });
    expect(gitCheck.allowed).toBe(false);

    // run_command with bun test is recognized as test runner and allowed
    const testCheck = breaker.check("run_command", { CommandLine: "bun test src/features/resource/resource.test.ts" });
    expect(testCheck.allowed).toBe(true);
    expect(testCheck.decision).toBe("allow");

    // Invoking it resets counter to 0
    breaker.recordInvocation("run_command", { CommandLine: "bun test" });
    expect(breaker.getState().tools_since_last_test_runner).toBe(0);
  });
});

describe("CircuitBreaker CLI Execution Tests", () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  test("CLI: allows normal tool calls with exit code 0", async () => {
    const exitCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "find_by_name"]);
    expect(exitCode).toBe(0);
  });

  test("CLI: blocks when exceeding consecutive reads with exit code 1", async () => {
    // Perform 12 reads
    for (let i = 0; i < 12; i++) {
      const code = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "read_file"]);
      expect(code).toBe(0);
    }
    // 13th call must return 1
    const blockedCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "read_file"]);
    expect(blockedCode).toBe(1);
  });

  test("CLI: resets counters with --reset", async () => {
    const resetCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--reset"]);
    expect(resetCode).toBe(0);

    const statusCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--status"]);
    expect(statusCode).toBe(0);
  });

  test("CLI: records failures and blocks on 3rd failure", async () => {
    const tool = "unstable_tool";
    const f1 = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", tool]);
    expect(f1).toBe(0); // 1st failure: retries remain
    const f2 = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", tool]);
    expect(f2).toBe(0); // 2nd failure: retries remain
    const f3 = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", tool]);
    expect(f3).toBe(1); // 3rd failure: trips breaker

    const code = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", tool]);
    expect(code).toBe(1);

    // Record success
    const successCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--success", tool]);
    expect(successCode).toBe(0);

    // Now allowed
    const unblockedCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", tool]);
    expect(unblockedCode).toBe(0);
  });

  test("CLI: Whitelist tool failure recording maintains allowed: true", async () => {
    const code = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", "send_message"]);
    expect(code).toBe(0);

    const checkCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "send_message"]);
    expect(checkCode).toBe(0);
  });

  test("CLI: PostToolUse mode handles success and failure payloads correctly", async () => {
    const tool = "post_test_tool";
    // Success via post-tool
    const sCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--post-tool", "--tool", tool]);
    expect(sCode).toBe(0);

    // Fail via direct fail CLI mode
    await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", tool]);
    await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", tool]);
    const tripCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", tool]);
    expect(tripCode).toBe(1);

    // PreTool check is blocked
    const checkBlocked = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", tool]);
    expect(checkBlocked).toBe(1);

    // Success resets
    const resetSuccess = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--success", tool]);
    expect(resetSuccess).toBe(0);

    const checkAllowed = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", tool]);
    expect(checkAllowed).toBe(0);
  });

  test("CLI: TDD Enforcer blocks on 15th call without test runner and resets with test runner command", async () => {
    // 14 alternating calls allowed
    for (let i = 1; i <= 14; i++) {
      const tool = i % 2 === 0 ? "grep_search" : "find_by_name";
      const code = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", tool]);
      expect(code).toBe(0);
    }

    // 15th non-test tool is blocked (exit code 1)
    const blockedCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "grep_search"]);
    expect(blockedCode).toBe(1);

    // Whitelist tool is still allowed (exit code 0)
    const whitelistCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "send_message"]);
    expect(whitelistCode).toBe(0);

    // Running test runner via run_command with --command resets counter
    const testRunnerCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "run_command", "--command", "bun test"]);
    expect(testRunnerCode).toBe(0);

    // Non-test tool is unblocked again
    const unblockedCode = await runCLI(["--counter-file", TEST_COUNTER_PATH, "--tool", "grep_search"]);
    expect(unblockedCode).toBe(0);
  });

  test("CLI: --auto-heal triggers silent self-healing on >=2 consecutive failures and updates heuristics", async () => {
    const testDir = join(tmpdir(), `cb-autoheal-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    const heuristicsFile = join(testDir, "learned_heuristics.md");

    try {
      // 1st failure: retries remaining, no auto-heal triggered yet
      const f1 = await runCLI([
        "--counter-file", TEST_COUNTER_PATH,
        "--fail", "run_command",
        "--auto-heal",
        "--heuristics-file", heuristicsFile,
        "--skill", "backend-architect",
      ]);
      expect(f1).toBe(0);
      expect(existsSync(heuristicsFile)).toBe(false);

      // 2nd failure: consecutive failures = 2 -> auto-heal is triggered!
      const f2 = await runCLI([
        "--counter-file", TEST_COUNTER_PATH,
        "--fail", "run_command",
        "--auto-heal",
        "--heuristics-file", heuristicsFile,
        "--skill", "backend-architect",
      ]);
      expect(f2).toBe(0);
      expect(existsSync(heuristicsFile)).toBe(true);

      const content = readFileSync(heuristicsFile, "utf-8");
      expect(content).toContain("tipo: learned_heuristics");
      expect(content).toContain("backend-architect");
      expect(content).toContain("reglas_count: 1");
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("CLI: --auto-heal in PreTool check injects heuristic when tool is blocked by breaker", async () => {
    const testDir = join(tmpdir(), `cb-pretool-autoheal-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    const heuristicsFile = join(testDir, "learned_heuristics.md");

    try {
      // Trip the breaker with 3 failures
      await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", "failing_mcp"]);
      await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", "failing_mcp"]);
      await runCLI(["--counter-file", TEST_COUNTER_PATH, "--fail", "failing_mcp"]);

      // Pre-tool check with --auto-heal
      const checkCode = await runCLI([
        "--counter-file", TEST_COUNTER_PATH,
        "--tool", "failing_mcp",
        "--auto-heal",
        "--heuristics-file", heuristicsFile,
        "--skill", "systems-auditor",
      ]);
      expect(checkCode).toBe(1); // Still blocked
      expect(existsSync(heuristicsFile)).toBe(true);

      const content = readFileSync(heuristicsFile, "utf-8");
      expect(content).toContain("systems-auditor");
      expect(content).toContain("failing_mcp");
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("isToolFailurePayload correctly identifies non-zero exit codes, nested errors, and error strings", () => {
    // Top-level exit codes
    expect(isToolFailurePayload({ exit_code: 1 })).toBe(true);
    expect(isToolFailurePayload({ exitCode: 127 })).toBe(true);
    expect(isToolFailurePayload({ exit_code: 0 })).toBe(false);
    expect(isToolFailurePayload({ exitCode: 0 })).toBe(false);

    // Nested tool_output / result
    expect(isToolFailurePayload({ tool_output: { exit_code: 1 } })).toBe(true);
    expect(isToolFailurePayload({ tool_output: { exitCode: 2 } })).toBe(true);
    expect(isToolFailurePayload({ result: { exit_code: 1 } })).toBe(true);
    expect(isToolFailurePayload({ result: { exitCode: 1 } })).toBe(true);
    expect(isToolFailurePayload({ tool_output: { exit_code: 0 } })).toBe(false);

    // String payloads
    expect(isToolFailurePayload("Command exited with code 1.")).toBe(true);
    expect(isToolFailurePayload("Encountered error in step execution: timeout")).toBe(true);
    expect(isToolFailurePayload("Error invalid tool call: missing arg")).toBe(true);
    expect(isToolFailurePayload("[ERROR] Database locked")).toBe(true);
    expect(isToolFailurePayload("Command exited with code 0.")).toBe(false);

    // Standard statuses and error flags
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
      // 1st failure via post-tool with --exit-code 1
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
      expect(p1).toBe(0); // Allowed since fails = 1 (threshold is 3 to block)
      expect(existsSync(heuristicsFile)).toBe(false);

      // 2nd failure via post-tool with --exit-code 1 -> triggers auto-heal!
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
      expect(p2).toBe(0); // Allowed (fails = 2 < 3)
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
