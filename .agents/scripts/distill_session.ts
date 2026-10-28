#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export interface DistillOptions {
  uuid?: string;
  transcriptPath?: string;
  workspacePath?: string;
  dbPath?: string;
  outputPath?: string;
  outputJson?: boolean;
}

export interface RepetitiveLoop { tool: string; count: number; }

export interface SessionMetrics {
  conversation_id: string; transcript_path: string; total_steps: number; user_turns: number; model_turns: number;
  steps_by_source: Record<string, number>; steps_by_type: Record<string, number>;
  tool_counts: Record<string, number>; tool_failures: Record<string, number>;
  total_tool_calls: number; total_tool_failures: number; max_read_streak: number;
  read_streaks_above_limit: number; repetitive_loops: RepetitiveLoop[];
  circuit_breaker_blocks: number; anti_loop_triggers: number;
  auto_heals_triggered: number;
  root_cause_signal: "Defecto de Arnés" | "Defecto de Código" | "Ejecución Limpia";
  auditor_directive: string;
}

export const READ_TOOLS = new Set<string>(["read_file", "view_file", "read_resource", "read_url_content"]);
export const RESET_READ_STREAK_TOOLS = new Set<string>([
  "grep_search", "find_by_name", "list_dir", "search_web", "run_command",
  "write_file", "edit_file", "write_to_file", "replace_file_content", "generate_image",
]);

const getHome = () => process.env.USERPROFILE || process.env.HOME || "";
export const getDefaultDbPath = (): string => resolve(getHome(), ".gemini", "antigravity-cli", "conversation_summaries.db");
export const getTranscriptPathForUUID = (uuid: string): string => resolve(getHome(), ".gemini", "antigravity-cli", "brain", uuid, ".system_generated", "logs", "transcript.jsonl");

function normalizePath(p: string): string {
  try { p = decodeURIComponent(p); } catch {}
  return p.replace(/\\/g, "/").toLowerCase().replace(/^file:\/\/\/?/, "").replace(/\/+$/, "");
}

export function resolveLatestConversation(dbPath: string, workspacePath: string): string | null {
  if (!existsSync(dbPath)) return null;
  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    db.run("PRAGMA busy_timeout = 5000;");
    const stmt = db.prepare("SELECT conversation_id, workspace_uris FROM conversation_summaries ORDER BY last_modified_time DESC");
    const rows = stmt.all() as Array<{ conversation_id: string; workspace_uris: string }>;
    stmt.finalize();
    if (!rows?.length) return null;
    const target = normalizePath(workspacePath);
    const matched = rows.find(r => r.workspace_uris && normalizePath(r.workspace_uris).includes(target));
    return (matched || rows[0]).conversation_id;
  } catch { return null; } finally { try { db?.close(); } catch {} }
}

