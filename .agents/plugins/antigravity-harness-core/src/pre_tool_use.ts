import { CircuitBreaker } from "../../../scripts/circuit_breaker";
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

export function handlePreToolUse(
  payload: PreToolUsePayload,
  options?: { customCounterPath?: string; customTelemetryPath?: string }
): PreToolUseResponse {
  const toolName = payload.toolCall?.name || "";
  const rawArgs = payload.toolCall?.args || {};
  const workspacePaths = payload.workspacePaths || [];

  if (!toolName) {
    return { decision: "allow" };
  }

  // 1. In-flight Sanitization
  const sanitizeRes = sanitizeToolArgs(toolName, rawArgs, workspacePaths);

  // 2. Circuit Breaker V9 Verification
  const breaker = new CircuitBreaker(options?.customCounterPath);
  const effectiveArgs = sanitizeRes.sanitized
    ? { ...rawArgs, ...sanitizeRes.overwrittenArgs }
    : rawArgs;

  const breakerCheck = breaker.check(toolName, effectiveArgs);

  // 3. Taxative Decision ("deny" on failure, never "block")
  if (!breakerCheck.allowed) {
    return {
      decision: "deny",
      reason: breakerCheck.reason || "CIRCUIT_BREAKER_BLOCKED: Tool execution denied by Harness³ Anti-Loop Policy.",
    };
  }

  // 4. Return Allow with Overwrite if arguments were modified
  const response: PreToolUseResponse = { decision: "allow" };
  if (sanitizeRes.sanitized && Object.keys(sanitizeRes.overwrittenArgs).length > 0) {
    response.overwrite = sanitizeRes.overwrittenArgs;
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
