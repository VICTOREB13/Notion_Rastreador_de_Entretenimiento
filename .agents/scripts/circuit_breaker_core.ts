import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { autoHealFromFailure, type AutoHealResult } from "../../scripts/verify_recursive_loop";
import {
  DEFAULT_COUNTER_PATH,
  extractToolName,
  IMMUTABLE_WHITELIST,
  isTestRunner,
  MAX_CONSECUTIVE_FAILURES,
  MAX_CONSECUTIVE_READS,
  MAX_HISTORY_LENGTH,
  MAX_TOOLS_WITHOUT_TESTS,
  READ_TOOLS,
  RESET_READ_STREAK_TOOLS,
  type CircuitBreakerResult,
  type ToolCounterState,
  type ToolHistoryEntry,
} from "./circuit_breaker_types";

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
      consecutive_failures: {},
      tool_counts: {},
      tool_failures: {},
      last_tool: null,
      history: [],
      last_updated: new Date().toISOString(),
    };
  }

  private loadState(): ToolCounterState {
    try {
      if (existsSync(this.filePath)) {
        const p = JSON.parse(readFileSync(this.filePath, "utf-8")), obj = (v: any) => v && typeof v === "object" ? v : {};
        return {
          consecutive_reads: typeof p.consecutive_reads === "number" ? p.consecutive_reads : 0,
          tools_since_last_test_runner: typeof p.tools_since_last_test_runner === "number" ? p.tools_since_last_test_runner : 0,
          consecutive_failures: obj(p.consecutive_failures),
          tool_counts: obj(p.tool_counts),
          tool_failures: obj(p.tool_failures),
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
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      this.state.last_updated = new Date().toISOString();
      if (this.state.history.length > MAX_HISTORY_LENGTH) this.state.history = this.state.history.slice(-MAX_HISTORY_LENGTH);
      writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), "utf-8");
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
    return t;
  }

  private inSet(tool: unknown, s: Set<string>): boolean {
    return s.has(extractToolName(tool).trim().toLowerCase()) || s.has(this.normalizeToolName(tool));
  }

  public isWhitelisted(tool: unknown): boolean { return this.inSet(tool, IMMUTABLE_WHITELIST); }
  public isReadTool(tool: unknown): boolean { return this.inSet(tool, READ_TOOLS); }
  public isStreakBreaker(tool: unknown): boolean { return this.inSet(tool, RESET_READ_STREAK_TOOLS); }

  public check(tool: unknown, payload?: unknown): CircuitBreakerResult {
    const raw = extractToolName(tool).trim().toLowerCase(), base = this.normalizeToolName(raw);
    const consecutiveFailures = (base ? this.state.consecutive_failures[base] : 0) ?? (raw ? this.state.consecutive_failures[raw] : 0) ?? 0;
    const totalCalls = (base ? this.state.tool_counts[base] : 0) ?? (raw ? this.state.tool_counts[raw] : 0) ?? 0;
    const baseStats = {
      consecutive_reads: this.state.consecutive_reads,
      tools_since_last_test_runner: this.state.tools_since_last_test_runner,
      tool_consecutive_failures: consecutiveFailures,
      total_calls_for_tool: totalCalls,
      last_tool: this.state.last_tool,
    };

    // 1. Immutable Whitelist tools are ALWAYS allowed under any condition
    if (this.isWhitelisted(raw)) return { allowed: true, decision: "allow", stats: baseStats };

    // 2. Test runners are ALWAYS allowed to run (so the agent can fulfill TDD)
    if (isTestRunner(tool, payload)) return { allowed: true, decision: "allow", stats: baseStats };

    // 3. Consecutive failures threshold (Anti-loop max 3 retries)
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      return {
        allowed: false,
        decision: "block",
        stats: baseStats,
        reason: `CIRCUIT_BREAKER_BLOCKED: La herramienta '${base}' ha fallado ${consecutiveFailures} veces consecutivas. Se activa el Protocolo Anti-Loop (AGENTS.md Sección 7). Se requiere PAUSA OBLIGATORIA y diagnóstico de causa raíz (Code Defect vs Harness Defect) antes de reintentar.`,
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

    // 5. In-Flight TDD Enforcer threshold (>14 tools without test runner)
    if (this.state.tools_since_last_test_runner >= MAX_TOOLS_WITHOUT_TESTS) {
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
    } else {
      this.state.tools_since_last_test_runner = (this.state.tools_since_last_test_runner || 0) + 1;
    }

    this.state.tool_counts[base] = (this.state.tool_counts[base] || 0) + 1;
    this.state.last_tool = base;
    this.pushHistory(base, "invoked");
  }

  public recordFailure(tool: unknown): void {
    const raw = extractToolName(tool).trim().toLowerCase(), base = this.normalizeToolName(raw);
    if (!base) return;
    this.state.consecutive_failures[base] = (this.state.consecutive_failures[base] || 0) + 1;
    this.state.tool_failures[base] = (this.state.tool_failures[base] || 0) + 1;
    this.pushHistory(base, "failure");
  }

  public recordSuccess(tool: unknown, payload?: unknown): void {
    const raw = extractToolName(tool).trim().toLowerCase(), base = this.normalizeToolName(raw);
    if (!base) return;
    this.state.consecutive_failures[base] = 0;
    if (isTestRunner(tool, payload)) {
      this.state.tools_since_last_test_runner = 0;
    }
    this.pushHistory(base, "success");
  }

  public checkAndRecord(tool: unknown, payload?: unknown): CircuitBreakerResult {
    const result = this.check(tool, payload);
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
    });
  }
}
