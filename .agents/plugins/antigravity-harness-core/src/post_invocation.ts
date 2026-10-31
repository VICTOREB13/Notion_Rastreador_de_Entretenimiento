import { closeSync, existsSync, fstatSync, openSync, readSync } from "node:fs";
import { BACKGROUND_FAILURE_REGEX, CircuitBreaker, commandFamily } from "../../../scripts/circuit_breaker";
import { resolveCounterPath, resolveWorkspaceRoot } from "../../../scripts/harness_io";
import { resolveToolOutcome, type OutcomeOptions } from "./post_tool_use";

export interface PostInvocationPayload {
  conversationId?: string;
  workspacePaths?: string[];
  transcriptPath?: string;
  [key: string]: any;
}

export interface StepOutcome {
  failed: boolean;
  errorText: string;
}

const TAIL_BYTES = 4 * 1024 * 1024;
const MAX_ERROR_CHARS = 1500;
// Un comando en segundo plano puede tardar varias invocaciones en dejar evidencia en su log.
const MAX_RECONCILE_ATTEMPTS = 6;
const TASK_LOG_REGEX = /Task logs are available at:\s*file:\/\/\/?(\S+?\.log)/i;
const PASSING_SUMMARY_REGEX = /\b0 fail\b|\b\d+ passed\b/i;

// exit 1 significa "sin coincidencias" o "hay diferencias", no un fallo.
const BENIGN_EXIT_1 = new Set(["grep", "rg", "findstr", "diff", "fc", "cmp", "test"]);

function readTail(filePath: string): string {
  const fd = openSync(filePath, "r");
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer.toString("utf-8");
  } finally {
    closeSync(fd);
  }
}

/**
 * agy manda a segundo plano los comandos que tardan: el paso queda en RUNNING para siempre, sin
 * exit code, y la salida va a un log aparte. Sin evidencia clara no se afirma éxito ni fallo.
 */
function readBackgroundOutcome(content: string): StepOutcome | null {
  const match = content.match(TASK_LOG_REGEX);
  if (!match) return null;

  let logPath = match[1];
  try { logPath = decodeURI(logPath); } catch {}
  if (!/^[a-zA-Z]:/.test(logPath)) logPath = `/${logPath}`;
  if (!existsSync(logPath)) return null;

  const log = readTail(logPath);
  if (BACKGROUND_FAILURE_REGEX.test(log)) return { failed: true, errorText: log.trim().slice(0, MAX_ERROR_CHARS) };
  return PASSING_SUMMARY_REGEX.test(log) ? { failed: false, errorText: "" } : null;
}

/** Interpreta un paso del transcript real de agy, donde vive el exit code de los comandos. */
export function parseStepOutcome(step: any, commandLine = ""): StepOutcome | null {
  const content = typeof step.content === "string" ? step.content : "";
  if (step.status === "RUNNING") return readBackgroundOutcome(content);

  const errorField = typeof step.error === "string" ? step.error : "";
  if (step.status === "ERROR") return { failed: true, errorText: (errorField || content).slice(0, MAX_ERROR_CHARS) };

  const exit = content.match(/command exited with code (\d+)/i);
  if (!exit) return { failed: false, errorText: "" };

  const code = Number(exit[1]);
  const benign = code === 1 && BENIGN_EXIT_1.has(commandFamily(commandLine).split(" ")[0]);
  if (code === 0 || benign) return { failed: false, errorText: "" };

  const output = content.slice(content.indexOf(exit[0]) + exit[0].length).replace(/^\.?\s*(?:Output:\s*)?/i, "").trim();
  return { failed: true, errorText: `exit ${code}: ${output}`.slice(0, MAX_ERROR_CHARS) };
}

export function readStepOutcomes(transcriptPath: string | undefined, pending: Array<{ stepIdx: number; args?: Record<string, any> }>): Map<number, StepOutcome> {
  const outcomes = new Map<number, StepOutcome>();
  if (!transcriptPath || pending.length === 0 || !existsSync(transcriptPath)) return outcomes;

  const commandByStep = new Map(pending.map((p) => [p.stepIdx, String(p.args?.CommandLine ?? "")]));
  for (const line of readTail(transcriptPath).split(/\r?\n/)) {
    if (!line.includes("step_index")) continue;
    try {
      const step = JSON.parse(line);
      if (!commandByStep.has(step.step_index)) continue;
      const outcome = parseStepOutcome(step, commandByStep.get(step.step_index));
      if (outcome) outcomes.set(step.step_index, outcome);
    } catch {}
  }
  return outcomes;
}

/** Reconcilia los comandos cuyo resultado no llegó a PostToolUse. */
export function handlePostInvocation(
  payload: PostInvocationPayload,
  options?: OutcomeOptions & { customCounterPath?: string }
): Record<string, any> {
  const workspaceRoot = resolveWorkspaceRoot(payload);
  const breaker = new CircuitBreaker(options?.customCounterPath || resolveCounterPath(workspaceRoot, payload.conversationId));
  const pending = breaker.takePendingOutcomes();
  if (pending.length === 0) return { injectSteps: [] };

  const outcomes = readStepOutcomes(payload.transcriptPath, pending);

  for (const item of pending) {
    const outcome = outcomes.get(item.stepIdx);

    // Sin resultado todavía: reintentar y, agotado el margen, descartarlo sin contarlo como éxito
    if (!outcome) {
      if (item.attempts + 1 < MAX_RECONCILE_ATTEMPTS) breaker.requeuePendingOutcome({ ...item, attempts: item.attempts + 1 });
      continue;
    }

    resolveToolOutcome(
      breaker,
      {
        toolName: item.tool,
        args: item.args,
        failed: outcome.failed,
        errorText: outcome.errorText,
        stepIdx: item.stepIdx,
        conversationId: payload.conversationId,
        workspaceRoot,
      },
      options
    );
  }

  breaker.saveState();
  return { injectSteps: [] };
}

if (import.meta.main) {
  let inputData = "";
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", (chunk) => {
    inputData += chunk;
  });

  process.stdin.on("end", () => {
    try {
      handlePostInvocation(inputData.trim() ? JSON.parse(inputData) : {});
    } catch {}
    process.stdout.write(JSON.stringify({ injectSteps: [] }));
    process.exit(0);
  });
}
