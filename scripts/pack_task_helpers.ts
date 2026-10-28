import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PackTaskOptions {
  agent: string;
  slice?: string;
  taskId?: string;
  taskFile?: string;
  specFile?: string;
  abstractionsFile?: string;
  skillsDir?: string;
  maxLines?: number;
  format?: "markdown" | "json";
  output?: string;
}

export interface PackTaskResult {
  success: boolean;
  role: string;
  canonicalSkill: string;
  slice?: string;
  taskId?: string;
  lineCount: number;
  output: string;
  metadata: {
    taskFound: boolean;
    endpointsCount: number;
    heuristicsCount: number;
    skillLoaded: boolean;
  };
}

export const ROLE_ALIASES: Record<string, string> = {
  backend: "backend-architect",
  "backend-architect": "backend-architect",
  "backend-dev": "backend-architect",
  frontend: "frontend-ui",
  "frontend-ui": "frontend-ui",
  ui: "frontend-ui",
  "systems-auditor": "systems-auditor",
  systems: "systems-auditor",
  auditor: "systems-auditor",
  audit: "systems-auditor",
  "devops-engineer": "devops-engineer",
  devops: "devops-engineer",
  "project-planner": "project-planner",
  planner: "project-planner",
  "artifact-standards": "artifact-standards",
};

export function resolveCanonicalRole(agent: string): string {
  const normalized = agent.trim().toLowerCase();
  return ROLE_ALIASES[normalized] || normalized;
}

export function extractSkillContext(
  skillsDir: string,
  canonicalRole: string
): { skillRules: string[]; heuristics: string[]; loaded: boolean } {
  const skillPath = join(skillsDir, canonicalRole, "SKILL.md");
  const heuristicsPath = join(skillsDir, canonicalRole, "rules", "learned_heuristics.md");

  const skillRules: string[] = [];
  const heuristics: string[] = [];
  let loaded = false;

  if (existsSync(skillPath)) {
    loaded = true;
    const content = readFileSync(skillPath, "utf-8");
    const lines = content.split("\n");

    let captureDirectives = false;
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (/^##\s+(?:Reglas de Oro|Directivas|Core Directives)/i.test(line)) {
        captureDirectives = true;
        continue;
      }
      if (captureDirectives && /^##\s+/.test(line)) {
        break;
      }
      if (captureDirectives && line.trim().length > 0) {
        if (/^\d+\.|\*|-/.test(line.trim())) {
          const cleaned = line.trim().replace(/\s+/g, " ");
          skillRules.push(cleaned.length > 140 ? cleaned.slice(0, 137) + "..." : cleaned);
        }
      }
    }

    if (skillRules.length === 0) {
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (/^\d+\.\s+\*\*/.test(line)) {
          skillRules.push(line.length > 140 ? line.slice(0, 137) + "..." : line);
          if (skillRules.length >= 6) break;
        }
      }
    }
  }

  if (existsSync(heuristicsPath)) {
    const content = readFileSync(heuristicsPath, "utf-8");
    const lines = content.split("\n");
    let capture = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (/^#\s+Reglas Heurísticas/i.test(line)) {
        capture = true;
        continue;
      }
      if (capture && /^##?\s+/.test(line)) {
        break;
      }
      if (capture && (line.startsWith("- ") || /^\d+\.\s+/.test(line))) {
        heuristics.push(line);
      }
    }
  }

  return {
    skillRules: skillRules.slice(0, 7),
    heuristics: heuristics.slice(0, 5),
    loaded,
  };
}

export function extractTask(
  taskFilePath: string,
  canonicalRole: string,
  taskId?: string,
  slice?: string
): { taskText: string; found: boolean; id: string } {
  if (!existsSync(taskFilePath)) {
    return {
      taskText: `- [ ] (${canonicalRole}) Tarea atómica de desarrollo para el slice ${slice || "core"}.`,
      found: false,
      id: taskId || "T-AUTO",
    };
  }

  const content = readFileSync(taskFilePath, "utf-8");
  const lines = content.split("\n");
  const matchingLines: string[] = [];
  let foundId = taskId || "";

  const captureSubItems = (startIndex: number) => {
    for (let j = startIndex + 1; j < lines.length; j++) {
      if (/^\s+[-*]/.test(lines[j])) {
        matchingLines.push(lines[j].trim());
      } else if (/^\s*$/.test(lines[j])) {
        continue;
      } else {
        break;
      }
    }
  };

  // Strategy 1: Explicit taskId match
  if (taskId) {
    const idRegex = new RegExp(`\\(${taskId}\\)|\\b${taskId}\\b`, "i");
    for (let i = 0; i < lines.length; i++) {
      if (idRegex.test(lines[i])) {
        matchingLines.push(lines[i].trim());
        captureSubItems(i);
        break;
      }
    }
  }

  // Strategy 2: Pending task matching role
  if (matchingLines.length === 0) {
    const roleRegex = new RegExp(`\\(${canonicalRole}\\)`, "i");
    const shortRole = canonicalRole
      .replace("-architect", "")
      .replace("-ui", "")
      .replace("-engineer", "")
      .replace("-auditor", "")
      .replace("-planner", "");
    const shortRegex = new RegExp(`\\(${shortRole}\\)`, "i");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^-\s*\[ \]/.test(line) && (roleRegex.test(line) || shortRegex.test(line))) {
        if (!slice || line.toLowerCase().includes(slice.toLowerCase())) {
          matchingLines.push(line.trim());
          captureSubItems(i);
          const match = line.match(/\(([A-Z0-9_-]+)\)\s*$/i) || line.match(/Milestone\s*(\d+)/i);
          if (match && !foundId) foundId = match[1];
          break;
        }
      }
    }
  }

  // Strategy 3: Any task matching role
  if (matchingLines.length === 0) {
    const roleRegex = new RegExp(`\\(${canonicalRole}\\)`, "i");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (roleRegex.test(line)) {
        matchingLines.push(line.trim());
        captureSubItems(i);
        const match = line.match(/\(([A-Z0-9_-]+)\)\s*$/i);
        if (match && !foundId) foundId = match[1];
        break;
      }
    }
  }

  if (matchingLines.length > 0) {
    return {
      taskText: matchingLines.join("\n"),
      found: true,
      id: foundId || taskId || "T-MATCH",
    };
  }

  return {
    taskText: `- [ ] (${canonicalRole}) Implementar slice ${slice || "requerido"} según especificaciones SDD y TDD co-localizado.`,
    found: false,
    id: taskId || "T-FALLBACK",
  };
}

