import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CircuitBreaker,
  DEFAULT_COUNTER_PATH,
  IMMUTABLE_WHITELIST,
  isTestRunner,
  MAX_CONSECUTIVE_FAILURES,
  MAX_CONSECUTIVE_READS,
  MAX_TOOLS_WITHOUT_TESTS,
  TEST_RUNNER_REGEX,
} from "./circuit_breaker";

const TEST_COUNTER_PATH = resolve("_workspace/test_tool_counter.json");

function cleanup() {
  if (existsSync(TEST_COUNTER_PATH)) {
    unlinkSync(TEST_COUNTER_PATH);
  }
}

describe("CircuitBreaker Unit Tests", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

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
