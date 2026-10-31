import { CircuitBreaker } from "../../../scripts/circuit_breaker";
import { pushNotice, resolveCounterPath, resolveWorkspaceRoot } from "../../../scripts/harness_io";
import { sanitizeToolArgs } from "./sanitizer";
import { TelemetryDB } from "./telemetry_db";

export interface PreToolUsePayload {
  toolCall?: {
    name?: string;
    args?: Record<string, any>;
  };
  stepIdx?: number;
  conversationId?: string;
  workspacePaths?: string[];
  [key: string]: any;
}

export interface PreToolUseResponse {
  decision: "allow" | "deny" | "ask" | "force_ask";
  reason?: string;
  overwrite?: Record<string, any>;
  permissionOverrides?: string[];
}

function recordDenial(
  breaker: CircuitBreaker,
  payload: PreToolUsePayload,
  toolName: string,
  args: Record<string, any>,
  reason: string,
  workspaceRoot: string,
  options?: { customTelemetryPath?: string }
): string {
  breaker.recordDenial(toolName, args);

  // Tras un "deny" agy no dispara PostToolUse: este es el único punto donde aprender del bloqueo
  const heal = breaker.autoHeal({ tool: toolName, breakerBlocked: true, breakerReason: reason, workspaceRoot });
  let telemetry: TelemetryDB | null = null;
  try {
    telemetry = new TelemetryDB(options?.customTelemetryPath);
    telemetry.recordToolExecution({
      conversationId: payload.conversationId,
      stepIdx: payload.stepIdx,
      toolName,
      isSuccess: false,
      errorMessage: reason,
    });
    telemetry.recordErrorSignature(toolName, reason);
  } catch (err: any) {
    pushNotice(workspaceRoot, `[HARNESS DEGRADED] Telemetría no disponible en PreToolUse: ${err?.message}`);
  } finally {
    telemetry?.close();
  }

  return heal.healed && heal.injectedRule ? `${reason}\n${heal.feedbackMessage}` : reason;
}

export function handlePreToolUse(
  payload: PreToolUsePayload,
  options?: { customCounterPath?: string; customTelemetryPath?: string }
): PreToolUseResponse {
  const toolName = payload.toolCall?.name || "";
  const rawArgs = payload.toolCall?.args || {};
  const workspaceRoot = resolveWorkspaceRoot(payload);
  const workspacePaths = payload.workspacePaths || [workspaceRoot];

  if (!toolName) {
    return { decision: "allow" };
  }

  // 1. In-flight Sanitization
  const sanitizeRes = sanitizeToolArgs(toolName, rawArgs, workspacePaths);

  // 2. Circuit Breaker V9 Verification
  const breaker = new CircuitBreaker(options?.customCounterPath || resolveCounterPath(workspaceRoot, payload.conversationId));
  const effectiveArgs = sanitizeRes.sanitized
    ? { ...rawArgs, ...sanitizeRes.overwrittenArgs }
    : rawArgs;

  const breakerCheck = breaker.check(toolName, effectiveArgs);

  // 3. Taxative Decision ("deny" on failure, never "block")
  if (!breakerCheck.allowed) {
    const reason = breakerCheck.reason || "CIRCUIT_BREAKER_BLOCKED: Tool execution denied by Harness³ Anti-Loop Policy.";
    return {
      decision: "deny",
      reason: recordDenial(breaker, payload, toolName, effectiveArgs, reason, workspaceRoot, options),
    };
  }

  // 4. Return Allow with Overwrite if arguments were modified
  const response: PreToolUseResponse = { decision: "allow" };
  if (sanitizeRes.sanitized && Object.keys(sanitizeRes.overwrittenArgs).length > 0) {
    response.overwrite = sanitizeRes.overwrittenArgs;
    breaker.markSanitized(payload.stepIdx);
  }

  return response;
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
      const payload: PreToolUsePayload = inputData.trim() ? JSON.parse(inputData) : {};
      const response = handlePreToolUse(payload);
      process.stdout.write(JSON.stringify(response));
      process.exit(0);
    } catch (err: any) {
      // Fallback seguro en caso de error de parseo: permitir sin romper el ciclo
      process.stdout.write(JSON.stringify({ decision: "allow", reason: `Fallback allow: ${err?.message}` }));
      process.exit(0);
    }
  });
}
