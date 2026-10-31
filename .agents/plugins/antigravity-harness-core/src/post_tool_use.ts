import { CircuitBreaker, isTestRunner, isToolFailurePayload, extractErrorText, MAX_CONSECUTIVE_FAILURES } from "../../../scripts/circuit_breaker";
import { pushNotice, resolveCounterPath, resolveWorkspaceRoot } from "../../../scripts/harness_io";
import { TelemetryDB } from "./telemetry_db";

export interface PostToolUsePayload {
  toolCall?: {
    name?: string;
    args?: Record<string, any>;
  };
  stepIdx?: number;
  error?: string;
  conversationId?: string;
  workspacePaths?: string[];
  transcriptPath?: string;
  [key: string]: any;
}

export interface ToolOutcome {
  toolName: string;
  args?: Record<string, any>;
  failed: boolean;
  errorText: string;
  stepIdx?: number;
  conversationId?: string;
  workspaceRoot: string;
}

export interface OutcomeOptions {
  customTelemetryPath?: string;
}

// agy entrega estas herramientas con error: "" aunque el proceso termine con exit != 0:
// el resultado real solo existe en el transcript, y se escribe después de PostToolUse.
const COMMAND_TOOLS = new Set(["run_command"]);

function persistTelemetry(
  outcome: ToolOutcome,
  sanitized: boolean,
  heal: ReturnType<CircuitBreaker["autoHeal"]> | null,
  options?: OutcomeOptions
): void {
  let telemetry: TelemetryDB | null = null;
  try {
    telemetry = new TelemetryDB(options?.customTelemetryPath);
    telemetry.recordToolExecution({
      conversationId: outcome.conversationId,
      stepIdx: outcome.stepIdx,
      toolName: outcome.toolName,
      isSuccess: !outcome.failed,
      errorMessage: outcome.failed ? outcome.errorText : undefined,
      sanitized,
    });
    if (outcome.failed) telemetry.recordErrorSignature(outcome.toolName, outcome.errorText);

    if (heal?.ruleKey && heal.ruleText) {
      telemetry.linkHeuristic({
        ruleKey: heal.ruleKey,
        skill: heal.skill,
        ruleText: heal.ruleText,
        tool: outcome.toolName,
        workspacePath: outcome.workspaceRoot,
      });
      // El mismo fallo reapareció con la regla activa: la regla no lo evitó
      if (heal.alreadyPresent) {
        telemetry.recordHeuristicUsage({
          ruleId: heal.ruleKey,
          skill: heal.skill,
          ruleText: heal.ruleText,
          workspacePath: outcome.workspaceRoot,
          success: false,
        });
      }
    }
  } catch (err: any) {
    pushNotice(outcome.workspaceRoot, `[HARNESS DEGRADED] Telemetría no disponible: ${err?.message}`);
  } finally {
    telemetry?.close();
  }
}

/**
 * Punto único de registro del resultado de una herramienta. El breaker y el auto-heal van
 * antes que la telemetría: un SQLite bloqueado no puede costar el contador ni la regla.
 */
export function resolveToolOutcome(breaker: CircuitBreaker, outcome: ToolOutcome, options?: OutcomeOptions): void {
  const { toolName, args, failed, errorText, stepIdx, workspaceRoot } = outcome;
  const sanitized = typeof stepIdx === "number" && breaker.getState().last_sanitized_step === stepIdx;
  let heal: ReturnType<CircuitBreaker["autoHeal"]> | null = null;

  if (isTestRunner(toolName, args)) {
    // Un test rojo es normal en TDD (Red): resetea el presupuesto y no cuenta como fallo de la
    // herramienta, pero se acumula aparte para que el anti-loop vea los ciclos de pruebas fallidas
    breaker.recordSuccess(toolName, args);
    breaker.recordTestResult(!failed);
    const failures = breaker.getState().consecutive_test_failures;
    if (failed && failures >= MAX_CONSECUTIVE_FAILURES) {
      pushNotice(workspaceRoot, `[HARNESS ANTI-LOOP] La suite de pruebas lleva ${failures} fallos consecutivos. PAUSA OBLIGATORIA: diagnostique la causa raíz (Código vs. Arnés) antes de aplicar otro parche.`);
    }
  } else if (failed) {
    breaker.recordFailure(toolName, args);
    const fails = breaker.failureCount(toolName, args);

    // Auto-heal silencioso ante fallos repetitivos (≥ 2 fallos consecutivos)
    if (fails >= 2) {
      heal = breaker.autoHeal({ tool: toolName, error: errorText, consecutiveFails: fails, workspaceRoot });
      if (heal.healed && heal.injectedRule) pushNotice(workspaceRoot, heal.feedbackMessage);
      if (heal.ruleKey) breaker.noteRuleFired(heal.ruleKey);
    }
  } else {
    breaker.recordSuccess(toolName, args);
  }

  persistTelemetry(outcome, sanitized, heal, options);
}

export function handlePostToolUse(
  payload: PostToolUsePayload,
  options?: { customCounterPath?: string; customTelemetryPath?: string }
): Record<string, any> {
  const toolName = payload.toolCall?.name || "";
  if (!toolName) return {};

  const args = payload.toolCall?.args;
  const workspaceRoot = resolveWorkspaceRoot(payload);
  const breaker = new CircuitBreaker(options?.customCounterPath || resolveCounterPath(workspaceRoot, payload.conversationId));
  const explicitFailure = Boolean(payload.error) || isToolFailurePayload(payload);

  breaker.recordInvocation(toolName, args);

  const awaitsTranscript = !explicitFailure &&
    COMMAND_TOOLS.has(breaker.normalizeToolName(toolName)) &&
    typeof payload.stepIdx === "number" &&
    Boolean(payload.transcriptPath);

  if (awaitsTranscript) {
    breaker.addPendingOutcome(payload.stepIdx!, toolName, args);
    return {};
  }

  resolveToolOutcome(
    breaker,
    {
      toolName,
      args,
      failed: explicitFailure,
      errorText: extractErrorText(payload) || "Unknown tool failure",
      stepIdx: payload.stepIdx,
      conversationId: payload.conversationId,
      workspaceRoot,
    },
    options
  );

  // Antigravity CLI PostToolUse contract expects an empty JSON object {}
  return {};
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
      const payload: PostToolUsePayload = inputData.trim() ? JSON.parse(inputData) : {};
      handlePostToolUse(payload);
    } catch {}
    process.stdout.write(JSON.stringify({}));
    process.exit(0);
  });
}
