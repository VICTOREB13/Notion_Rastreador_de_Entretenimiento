import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { autoHealFromFailure, type AutoHealResult } from "../../scripts/verify_recursive_loop";
import { atomicWriteFileSync } from "./harness_io";

export interface ToolHistoryEntry {
  tool: string;
  timestamp: string;
  status: "invoked" | "success" | "failure";
}

export interface PendingOutcome {
  stepIdx: number;
  tool: string;
  args?: Record<string, any>;
  attempts: number;
}

export interface ToolCounterState {
  consecutive_reads: number;
  tools_since_last_test_runner: number;
  edits_since_last_test: number;
  edits_total: number;
  consecutive_test_failures: number;
  last_test_passed: boolean | null;
  consecutive_failures: Record<string, number>;
  denials_since_open: Record<string, number>;
  tool_counts: Record<string, number>;
  tool_failures: Record<string, number>;
  pending_outcomes: PendingOutcome[];
  last_sanitized_step: number | null;
  rules_fired: string[];
  rules_credited: string[];
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

// Coordinación entre agentes: bloquearlas deja al Planner sin poder despachar ni esperar subagentes.
export const ORCHESTRATION_TOOLS = new Set<string>([
  "manage_task",
  "schedule",
  "manage_subagents",
  "invoke_subagent",
  "define_subagent",
]);

export const IMMUTABLE_WHITELIST = new Set<string>([
  "send_message",
  "ask_question",
  "ask_permission",
  "write_file",
  "edit_file",
  "write_to_file",
  "replace_file_content",
  ...ORCHESTRATION_TOOLS,
]);

export const EDIT_TOOLS = new Set<string>(["write_file", "edit_file", "write_to_file", "replace_file_content"]);
const NON_CODE_FILE_REGEX = /\.(?:md|mdx|txt|rst)["']?$/i;

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
// Half-open: tras N denegaciones se deja pasar un intento. PostToolUse no se dispara tras un
// "deny", así que sin esto un circuito abierto no podría cerrarse jamás por sí mismo.
export const PROBE_AFTER_DENIALS = 3;
const TEST_LOOP_KEY = "__test_runner__";

const TEST_RUNNER_PATTERN = String.raw`(?:bun(?:\.exe)?\s+(?:run\s+)?test(?::[\w:-]+)?|flutter(?:\.bat)?\s+test|dart(?:\.exe)?\s+test|pytest(?:\.exe)?|pest(?:\.bat|\.phar)?|phpunit(?:\.bat|\.phar)?|php\s+artisan\s+test|vitest|jest|cargo(?:\.exe)?\s+test|go(?:\.exe)?\s+test|deno\s+test|npm(?:\.cmd)?\s+(?:run\s+)?test(?::[\w:-]+)?|pnpm(?:\.cmd)?\s+(?:run\s+)?test(?::[\w:-]+)?|yarn(?:\.cmd)?\s+test(?::[\w:-]+)?)`;
export const TEST_RUNNER_REGEX = new RegExp(String.raw`(?:^|[\s/\\"'` + "`" + String.raw`])${TEST_RUNNER_PATTERN}(?:$|[\s/\\"'` + "`" + String.raw`])`, "i");

// El runner debe estar en posición de comando: 'echo bun test' no valida nada.
const TEST_RUNNER_COMMAND_REGEX = new RegExp(String.raw`^\s*["'` + "`" + String.raw`]?(?:[A-Za-z_]\w*=\S*\s+)*(?:npx\s+|bunx\s+|python3?(?:\.exe)?\s+-m\s+)?(?:\S*[/\\])?${TEST_RUNNER_PATTERN}(?:$|[\s"'` + "`" + String.raw`])`, "i");
const SHELL_WRAPPER_REGEX = /^\s*(?:cmd(?:\.exe)?\s+\/[cC]|(?:powershell|pwsh)(?:\.exe)?(?:\s+-\w+)*|(?:ba)?sh\s+-l?c)\s+/i;

function hasTestRunnerCommand(commandLine: string): boolean {
  const unwrapped = commandLine.replace(SHELL_WRAPPER_REGEX, "");
  return unwrapped.split(/&&|\|\||;|\|/).some((segment) => TEST_RUNNER_COMMAND_REGEX.test(segment));
}

// Los comandos en segundo plano no tienen exit code: solo cuenta la evidencia en su salida.
export const BACKGROUND_FAILURE_REGEX = /CommandNotFoundException|no se reconoce como|is not recognized as|command not found|traceback \(most recent call last\)|\b[1-9]\d* (?:tests? )?fail(?:ed|ures?)?\b/i;

const SUBCOMMAND_PROGRAMS = new Set<string>(["git", "bun", "bunx", "npm", "npx", "pnpm", "yarn", "cargo", "go", "docker", "gh", "flutter", "dart", "php", "python", "node", "dotnet", "kubectl"]);

/** Último comando de la cadena reducido a programa + subcomando ('git status', 'rustc'). */
export function commandFamily(commandLine: string): string {
  const segment = commandLine.split(/&&|\|\||;/).map((s) => s.trim()).filter(Boolean).pop() || "";
  const tokens = segment.replace(/^(?:[A-Za-z_]\w*=\S*\s+)+/, "").split(/\s+/);
  const program = (tokens[0] || "").replace(/^["'`]|["'`]$/g, "").split(/[/\\]/).pop()!.toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, "");
  const sub = tokens[1] && !tokens[1].startsWith("-") && SUBCOMMAND_PROGRAMS.has(program) ? ` ${tokens[1].toLowerCase()}` : "";
  return `${program}${sub}`;
}

function commandLineOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const o = payload as Record<string, any>;
  const direct = o.CommandLine ?? o.commandLine ?? o.command ?? o.cmd;
  if (typeof direct === "string") return direct;
  return commandLineOf(o.args) || commandLineOf(o.toolCall) || commandLineOf(o.tool_call);
}

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
  if (hasTestRunnerCommand(raw)) return true;
  const fromPayload = commandLineOf(payload) || commandLineOf(tool);
  if (fromPayload) return hasTestRunnerCommand(fromPayload);
  return hasTestRunnerCommand(extractCommandText(tool, payload));
}

/** Texto útil del fallo: nunca el payload completo, que arrastraría args y contenido de archivos. */
export function extractErrorText(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (typeof input !== "object") return String(input);
  const o = input as Record<string, any>;
  for (const candidate of [o.error, o.tool_output?.error, o.result?.error, o.output, o.content, o.tool_output?.output]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
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

export class CircuitBreaker {
  private filePath: string;
  private state: ToolCounterState;

  constructor(customPath?: string) {
    this.filePath = resolve(customPath || process.env.TOOL_COUNTER_FILE || DEFAULT_COUNTER_PATH);
    this.state = this.loadState();
  }

  public getFilePath(): string { return this.filePath; }
  public getState(): ToolCounterState { return { ...this.state }; }

  private getInitialState(): ToolCounterState {
    return {
      consecutive_reads: 0,
      tools_since_last_test_runner: 0,
      edits_since_last_test: 0,
      edits_total: 0,
      consecutive_test_failures: 0,
      last_test_passed: null,
      consecutive_failures: {},
      denials_since_open: {},
      tool_counts: {},
      tool_failures: {},
      pending_outcomes: [],
      last_sanitized_step: null,
      rules_fired: [],
      rules_credited: [],
      last_tool: null,
      history: [],
      last_updated: new Date().toISOString(),
    };
  }

  private loadState(): ToolCounterState {
    try {
      if (existsSync(this.filePath)) {
        const p = JSON.parse(readFileSync(this.filePath, "utf-8")), obj = (v: any) => v && typeof v === "object" ? v : {};
        const num = (v: any) => typeof v === "number" ? v : 0;
        return {
          consecutive_reads: num(p.consecutive_reads),
          tools_since_last_test_runner: num(p.tools_since_last_test_runner),
          edits_since_last_test: num(p.edits_since_last_test),
          edits_total: num(p.edits_total),
          consecutive_test_failures: num(p.consecutive_test_failures),
          last_test_passed: typeof p.last_test_passed === "boolean" ? p.last_test_passed : null,
          consecutive_failures: obj(p.consecutive_failures),
          denials_since_open: obj(p.denials_since_open),
          tool_counts: obj(p.tool_counts),
          tool_failures: obj(p.tool_failures),
          pending_outcomes: Array.isArray(p.pending_outcomes) ? p.pending_outcomes : [],
          last_sanitized_step: typeof p.last_sanitized_step === "number" ? p.last_sanitized_step : null,
          rules_fired: Array.isArray(p.rules_fired) ? p.rules_fired : [],
          rules_credited: Array.isArray(p.rules_credited) ? p.rules_credited : [],
          last_tool: typeof p.last_tool === "string" ? p.last_tool : null,
          history: Array.isArray(p.history) ? p.history : [],
          last_updated: typeof p.last_updated === "string" ? p.last_updated : new Date().toISOString(),
        };
      }
    } catch {}
    return this.getInitialState();
  }

  public saveState(): void {
    try {
      this.state.last_updated = new Date().toISOString();
      if (this.state.history.length > MAX_HISTORY_LENGTH) this.state.history = this.state.history.slice(-MAX_HISTORY_LENGTH);
      atomicWriteFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    } catch (err) {
      console.error(`[CircuitBreaker] Error saving state to ${this.filePath}:`, err);
    }
  }

  public normalizeToolName(tool: unknown): string {
    const raw = extractToolName(tool);
    if (!raw) return "";
    let t = raw.trim().toLowerCase();
    if (t.includes(":")) t = t.split(":").pop()!.trim();
    if (t.includes("/")) t = t.split("/").pop()!.trim();
    if (t.includes("__")) t = t.split("__").pop()!.trim();
    return t;
  }

  /**
   * Clave del anti-loop. Para comandos es programa + subcomando: tres fallos de 'rustc' no
   * deben bloquear 'git status', y por el contrario variar los flags no esquiva el contador.
   */
  public failureKey(tool: unknown, payload?: unknown): string {
    const base = this.normalizeToolName(tool);
    const command = commandLineOf(payload) || commandLineOf(tool);
    if (command) return `${base}:${commandFamily(command)}`;
    const o = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
    const server = o.ServerName ?? o.server_name, name = o.ToolName ?? o.tool_name;
    return typeof server === "string" && typeof name === "string" ? `${base}:${server}/${name}` : base;
  }

  public failureCount(tool: unknown, payload?: unknown): number {
    const base = this.normalizeToolName(tool);
    return Math.max(this.state.consecutive_failures[this.failureKey(tool, payload)] || 0, this.state.consecutive_failures[base] || 0);
  }

  private isCodeEdit(tool: unknown, payload?: unknown): boolean {
    if (!this.inSet(tool, EDIT_TOOLS)) return false;
    const o = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
    const target = o.TargetFile ?? o.targetFile ?? o.target_file ?? o.file_path ?? o.filePath ?? o.path;
    return !(typeof target === "string" && NON_CODE_FILE_REGEX.test(target.trim()));
  }

  private inSet(tool: unknown, s: Set<string>): boolean {
    return s.has(extractToolName(tool).trim().toLowerCase()) || s.has(this.normalizeToolName(tool));
  }

  public isWhitelisted(tool: unknown): boolean { return this.inSet(tool, IMMUTABLE_WHITELIST); }
  public isReadTool(tool: unknown): boolean { return this.inSet(tool, READ_TOOLS); }
  public isStreakBreaker(tool: unknown): boolean { return this.inSet(tool, RESET_READ_STREAK_TOOLS); }

  public check(tool: unknown, payload?: unknown): CircuitBreakerResult {
    const raw = extractToolName(tool).trim().toLowerCase(), base = this.normalizeToolName(raw);
    const key = this.failureKey(tool, payload);
    const consecutiveFailures = this.failureCount(tool, payload);
    const totalCalls =(base ? this.state.tool_counts[base] : 0) ?? (raw ? this.state.tool_counts[raw] : 0) ?? 0;
    const baseStats = {
      consecutive_reads: this.state.consecutive_reads,
      tools_since_last_test_runner: this.state.tools_since_last_test_runner,
      tool_consecutive_failures: consecutiveFailures,
      total_calls_for_tool: totalCalls,
      last_tool: this.state.last_tool,
    };

    // 1. Immutable Whitelist tools are ALWAYS allowed under any condition
    if (this.isWhitelisted(raw)) return { allowed: true, decision: "allow", stats: baseStats };

    // 2. Test runners stay allowed so the agent can fulfill TDD, except when re-running a
    // suite that keeps failing with no code change in between: that can only fail again.
    if (isTestRunner(tool, payload)) {
      const stuckOnTests = this.state.consecutive_test_failures >= MAX_CONSECUTIVE_FAILURES &&
        this.state.edits_since_last_test === 0 &&
        (this.state.denials_since_open[TEST_LOOP_KEY] || 0) < PROBE_AFTER_DENIALS;
      if (stuckOnTests) {
        return {
          allowed: false,
          decision: "block",
          stats: baseStats,
          reason: `CIRCUIT_BREAKER_BLOCKED: La suite de pruebas falló ${this.state.consecutive_test_failures} veces consecutivas sin cambios de código entre ejecuciones. Protocolo Anti-Loop (AGENTS.md Sección 7): diagnostique la causa raíz antes de volver a ejecutarla.`,
        };
      }
      return { allowed: true, decision: "allow", stats: baseStats };
    }

    // 3. Consecutive failures threshold (Anti-loop max 3 retries), half-open tras N denegaciones
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && (this.state.denials_since_open[key] || 0) < PROBE_AFTER_DENIALS) {
      return {
        allowed: false,
        decision: "block",
        stats: baseStats,
        reason: `CIRCUIT_BREAKER_BLOCKED: La herramienta '${key}' ha fallado ${consecutiveFailures} veces consecutivas. Se activa el Protocolo Anti-Loop (AGENTS.md Sección 7). Se requiere PAUSA OBLIGATORIA y diagnóstico de causa raíz (Code Defect vs Harness Defect) antes de reintentar.`,
      };
    }

    // 4. Blind sequential reads threshold
    if (this.isReadTool(raw) && this.state.consecutive_reads >= MAX_CONSECUTIVE_READS) {
      return {
        allowed: false,
        decision: "block",
        stats: baseStats,
        reason: `CIRCUIT_BREAKER_BLOCKED: Se superó el límite de ${MAX_CONSECUTIVE_READS} lecturas secuenciales consecutivas ('read_file'/'view_file') sin alternar con búsqueda estructurada o escritura. Para prevenir consumo excesivo de tokens y pérdida de contexto, utilice 'grep_search', 'find_by_name', o aplique la Regla 9 de AGENTS.md (Offloading Mecánico: forje un script en scripts/ para escaneo masivo).`,
      };
    }

    // 5. In-Flight TDD Enforcer threshold (>14 tools without test runner). Solo aplica con código
    // editado sin validar: explorar o planificar no tiene nada que probar.
    if (this.state.tools_since_last_test_runner >= MAX_TOOLS_WITHOUT_TESTS && this.state.edits_since_last_test > 0) {
      return {
        allowed: false,
        decision: "block",
        stats: baseStats,
        reason: `CIRCUIT_BREAKER_BLOCKED: Se han ejecutado 14 herramientas consecutivas sin validar la suite de pruebas. Aplique el ciclo TDD (Red -> Green -> Refactor) con el runner nativo ('bun test', 'flutter test', etc.) antes de continuar.`,
      };
    }

    return { allowed: true, decision: "allow", stats: baseStats };
  }

  private pushHistory(tool: string, status: ToolHistoryEntry["status"]): void {
    this.state.history.push({ tool, timestamp: new Date().toISOString(), status });
    this.saveState();
  }

  public recordInvocation(tool: unknown, payload?: unknown): void {
    const raw = extractToolName(tool).trim().toLowerCase(), base = this.normalizeToolName(raw);
    if (!base) return;

    if (this.isReadTool(raw)) {
      this.state.consecutive_reads += 1;
    } else if (this.isStreakBreaker(raw)) {
      this.state.consecutive_reads = 0;
    }

    if (isTestRunner(tool, payload)) {
      this.state.tools_since_last_test_runner = 0;
      this.state.edits_since_last_test = 0;
    } else if (!this.inSet(tool, ORCHESTRATION_TOOLS)) {
      this.state.tools_since_last_test_runner = (this.state.tools_since_last_test_runner || 0) + 1;
    }

    if (this.isCodeEdit(tool, payload)) {
      this.state.edits_since_last_test += 1;
      this.state.edits_total += 1;
    }

    this.state.tool_counts[base] = (this.state.tool_counts[base] || 0) + 1;
    this.state.last_tool = base;
    this.pushHistory(base, "invoked");
  }

  public recordFailure(tool: unknown, payload?: unknown): void {
    const raw = extractToolName(tool).trim().toLowerCase(), base = this.normalizeToolName(raw);
    if (!base) return;
    const key = this.failureKey(tool, payload);
    this.state.consecutive_failures[key] = (this.state.consecutive_failures[key] || 0) + 1;
    delete this.state.denials_since_open[key];
    this.state.tool_failures[base] = (this.state.tool_failures[base] || 0) + 1;
    this.pushHistory(base, "failure");
  }

  public recordSuccess(tool: unknown, payload?: unknown): void {
    const raw = extractToolName(tool).trim().toLowerCase(), base = this.normalizeToolName(raw);
    if (!base) return;
    const key = this.failureKey(tool, payload);
    this.state.consecutive_failures[base] = 0;
    this.state.consecutive_failures[key] = 0;
    delete this.state.denials_since_open[key];
    if (isTestRunner(tool, payload)) {
      this.state.tools_since_last_test_runner = 0;
    }
    this.pushHistory(base, "success");
  }

  /** Un test rojo no es un fallo de herramienta, pero tampoco puede ser invisible al anti-loop. */
  public recordTestResult(passed: boolean): void {
    this.state.last_test_passed = passed;
    this.state.consecutive_test_failures = passed ? 0 : this.state.consecutive_test_failures + 1;
    delete this.state.denials_since_open[TEST_LOOP_KEY];
    this.saveState();
  }

  public recordDenial(tool: unknown, payload?: unknown): void {
    const key = isTestRunner(tool, payload) ? TEST_LOOP_KEY : this.failureKey(tool, payload);
    if (!key) return;
    this.state.denials_since_open[key] = (this.state.denials_since_open[key] || 0) + 1;
    this.saveState();
  }

  public addPendingOutcome(stepIdx: number, tool: string, args?: Record<string, any>): void {
    this.state.pending_outcomes.push({ stepIdx, tool, args, attempts: 0 });
    this.saveState();
  }

  public requeuePendingOutcome(item: PendingOutcome): void {
    this.state.pending_outcomes.push(item);
  }

  public takePendingOutcomes(): PendingOutcome[] {
    const pending = this.state.pending_outcomes;
    this.state.pending_outcomes = [];
    return pending;
  }

  /** Regla creada o reactivada en esta conversación: no puede acreditarse como éxito en ella. */
  public noteRuleFired(ruleKey: string): void {
    if (!this.state.rules_fired.includes(ruleKey)) this.state.rules_fired.push(ruleKey);
    this.saveState();
  }

  public noteRuleCredited(ruleKey: string): void {
    if (!this.state.rules_credited.includes(ruleKey)) this.state.rules_credited.push(ruleKey);
    this.saveState();
  }

  public markSanitized(stepIdx?: number): void {
    if (typeof stepIdx !== "number") return;
    this.state.last_sanitized_step = stepIdx;
    this.saveState();
  }

  /** Un nuevo turno humano cumple la pausa obligatoria: se levantan los bloqueos del turno anterior. */
  public clearTransientBlocks(): void {
    this.state.consecutive_failures = {};
    this.state.denials_since_open = {};
    this.state.consecutive_test_failures = 0;
    this.state.consecutive_reads = 0;
    if (existsSync(this.filePath)) this.saveState();
  }

  public checkAndRecord(tool: unknown, payload?: unknown): CircuitBreakerResult {
    const result = this.check(tool, payload);
    if (!result.allowed) this.recordDenial(tool, payload);
    if (result.allowed) {
      this.recordInvocation(tool, payload);
      const base = this.normalizeToolName(tool);
      result.stats.consecutive_reads = this.state.consecutive_reads;
      result.stats.tools_since_last_test_runner = this.state.tools_since_last_test_runner;
      result.stats.total_calls_for_tool = this.state.tool_counts[base] || 0;
      result.stats.last_tool = this.state.last_tool;
    }
    return result;
  }

  public reset(): void {
    this.state = this.getInitialState();
    this.saveState();
  }

  public autoHeal(params: {
    tool: string;
    error?: string;
    stepContent?: string;
    consecutiveFails?: number;
    breakerBlocked?: boolean;
    breakerReason?: string;
    skill?: string;
    customPath?: string;
    ruleSuggestion?: string;
    workspaceRoot?: string;
  }): AutoHealResult {
    const raw = extractToolName(params.tool).trim().toLowerCase();
    const base = this.normalizeToolName(raw);
    const fails = params.consecutiveFails ?? (this.state.consecutive_failures[base] || 0);
    return autoHealFromFailure({
      tool: base || raw,
      error: params.error,
      stepContent: params.stepContent,
      consecutiveFails: fails,
      breakerBlocked: params.breakerBlocked,
      breakerReason: params.breakerReason,
      skill: params.skill,
      customPath: params.customPath,
      ruleSuggestion: params.ruleSuggestion,
      workspaceRoot: params.workspaceRoot,
    });
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  return new Promise((res) => {
    const finish = () => res(chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8").trim() : "");
    const timer = setTimeout(finish, 2000);
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.once("end", () => { clearTimeout(timer); finish(); });
    process.stdin.once("error", () => { clearTimeout(timer); finish(); });
  });
}

export async function runCLI(argv: string[]): Promise<number> {
  let tool = "", customPath: string | undefined, rawPayload: unknown = null;
  let mode: "check-and-record" | "check-only" | "record-failure" | "record-success" | "reset" | "status" | "post-tool" = "check-and-record";
  let autoHealEnabled = false;
  let targetSkill: string | undefined;
  let customHeuristicsPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reset") mode = "reset";
    else if (a === "--status") mode = "status";
    else if (a === "--check" || a === "--check-only") mode = "check-only";
    else if (a === "--fail" || a === "--failed" || a === "--record-failure") mode = "record-failure";
    else if (a === "--success" || a === "--record-success") mode = "record-success";
    else if (a === "--post" || a === "--post-tool") mode = "post-tool";
    else if (a === "--auto-heal") autoHealEnabled = true;
    else if (a === "--skill") targetSkill = argv[++i];
    else if (a === "--heuristics-file") customHeuristicsPath = argv[++i];
    else if (a === "--counter-file" || a === "-f") customPath = argv[++i];
    else if (a === "--tool" || a === "-t") tool = argv[++i] || "";
    else if (a === "--command" || a === "--cmd" || a === "-c") {
      const cmd = argv[++i];
      if (typeof rawPayload === "object" && rawPayload !== null) {
        (rawPayload as any).CommandLine = cmd;
      } else {
        rawPayload = { CommandLine: cmd };
      }
    }
    else if (a === "--error" || a === "--err") {
      const err = argv[++i] || "";
      if (typeof rawPayload === "object" && rawPayload !== null) {
        (rawPayload as any).error = err;
      } else {
        rawPayload = { error: err };
      }
    }
    else if (a === "--payload" || a === "--data") {
      const data = argv[++i] || "";
      try {
        rawPayload = JSON.parse(data);
      } catch {
        rawPayload = data;
      }
    }
    else if (a === "--exit-code" || a === "--exitCode") {
      const code = parseInt(argv[++i] || "0", 10);
      if (typeof rawPayload === "object" && rawPayload !== null) {
        (rawPayload as any).exit_code = code;
      } else {
        rawPayload = { exit_code: code };
      }
    }
    else if (!a.startsWith("-") && !tool) tool = a;
  }

  if (!tool && mode !== "reset" && mode !== "status") {
    const stdinData = await readStdin();
    if (stdinData) {
      try {
        rawPayload = JSON.parse(stdinData);
        tool = extractToolName(rawPayload);
      } catch {
        // JSON truncado o inválido: nunca usarlo como nombre de herramienta
        if (stdinData.length < 120 && !/^[{[]/.test(stdinData)) tool = stdinData;
      }
    }
  }

  const breaker = new CircuitBreaker(customPath);

  if (mode === "reset") {
    breaker.reset();
    console.log(JSON.stringify({ allowed: true, decision: "allow", reason: "Circuit breaker counters successfully reset to zero.", stats: breaker.getState() }, null, 2));
    return 0;
  }
  if (mode === "status") {
    console.log(JSON.stringify({ allowed: true, decision: "allow", stats: breaker.getState() }, null, 2));
    return 0;
  }
  if (!tool) {
    // Sin herramienta identificable no hay nada que proteger: bloquear aquí rompería la Zero-Lockout Guarantee
    console.log(JSON.stringify({ allowed: true, decision: "allow", reason: "No tool name specified. Usage: circuit_breaker.ts --tool <tool_name> [--check-only | --fail | --success | --post-tool | --reset | --status]", stats: breaker.getState() }, null, 2));
    return 0;
  }

  if (mode === "post-tool" || mode === "record-failure" || mode === "record-success") {
    const isFail = mode === "record-failure" || (mode === "post-tool" && isToolFailurePayload(rawPayload));
    if (isFail) {
      breaker.recordFailure(tool);
      const chk = breaker.check(tool, rawPayload);
      const base = breaker.normalizeToolName(tool);
      const fails = breaker.getState().consecutive_failures[base] || 0;
      let reason = chk.reason || `Recorded failure for tool '${tool}'. Retries remaining.`;
      let autoHealRes: AutoHealResult | undefined;

      if (autoHealEnabled && (fails >= 2 || !chk.allowed)) {
        const errorText = extractErrorText(rawPayload);
        autoHealRes = breaker.autoHeal({
          tool,
          error: errorText,
          consecutiveFails: fails,
          breakerBlocked: !chk.allowed,
          breakerReason: chk.reason,
          skill: targetSkill,
          customPath: customHeuristicsPath,
        });
        if (autoHealRes.healed && autoHealRes.feedbackMessage) {
          reason = `${reason}\n${autoHealRes.feedbackMessage}`;
        }
      }

      const outObj: Record<string, any> = {
        allowed: chk.allowed,
        decision: chk.decision,
        reason,
        stats: breaker.getState(),
      };
      if (autoHealRes) {
        outObj.auto_heal = autoHealRes;
      }
      console.log(JSON.stringify(outObj, null, 2));
      return chk.allowed ? 0 : 1;
    }
    breaker.recordSuccess(tool, rawPayload);
    console.log(JSON.stringify({ allowed: true, decision: "allow", reason: `Recorded success for tool '${tool}'. Consecutive failures reset.`, stats: breaker.getState() }, null, 2));
    return 0;
  }

  const result = mode === "check-only" ? breaker.check(tool, rawPayload) : breaker.checkAndRecord(tool, rawPayload);
  if (autoHealEnabled && !result.allowed) {
    const errorText = extractErrorText(rawPayload);
    const autoHealRes = breaker.autoHeal({
      tool,
      error: errorText,
      consecutiveFails: result.stats.tool_consecutive_failures,
      breakerBlocked: true,
      breakerReason: result.reason,
      skill: targetSkill,
      customPath: customHeuristicsPath,
    });
    if (autoHealRes.healed && autoHealRes.feedbackMessage) {
      result.reason = `${result.reason}\n${autoHealRes.feedbackMessage}`;
    }
    result.auto_heal = autoHealRes;
  }
  console.log(JSON.stringify(result, null, 2));
  return result.allowed ? 0 : 1;
}

if (import.meta.main) {
  const exitCode = await runCLI(process.argv.slice(2));
  process.exit(exitCode);
}
