import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CircuitBreaker } from "../../../scripts/circuit_breaker";
import { drainNotices, resolveCounterPath, resolveWorkspaceRoot } from "../../../scripts/harness_io";
import { TelemetryDB } from "./telemetry_db";

const MAX_HEURISTICS = 8;
const MAX_PROMOTED = 3;

export interface PreInvocationPayload {
  invocationNum?: number;
  initialNumSteps?: number;
  workspacePaths?: string[];
  lastUserInput?: string;
  [key: string]: any;
}

export interface PreInvocationResponse {
  injectSteps: Array<{
    ephemeralMessage?: string;
    systemMessage?: { systemMessage: string; metadata?: Record<string, any> };
    userMessage?: string;
  }>;
}

/**
 * Reglas activas, las más recientes primero y alternando entre skills. Concatenar en orden
 * alfabético dejaba fuera del tope de 8 justo las reglas recién aprendidas: las más nuevas
 * de cada archivo van al final y systems-auditor, destino habitual del auto-heal, es la última skill.
 */
export function extractActiveHeuristics(workspaceRoot: string): string[] {
  const perSkill: string[][] = [];
  const skillsDir = resolve(workspaceRoot, ".agents", "skills");

  if (!existsSync(skillsDir)) return [];

  try {
    const skills = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const skill of skills) {
      const hPath = resolve(skillsDir, skill, "rules", "learned_heuristics.md");
      if (existsSync(hPath)) {
        const skillRules: string[] = [];
        const content = readFileSync(hPath, "utf-8");
        const lines = content.split(/\r?\n/);
        let inFrontmatter = false;
        let pastFrontmatter = false;

        for (const line of lines) {
          const t = line.trim();
          if (t === "---" && !pastFrontmatter) {
            if (!inFrontmatter) {
              inFrontmatter = true;
            } else {
              inFrontmatter = false;
              pastFrontmatter = true;
            }
            continue;
          }
          if (pastFrontmatter && !t.startsWith("#") && !t.startsWith(">") && t.length > 0) {
            if (/^(?:[-*]|\d+\.)\s+/i.test(t)) {
              const ruleText = t.replace(/^(?:[-*]|\d+\.)\s+/, "").trim();
              if (ruleText.length > 0) {
                skillRules.push(`(${skill}) ${ruleText}`);
              }
            }
          }
        }

        if (skillRules.length > 0) perSkill.push(skillRules.reverse());
      }
    }
  } catch {}

  const heuristics: string[] = [];
  const deepest = Math.max(0, ...perSkill.map((rules) => rules.length));
  for (let i = 0; i < deepest; i++) {
    for (const rules of perSkill) {
      if (rules[i]) heuristics.push(rules[i]);
    }
  }

  return heuristics;
}

export function handlePreInvocation(
  payload: PreInvocationPayload,
  options?: { customWorkspace?: string; customTelemetryPath?: string; customCounterPath?: string }
): PreInvocationResponse {
  const ws = options?.customWorkspace || resolveWorkspaceRoot(payload);

  // invocationNum 0 = el usuario volvió a hablar: la pausa del Anti-Loop quedó cumplida
  if (payload.invocationNum === 0) {
    new CircuitBreaker(options?.customCounterPath || resolveCounterPath(ws, payload.conversationId)).clearTransientBlocks();
  }

  const notices = drainNotices(ws);
  const heuristics = extractActiveHeuristics(ws);

  // También consultar heurísticas promovidas de SQLite. Un fallo aquí no debe costar las locales.
  const promotedRules: string[] = [];
  let telemetry: TelemetryDB | null = null;
  try {
    telemetry = new TelemetryDB(options?.customTelemetryPath);
    for (const p of telemetry.getPromotedHeuristics(MAX_PROMOTED)) {
      promotedRules.push(`(promoted:${p.skill}) ${p.rule_text}`);
    }
  } catch {} finally {
    telemetry?.close();
  }

  // Limitar a máximo 8 heurísticas más relevantes para prevenir bloat
  const selected = [...promotedRules, ...heuristics].slice(0, MAX_HEURISTICS);

  if (selected.length === 0 && notices.length === 0) {
    return { injectSteps: [] };
  }

  const sections: string[] = [...notices];
  if (selected.length > 0) {
    sections.push("⚡ [HARNESS³ ACTIVE HEURISTICS (Zero-Prompt-Bloat)]", ...selected.map((h) => `- ${h}`));
  }

  return {
    injectSteps: [
      {
        ephemeralMessage: sections.join("\n"),
      },
    ],
  };
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
      const payload: PreInvocationPayload = inputData.trim() ? JSON.parse(inputData) : {};
      const response = handlePreInvocation(payload);
      process.stdout.write(JSON.stringify(response));
      process.exit(0);
    } catch {
      process.stdout.write(JSON.stringify({ injectSteps: [] }));
      process.exit(0);
    }
  });
}
