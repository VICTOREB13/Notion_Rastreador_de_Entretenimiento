import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { lintContracts } from "../../../../scripts/lint_contracts";
import { CircuitBreaker, MAX_TOOLS_WITHOUT_TESTS, type ToolCounterState } from "../../../scripts/circuit_breaker";
import { distillSession } from "../../../scripts/distill_session";
import { atomicWriteFileSync, pushNotice, resolveCounterPath, resolveWorkspaceRoot } from "../../../scripts/harness_io";
import { PromotionEngine } from "./promotion";
import { TelemetryDB } from "./telemetry_db";

export interface StopPayload {
  executionNum?: number;
  terminationReason?: string;
  error?: string;
  fullyIdle?: boolean;
  workspacePaths?: string[];
  conversationId?: string;
  transcriptPath?: string;
  [key: string]: any;
}

export interface StopResponse {
  decision: "allow" | "continue";
  reason?: string;
}

export interface StopGuardianOptions {
  customWorkspace?: string;
  customRetryStatePath?: string;
  customCounterPath?: string;
  customTelemetryPath?: string;
  maxRetries?: number;
}

/**
 * Cierra la medición de efectividad: una regla cuya herramienta se usó en esta conversación sin
 * que el fallo original reapareciera cuenta como éxito. Los fallos los registra PostToolUse.
 */
function creditSurvivingRules(breaker: CircuitBreaker, telemetry: TelemetryDB, workspaceRoot: string): void {
  const state = breaker.getState();
  for (const link of telemetry.getLinkedHeuristics(workspaceRoot)) {
    const toolUsed = (state.tool_counts[breaker.normalizeToolName(link.tool)] || 0) > 0;
    if (!toolUsed || state.rules_fired.includes(link.rule_key) || state.rules_credited.includes(link.rule_key)) continue;

    telemetry.recordHeuristicUsage({
      ruleId: link.rule_key,
      skill: link.skill,
      ruleText: link.rule_text,
      workspacePath: workspaceRoot,
      success: true,
    });
    breaker.noteRuleCredited(link.rule_key);
  }
}

/** Opción B automática: destila la sesión y evalúa la promoción al terminar cada turno. */
function finalizeTurn(payload: StopPayload, workspaceRoot: string, breaker: CircuitBreaker, options?: StopGuardianOptions): void {
  if (!payload.conversationId) return;

  try {
    if (payload.transcriptPath && existsSync(payload.transcriptPath)) {
      distillSession({ uuid: payload.conversationId, transcriptPath: payload.transcriptPath, workspacePath: workspaceRoot });
    }
  } catch (err: any) {
    pushNotice(workspaceRoot, `[HARNESS DEGRADED] distill_session falló: ${err?.message}`);
  }

  let telemetry: TelemetryDB | null = null;
  try {
    telemetry = new TelemetryDB(options?.customTelemetryPath);
    creditSurvivingRules(breaker, telemetry, workspaceRoot);
    new PromotionEngine(telemetry).evaluateAndPromote();
  } catch (err: any) {
    pushNotice(workspaceRoot, `[HARNESS DEGRADED] Evaluación de heurísticas falló: ${err?.message}`);
  } finally {
    telemetry?.close();
  }
}

function collectIssues(state: ToolCounterState, workspaceRoot: string): string[] {
  const issues: string[] = [];

  // Verificación de Quality Gate: Contratos SDD
  const specPath = resolve(workspaceRoot, "artifacts", "architecture", "api_spec.md");
  if (existsSync(specPath)) {
    try {
      const sddRes = lintContracts({
        specFile: specPath,
        srcDirs: [resolve(workspaceRoot, "src")],
        allowMissing: false,
      });

      if (!sddRes.valid) {
        if (sddRes.missing.length > 0) {
          issues.push(`Contratos SDD pendientes sin implementar: ${sddRes.missing.join(", ")}`);
        }
        if (sddRes.orphans.length > 0) {
          issues.push(`Endpoints en código huérfanos sin contrato en spec: ${sddRes.orphans.join(", ")}`);
        }
      }
    } catch {}
  }

  // Verificación de Presupuesto TDD y del último resultado real de la suite
  if (state.tools_since_last_test_runner >= MAX_TOOLS_WITHOUT_TESTS && state.edits_since_last_test > 0) {
    issues.push(
      `Presupuesto TDD agotado (${state.tools_since_last_test_runner} herramientas ejecutadas sin correr tests unitarios). Ejecute 'bun test' para validar la suite.`
    );
  } else if (state.last_test_passed === false) {
    issues.push("La última ejecución de la suite de pruebas falló. Corrija los tests antes de finalizar.");
  } else if (state.last_test_passed === null) {
    issues.push("Se editó código en esta sesión sin ejecutar ninguna suite de pruebas.");
  }

  return issues;
}