export function extractContracts(
  specFilePath: string,
  slice?: string
): { contracts: string[]; count: number } {
  if (!existsSync(specFilePath)) {
    return { contracts: ["- (No se encontró api_spec.md)"], count: 0 };
  }

  const content = readFileSync(specFilePath, "utf-8");
  const lines = content.split("\n");
  const contracts: string[] = [];
  const httpRegex = /(?:^-\s*\*\*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)(?:\*\*\s*`|\s+)([^\*`]+)(?:\*\*|`\*\*)|^-\s*`\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^`]+)`|^###?\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)|(?:#|\/\/|<!--)\s*@spec-contract\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)|\|\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\|\s*([^\|]+)\s*\|)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(httpRegex);
    if (match) {
      const method = (match[1] || match[3] || match[5] || match[7] || match[9]).toUpperCase();
      let rawPath = (match[2] || match[4] || match[6] || match[8] || match[10]).trim();
      rawPath = rawPath.replace(/^[`'"]+|[`'"]+$/g, "").trim();
      const endpoint = `${method} ${rawPath}`;

      if (!slice || endpoint.toLowerCase().includes(slice.toLowerCase())) {
        contracts.push(`- **${endpoint}**`);
        for (let j = i + 1; j < lines.length; j++) {
          const subLine = lines[j];
          if (/^\s+-\s+/.test(subLine)) {
            contracts.push(`  ${subLine.trim()}`);
          } else if (/^\s*$/.test(subLine)) {
            continue;
          } else {
            break;
          }
        }
      }
    }
  }

  if (contracts.length === 0 && slice) {
    return {
      contracts: [`- [ ] (Sin contratos declarados aún en api_spec.md para el slice '${slice}')`],
      count: 0,
    };
  }

  return {
    contracts: contracts.length > 0 ? contracts : ["- **GET /api/resource** (Endpoint de referencia)"],
    count: contracts.filter((c) => c.startsWith("- **")).length,
  };
}

export function extractAbstractions(
  abstractionsFilePath: string,
  slice?: string
): string[] {
  if (!existsSync(abstractionsFilePath)) {
    return ["- (No se encontró abstractions.md)"];
  }

  const content = readFileSync(abstractionsFilePath, "utf-8");
  const lines = content.split("\n");
  const abstractions: string[] = [];

  let captureSection = false;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (/^##\s+(?:.*Interfaces|.*Clases|.*Servicios|.*Funciones|.*Costuras)/i.test(line)) {
      captureSection = true;
      continue;
    }
    if (captureSection && /^##\s+/.test(line)) {
      captureSection = false;
    }
    if (captureSection && (line.startsWith("### `") || line.startsWith("### Clase:") || line.startsWith("### "))) {
      const title = line.replace(/^###\s+/, "");
      let item = `- ${title}`;
      if (i + 1 < lines.length && /^\s*-\s*(?:\*\*Propósito|\*\*Responsabilidad|Propósito)/i.test(lines[i + 1])) {
        item += `\n  ${lines[i + 1].trim()}`;
      }
      abstractions.push(item);
    }
  }

  if (abstractions.length === 0) {
    abstractions.push("- Interfaces de dominio co-localizadas bajo `features/<slice>/`.");
    abstractions.push("- Principio VSA: Cero dependencias circulares entre slices verticales.");
  }

  if (slice && abstractions.length > 1) {
    const sliceLower = slice.toLowerCase();
    const matching = abstractions.filter((a) => a.toLowerCase().includes(sliceLower));
    if (matching.length > 0) {
      return matching.slice(0, 5);
    }
  }

  return abstractions.slice(0, 5);
}