export function parseTranscriptContent(content: string, conversationId = "unknown", transcriptPath = ""): SessionMetrics {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const metrics: SessionMetrics = {
    conversation_id: conversationId, transcript_path: transcriptPath, total_steps: 0, user_turns: 0, model_turns: 0,
    steps_by_source: {}, steps_by_type: {}, tool_counts: {}, tool_failures: {}, total_tool_calls: 0, total_tool_failures: 0,
    max_read_streak: 0, read_streaks_above_limit: 0, repetitive_loops: [], circuit_breaker_blocks: 0, anti_loop_triggers: 0,
    auto_heals_triggered: 0,
    root_cause_signal: "Ejecución Limpia", auditor_directive: "El historial de ejecución no presenta fricción anómala. Proceder con Quality Gate regular.",
  };

  let currentReadStreak = 0, lastKey = "", lastRep = 0, currentLoop: RepetitiveLoop | null = null;
  const queue: string[] = [];
  let lastTool: string | null = null;
  const consecutiveFails: Record<string, number> = {};

  for (const rawLine of lines) {
    let step: any;
    try { step = JSON.parse(rawLine); } catch { continue; }
    metrics.total_steps++;
    const src = String(step.source || "UNKNOWN"), typ = String(step.type || "UNKNOWN");
    metrics.steps_by_source[src] = (metrics.steps_by_source[src] || 0) + 1;
    metrics.steps_by_type[typ] = (metrics.steps_by_type[typ] || 0) + 1;
    if (typ === "USER_INPUT" || src.startsWith("USER")) metrics.user_turns++;
    if (typ === "PLANNER_RESPONSE" || src === "MODEL") metrics.model_turns++;

    const rawCalls = Array.isArray(step.tool_calls) ? step.tool_calls : (step.tool_call ? [step.tool_call] : (step.toolCall ? [step.toolCall] : []));
    const toolCalls = rawCalls.filter((c: any) => c && typeof c.name === "string");

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        const name = call.name.trim();
        metrics.total_tool_calls++;
        metrics.tool_counts[name] = (metrics.tool_counts[name] || 0) + 1;
        queue.push(name);
        lastTool = name;

        if (READ_TOOLS.has(name)) {
          currentReadStreak++;
          if (currentReadStreak > metrics.max_read_streak) metrics.max_read_streak = currentReadStreak;
          if (currentReadStreak > 12) metrics.read_streaks_above_limit++;
        } else if (RESET_READ_STREAK_TOOLS.has(name)) {
          currentReadStreak = 0;
        }

        const callKey = `${name}:${JSON.stringify(call.args || {})}`;
        if (callKey === lastKey) {
          lastRep++;
          if (lastRep === 3) { currentLoop = { tool: name, count: 3 }; metrics.repetitive_loops.push(currentLoop); }
          else if (lastRep > 3 && currentLoop) currentLoop.count = lastRep;
        } else {
          lastKey = callKey; lastRep = 1; currentLoop = null;
        }
      }
      continue;
    }

    const targetTool = queue.length > 0 ? queue.shift()! : lastTool;
    const text = typeof step.content === "string" ? step.content : "";
    let isFailure = false;

    const hasBreaker = text.includes('"decision":"block"') || text.includes('"decision": "block"') ||
      text.includes('"allowed":false') || text.includes('"allowed": false') ||
      /^\s*CIRCUIT_BREAKER_BLOCKED:/m.test(text) || (src === "SYSTEM" && text.includes("CIRCUIT_BREAKER_BLOCKED"));
    const isNormalRead = targetTool && READ_TOOLS.has(targetTool) && step.status === "DONE" && src !== "SYSTEM" && !text.includes("Encountered error in step execution:");

    if (hasBreaker && !isNormalRead) {
      isFailure = true;
      metrics.circuit_breaker_blocks++;
    }

    if (!isFailure) {
      if (step.status === "ERROR" || step.status === "INVALID") isFailure = true;
      else if (step.tool_call_result?.is_error === true || Boolean(step.tool_call_result?.error)) isFailure = true;
      else if (text.includes("Encountered error in step execution:") || text.includes("Error invalid tool call:")) isFailure = true;
      else if (/Command exited with code [1-9]/i.test(text)) isFailure = true;
      else if (!/Command exited with code 0/i.test(text) && targetTool && !READ_TOOLS.has(targetTool)) {
        if (/^\[ERROR\]/im.test(text) || /^error:\s+/im.test(text)) isFailure = true;
      }
    }

    if (text.includes("[HARNESS AUTO-HEAL]")) {
      metrics.auto_heals_triggered++;
    }

    if (targetTool) {
      if (isFailure) {
        metrics.total_tool_failures++;
        metrics.tool_failures[targetTool] = (metrics.tool_failures[targetTool] || 0) + 1;
        consecutiveFails[targetTool] = (consecutiveFails[targetTool] || 0) + 1;
        if (consecutiveFails[targetTool] >= 2) metrics.anti_loop_triggers++;
      } else if (step.status === "DONE" || text.length > 0) {
        consecutiveFails[targetTool] = 0;
      }
    }
  }

  if (metrics.circuit_breaker_blocks > 0 || metrics.anti_loop_triggers > 0 || metrics.read_streaks_above_limit > 0 || metrics.repetitive_loops.length > 0) {
    metrics.root_cause_signal = "Defecto de Arnés";
    metrics.auditor_directive = metrics.auto_heals_triggered > 0
      ? "Fricción de arnés interceptada y auto-sanada en caliente. Certificar validez y presupuesto FIFO con 'validate_artifact.ts --heuristics'."
      : "Fricción severa detectada en el arnés (bloqueos o bucles anti-loop). Auditar especificaciones en SKILL.md o learned_heuristics.md y registrar heurística.";
  } else if (metrics.total_tool_failures > 0) {
    metrics.root_cause_signal = "Defecto de Código";
    metrics.auditor_directive = "Se detectaron fallos de comando/herramienta durante la ejecución. Auditar errores sintácticos o de tests en el slice antes de emitir veredicto.";
  } else {
    metrics.root_cause_signal = "Ejecución Limpia";
    metrics.auditor_directive = "El historial de ejecución no presenta fricción anómala. Proceder con Quality Gate regular.";
  }

  return metrics;
}