export function handleStop(payload: StopPayload, options?: StopGuardianOptions): StopResponse {
  // Solo interceptamos cuando el agente intenta finalizar normalmente (NO_TOOL_CALL) y está ocioso
  const reason = payload.terminationReason || "";
  const fullyIdle = payload.fullyIdle !== false;

  if (reason !== "NO_TOOL_CALL" || !fullyIdle) {
    return { decision: "allow" };
  }

  const workspaceRoot = options?.customWorkspace || resolveWorkspaceRoot(payload);
  const retryFile = payload.conversationId
    ? `stop_guardian_${payload.conversationId.replace(/[^\w.-]/g, "_")}.json`
    : "stop_guardian_state.json";
  const retryPath = resolve(options?.customRetryStatePath || join(workspaceRoot, "_workspace", retryFile));
  const maxRetries = options?.maxRetries ?? 2;
  const breaker = new CircuitBreaker(options?.customCounterPath || resolveCounterPath(workspaceRoot, payload.conversationId));
  const clearRetries = () => {
    try {
      if (existsSync(retryPath)) unlinkSync(retryPath);
    } catch {}
  };

  // 1. Cargar estado de reintentos del guardián
  let retryCount = 0;
  try {
    if (existsSync(retryPath)) {
      const data = JSON.parse(readFileSync(retryPath, "utf-8"));
      retryCount = typeof data.retryCount === "number" ? data.retryCount : 0;
    }
  } catch {}

  // 2. Anti-Loop: Si ya se forzó la continuación 2 veces, permitir parada para no bloquear al usuario
  if (retryCount >= maxRetries) {
    clearRetries();
    pushNotice(workspaceRoot, `[HARNESS QUALITY GATE] La sesión anterior terminó con verificaciones pendientes tras ${maxRetries} reintentos. Revíselas antes de continuar.`);
    finalizeTurn(payload, workspaceRoot, breaker, options);
    return {
      decision: "allow",
      reason: `[Harness³ Stop Guardian] Se alcanzó el límite de ${maxRetries} reintentos. Terminación permitida.`,
    };
  }

  // 3. Solo hay algo que verificar si la sesión tocó código: responder una pregunta no pasa por el gate
  const state = breaker.getState();
  const issues = state.edits_total > 0 ? collectIssues(state, workspaceRoot) : [];

  // 4. Decisión del Guardián
  if (issues.length > 0) {
    const nextRetry = retryCount + 1;
    try {
      atomicWriteFileSync(retryPath, JSON.stringify({ retryCount: nextRetry, lastIssues: issues, timestamp: new Date().toISOString() }));
    } catch {}

    return {
      decision: "continue",
      reason: `[HARNESS³ QUALITY GATE GUARDIAN] Se detectaron verificaciones de calidad pendientes antes de concluir (Reintento ${nextRetry}/${maxRetries}):\n` +
        issues.map((i) => ` - ${i}`).join("\n") +
        "\nPor favor aplique el ciclo SDD + TDD para resolver estos pendientes antes de finalizar.",
    };
  }

  // Si todo está en orden, limpiar archivo de reintentos y permitir finalizar
  clearRetries();
  finalizeTurn(payload, workspaceRoot, breaker, options);

  return { decision: "allow" };
}

// CLI Execution Entry Point for Antigravity Hooks
if (import.meta.main) {
  let inputData = "";
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", (chunk) => {
    inputData += chunk;
  });

  process.stdin.on("end", () => {
    try {
      const payload: StopPayload = inputData.trim() ? JSON.parse(inputData) : {};
      const res = handleStop(payload);
      process.stdout.write(JSON.stringify(res));
    } catch {
      process.stdout.write(JSON.stringify({ decision: "allow" }));
    }
    process.exit(0);
  });
}
