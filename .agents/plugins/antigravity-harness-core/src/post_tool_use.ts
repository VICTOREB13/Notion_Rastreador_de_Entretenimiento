import { CircuitBreaker, isTestRunner, isToolFailurePayload } from "../../../scripts/circuit_breaker";
import { autoHealFromFailure } from "../../../../scripts/verify_recursive_loop";
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
  [key: string]: any;
}

export function handlePostToolUse(
  payload: PostToolUsePayload,
  options?: { customCounterPath?: string; customTelemetryPath?: string }
): Record<string, any> {
  const toolName = payload.toolCall?.name || "";
  const error = payload.error;
  const isFailure = Boolean(error) || isToolFailurePayload(payload);
  const breaker = new CircuitBreaker(options?.customCounterPath);
  const telemetry = new TelemetryDB(options?.customTelemetryPath);

  try {
    if (toolName) {
      const isTest = isTestRunner(toolName, payload.toolCall?.args);

      if (isTest) {
        // En TDD (Fase Red -> Green), la ejecución del runner de pruebas siempre resetea el contador
        // de TDD, independientemente de si los tests unitarios pasaron o fallaron (comportamiento normal en Red)
        breaker.recordInvocation(toolName, payload.toolCall?.args);
        breaker.recordSuccess(toolName, payload.toolCall?.args);

        telemetry.recordToolExecution({
          conversationId: payload.conversationId,
          stepIdx: payload.stepIdx,
          toolName,
          isSuccess: !isFailure,
          errorMessage: isFailure ? (typeof error === "string" ? error : "Test runner reported unit test failures") : undefined,
        });
      } else if (isFailure) {
        breaker.recordInvocation(toolName, payload.toolCall?.args);
        const errorMsg = typeof error === "string" ? error : JSON.stringify(error || "Unknown tool failure");
        breaker.recordFailure(toolName);

        // Registro de telemetría de fallos
        telemetry.recordToolExecution({
          conversationId: payload.conversationId,
          stepIdx: payload.stepIdx,
          toolName,
          isSuccess: false,
          errorMessage: errorMsg,
        });

        telemetry.recordErrorSignature(toolName, errorMsg);

        // Auto-heal silencioso ante fallos repetitivos (≥ 2 fallos consecutivos)
        const state = breaker.getState();
        const baseTool = breaker.normalizeToolName(toolName);
        const fails = state.consecutive_failures[baseTool] || state.consecutive_failures[toolName] || 0;

        if (fails >= 2) {
          autoHealFromFailure({
            tool: toolName,
            error: errorMsg,
            consecutiveFails: fails,
          });
        }
      } else {
        breaker.recordInvocation(toolName, payload.toolCall?.args);
        breaker.recordSuccess(toolName, payload.toolCall?.args);

        // Registro de telemetría de éxitos
        telemetry.recordToolExecution({
          conversationId: payload.conversationId,
          stepIdx: payload.stepIdx,
          toolName,
          isSuccess: true,
        });
      }
    }
  } catch (err) {
    // Failsafe: nunca lanzar excepción que rompa el loop del agente
  } finally {
    telemetry.close();
  }

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
