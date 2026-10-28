import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TelemetryDB } from "./telemetry_db";

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

export function extractActiveHeuristics(workspaceRoot: string): string[] {
  const heuristics: string[] = [];
  const skillsDir = resolve(workspaceRoot, ".agents", "skills");

  if (!existsSync(skillsDir)) return heuristics;

  try {
    const skills = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const skill of skills) {
      const hPath = resolve(skillsDir, skill, "rules", "learned_heuristics.md");
      if (existsSync(hPath)) {
        const content = readFileSync(hPath, "utf-8");
        const lines = content.split(/\r?\n/);
        let inFrontmatter = false;
        let pastFrontmatter = false;

        for (const line of lines) {
          const t = line.trim();
          if (t === "---") {
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
                heuristics.push(`(${skill}) ${ruleText}`);
              }
            }
          }
        }
      }
    }
  } catch {}

  return heuristics;
}

export function handlePreInvocation(
  payload: PreInvocationPayload,
  options?: { customWorkspace?: string; customTelemetryPath?: string }
): PreInvocationResponse {
  const ws = options?.customWorkspace || payload.workspacePaths?.[0] || process.cwd();
  const heuristics = extractActiveHeuristics(ws);

  // También consultar heurísticas promovidas de SQLite
  const telemetry = new TelemetryDB(options?.customTelemetryPath);
  try {
    const promoted = (telemetry as any).db?.query?.(`
      SELECT rule_id, skill, rule_text FROM promoted_heuristics WHERE status = 'promoted' LIMIT 5;
    `)?.all?.() as any[] | undefined;

    if (promoted && promoted.length > 0) {
      for (const p of promoted) {
        const ruleStr = `(promoted:${p.skill}) [${p.rule_id}] ${p.rule_text}`;
        if (!heuristics.includes(ruleStr)) {
          heuristics.unshift(ruleStr);
        }
      }
    }
  } catch {} finally {
    telemetry.close();
  }

  if (heuristics.length === 0) {
    return { injectSteps: [] };
  }

  // Limitar a máximo 8 heurísticas más relevantes para prevenir bloat
  const selected = heuristics.slice(0, 8);
  const ephemeralContent = [
    "⚡ [HARNESS³ ACTIVE HEURISTICS (Zero-Prompt-Bloat)]",
    ...selected.map((h) => `- ${h}`),
  ].join("\n");

  return {
    injectSteps: [
      {
        ephemeralMessage: ephemeralContent,
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
