import type { AutoHealResult } from "../../scripts/verify_recursive_loop";
import { CircuitBreaker } from "./circuit_breaker_core";
import {
  extractToolName,
  isToolFailurePayload,
} from "./circuit_breaker_types";

export * from "./circuit_breaker_types";
export * from "./circuit_breaker_core";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  return new Promise((res) => {
    const finish = () => res(chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8").trim() : "");
    const timer = setTimeout(finish, 400);
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
        tool = stdinData;
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
    console.log(JSON.stringify({ allowed: false, decision: "block", reason: "No tool name specified. Usage: circuit_breaker.ts --tool <tool_name> [--check-only | --fail | --success | --post-tool | --reset | --status]", stats: breaker.getState() }, null, 2));
    return 1;
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
        const errorText = typeof rawPayload === "object" && rawPayload !== null
          ? JSON.stringify(rawPayload)
          : String(rawPayload || "");
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
    const errorText = typeof rawPayload === "object" && rawPayload !== null
      ? JSON.stringify(rawPayload)
      : String(rawPayload || "");
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
