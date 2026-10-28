import type { AutoHealResult } from "../../scripts/verify_recursive_loop";

export interface ToolHistoryEntry {
  tool: string;
  timestamp: string;
  status: "invoked" | "success" | "failure";
}

export interface ToolCounterState {
  consecutive_reads: number;
  tools_since_last_test_runner: number;
  consecutive_failures: Record<string, number>;
  tool_counts: Record<string, number>;
  tool_failures: Record<string, number>;
  last_tool: string | null;
  history: ToolHistoryEntry[];
  last_updated: string;
}

export interface CircuitBreakerResult {
  allowed: boolean;
  decision: "allow" | "block";
  reason?: string;
  auto_heal?: AutoHealResult;
  stats: {
    consecutive_reads: number;
    tools_since_last_test_runner: number;
    tool_consecutive_failures: number;
    total_calls_for_tool: number;
    last_tool: string | null;
  };
}

export const IMMUTABLE_WHITELIST = new Set<string>([
  "send_message",
  "ask_question",
  "ask_permission",
  "write_file",
  "edit_file",
  "write_to_file",
  "replace_file_content",
]);

export const READ_TOOLS = new Set<string>(["read_file", "view_file", "read_resource", "read_url_content"]);

export const RESET_READ_STREAK_TOOLS = new Set<string>([
  "grep_search",
  "find_by_name",
  "list_dir",
  "search_web",
  "run_command",
  "write_file",
  "edit_file",
  "write_to_file",
  "replace_file_content",
  "generate_image",
]);

export const MAX_CONSECUTIVE_READS = 12;
export const MAX_CONSECUTIVE_FAILURES = 3;
export const MAX_TOOLS_WITHOUT_TESTS = 14;
export const DEFAULT_COUNTER_PATH = "_workspace/tool_counter.json";
export const MAX_HISTORY_LENGTH = 50;

export const TEST_RUNNER_REGEX = /(?:^|[\s/\\"'`])(?:bun(?:\.exe)?\s+(?:run\s+)?test|flutter(?:\.bat)?\s+test|pytest(?:\.exe)?|pest(?:\.bat|\.phar)?|vitest|cargo(?:\.exe)?\s+test|go(?:\.exe)?\s+test|npm(?:\.cmd)?\s+(?:run\s+)?test|pnpm(?:\.cmd)?\s+(?:run\s+)?test|yarn(?:\.cmd)?\s+test)(?:$|[\s/\\"'`])/i;

export function extractToolName(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") {
    const t = input.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try { return extractToolName(JSON.parse(t)); } catch { return t; }
    }
    return t;
  }
  if (typeof input === "object") {
    const o = input as Record<string, any>, t = o.tool;
    return (typeof t === "string" ? t : t?.name) ?? o.tool_name ?? o.toolName ?? o.name ??
      o.tool_call?.name ?? o.toolCall?.name ?? o.call?.name ?? o.function?.name ?? "";
  }
  return "";
}

export function extractCommandText(input: unknown, payload?: unknown): string {
  const parts: string[] = [];
  const check = (val: unknown) => {
    if (!val) return;
    if (typeof val === "string") {
      parts.push(val);
      if ((val.trim().startsWith("{") && val.trim().endsWith("}")) || (val.trim().startsWith("[") && val.trim().endsWith("]"))) {
        try { check(JSON.parse(val)); } catch {}
      }
    } else if (typeof val === "object") {
      const o = val as Record<string, any>;
      if (o.command) check(o.command);
      if (o.CommandLine) check(o.CommandLine);
      if (o.commandLine) check(o.commandLine);
      if (o.cmd) check(o.cmd);
      if (o.args) check(o.args);
      if (o.arguments) check(o.arguments);
      if (o.parameters) check(o.parameters);
      if (o.tool_call) check(o.tool_call);
      if (o.toolCall) check(o.toolCall);
      if (o.call) check(o.call);
      if (o.function) check(o.function);
    }
  };
  check(input);
  if (payload) check(payload);
  return parts.join(" ");
}

export function isTestRunner(tool: unknown, payload?: unknown): boolean {
  const raw = extractToolName(tool).trim().toLowerCase();
  if (TEST_RUNNER_REGEX.test(raw)) return true;
  const fullText = extractCommandText(tool, payload);
  return TEST_RUNNER_REGEX.test(fullText);
}

export function isToolFailurePayload(input: unknown): boolean {
  if (!input) return false;
  if (typeof input === "string") {
    return (
      /Command exited with code [1-9]/i.test(input) ||
      input.includes("Encountered error in step execution:") ||
      input.includes("Error invalid tool call:") ||
      /\[ERROR\]/im.test(input) ||
      /^error:\s+/im.test(input)
    );
  }
  if (typeof input !== "object") return false;
  const o = input as Record<string, any>;
  return Boolean(
    o.error || o.is_error === true || o.isError === true ||
    (typeof o.status === "string" && ["error", "failed", "failure"].includes(o.status.toLowerCase())) ||
    (typeof o.exit_code === "number" && o.exit_code !== 0) ||
    (typeof o.exitCode === "number" && o.exitCode !== 0) ||
    o.tool_output?.error || o.tool_output?.is_error === true ||
    (typeof o.tool_output?.exit_code === "number" && o.tool_output.exit_code !== 0) ||
    (typeof o.tool_output?.exitCode === "number" && o.tool_output.exitCode !== 0) ||
    o.result?.error || o.result?.is_error === true ||
    (typeof o.result?.exit_code === "number" && o.result.exit_code !== 0) ||
    (typeof o.result?.exitCode === "number" && o.result.exitCode !== 0) ||
    (typeof o.output === "string" && /Command exited with code [1-9]/i.test(o.output)) ||
    (typeof o.content === "string" && /Command exited with code [1-9]/i.test(o.content))
  );
}