export function generateFrictionReport(metrics: SessionMetrics): string {
  const sorted = Object.entries(metrics.tool_counts).sort(([, a], [, b]) => b - a).map(([t, c]) => `${t}: ${c}`);
  const toolSummary = sorted.length > 0 ? sorted.slice(0, 6).join(", ") : "Ninguna llamada registrada";
  const failed = Object.entries(metrics.tool_failures).map(([t, c]) => `${t} (${c})`);
  const failedSummary = failed.length > 0 ? failed.join(", ") : "Cero fallos registrados";

  const burstDetails: string[] = [];
  if (metrics.max_read_streak > 0) burstDetails.push(`Ráfaga máx: ${metrics.max_read_streak} lecturas${metrics.max_read_streak > 12 ? " (EXCEDE 12)" : ""}`);
  if (metrics.repetitive_loops.length > 0) burstDetails.push(`Bucles repetitivos: ${metrics.repetitive_loops.map(l => `${l.tool} x${l.count}`).join(", ")}`);

  const autoHealTag = metrics.auto_heals_triggered > 0 ? ` | **Auto-Sanaciones:** ${metrics.auto_heals_triggered}` : "";

  return [
    `# Reporte de Fricción de Sesión (Trace Distillation)`,
    `- **Sesión:** \`${metrics.conversation_id}\` | **Pasos:** ${metrics.total_steps} | **Turnos Usuario:** ${metrics.user_turns} | **Pasos Modelo:** ${metrics.model_turns}`,
    `- **Llamadas a Herramientas (${metrics.total_tool_calls}):** ${toolSummary}`,
    `- **Fallos Totales:** ${metrics.total_tool_failures} | **Ráfaga Máx. Lecturas:** ${metrics.max_read_streak}/12 | **Bucles Repetitivos:** ${metrics.repetitive_loops.length}`,
    `- **Bloqueos Circuit Breaker:** ${metrics.circuit_breaker_blocks} | **Alertas Anti-Loop:** ${metrics.anti_loop_triggers}${autoHealTag}`,
    ``,
    `## 🔍 Diagnóstico ODD para Systems-Auditor`,
    `- **Herramientas Fallidas:** ${failedSummary}`,
    `- **Ráfagas y Bucles:** ${burstDetails.length > 0 ? burstDetails.join(" | ") : "Ninguno detectado"}`,
    `- **Diagnóstico Preliminar:** **${metrics.root_cause_signal}**`,
    `- **Directiva:** ${metrics.auditor_directive}`,
  ].join("\n") + "\n";
}

export function distillSession(options: DistillOptions = {}): SessionMetrics {
  const ws = options.workspacePath || process.cwd();
  const dbPath = options.dbPath || getDefaultDbPath();
  const outPath = options.outputPath || resolve(ws, "_workspace", "friction_report.md");
  let tPath = options.transcriptPath ? (isAbsolute(options.transcriptPath) ? options.transcriptPath : resolve(ws, options.transcriptPath)) : undefined;
  let uuid = options.uuid;

  if (!tPath) {
    if (!uuid) uuid = resolveLatestConversation(dbPath, ws) || undefined;
    if (!uuid) throw new Error(`No se pudo resolver el conversation_id de la sesión activa en '${dbPath}' ni se proporcionó --uuid.`);
    tPath = getTranscriptPathForUUID(uuid);
  }

  if (!existsSync(tPath)) throw new Error(`El archivo de transcripción no existe en la ruta: '${tPath}'.`);

  const metrics = parseTranscriptContent(readFileSync(tPath, "utf-8"), uuid || "unknown", tPath);
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, generateFrictionReport(metrics), "utf-8");
  return metrics;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    console.log("Uso: bun distill_session.ts [--uuid <id>] [--transcript <path>] [--workspace <path>] [--db <path>] [--out <path>] [--json]");
    process.exit(0);
  }

  let uuid: string | undefined, transcriptPath: string | undefined, workspacePath: string | undefined, dbPath: string | undefined, outputPath: string | undefined, outputJson = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--uuid") uuid = args[++i];
    else if (args[i] === "--transcript") transcriptPath = args[++i];
    else if (args[i] === "--workspace") workspacePath = args[++i];
    else if (args[i] === "--db") dbPath = args[++i];
    else if (args[i] === "--out") outputPath = args[++i];
    else if (args[i] === "--json") outputJson = true;
  }

  try {
    const metrics = distillSession({ uuid, transcriptPath, workspacePath, dbPath, outputPath, outputJson });
    if (outputJson) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      const targetOut = outputPath || resolve(workspacePath || process.cwd(), "_workspace", "friction_report.md");
      console.log(`[distill_session] Reporte generado: ${targetOut}\n- Sesión: ${metrics.conversation_id}\n- Pasos: ${metrics.total_steps} | Llamadas: ${metrics.total_tool_calls}\n- Diagnóstico: ${metrics.root_cause_signal}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(`[distill_session] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
