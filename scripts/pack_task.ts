import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

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

const ROLE_ALIASES: Record<string, string> = {
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
          // Take first sentence or up to 140 chars to ensure density
          const cleaned = line.trim().replace(/\s+/g, " ");
          skillRules.push(cleaned.length > 140 ? cleaned.slice(0, 137) + "..." : cleaned);
        }
      }
    }

    if (skillRules.length === 0) {
      // Fallback: extract any numbered rules or bullet points
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

  // Strategy 1: Explicit taskId match
  if (taskId) {
    const idRegex = new RegExp(`\\(${taskId}\\)|\\b${taskId}\\b`, "i");
    for (let i = 0; i < lines.length; i++) {
      if (idRegex.test(lines[i])) {
        matchingLines.push(lines[i].trim());
        // Capture all immediate nested sub-items
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s+[-*]/.test(lines[j])) {
            matchingLines.push(lines[j].trim());
          } else if (/^\s*$/.test(lines[j])) {
            continue;
          } else {
            break;
          }
        }
        break;
      }
    }
  }

  // Strategy 2: Pending task matching role
  if (matchingLines.length === 0) {
    const roleRegex = new RegExp(`\\(${canonicalRole}\\)`, "i");
    const shortRole = canonicalRole.replace("-architect", "").replace("-ui", "").replace("-engineer", "").replace("-auditor", "").replace("-planner", "");
    const shortRegex = new RegExp(`\\(${shortRole}\\)`, "i");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^-\s*\[ \]/.test(line) && (roleRegex.test(line) || shortRegex.test(line))) {
        if (!slice || line.toLowerCase().includes(slice.toLowerCase())) {
          matchingLines.push(line.trim());
          // Capture all immediate nested sub-items
          for (let j = i + 1; j < lines.length; j++) {
            if (/^\s+[-*]/.test(lines[j])) {
              matchingLines.push(lines[j].trim());
            } else if (/^\s*$/.test(lines[j])) {
              continue;
            } else {
              break;
            }
          }
          const match = line.match(/\(([A-Z0-9_-]+)\)\s*$/i) || line.match(/Milestone\s*(\d+)/i);
          if (match && !foundId) foundId = match[1];
          break;
        }
      }
    }
  }

  // Strategy 3: Any task matching role (fallback single atomic reference)
  if (matchingLines.length === 0) {
    const roleRegex = new RegExp(`\\(${canonicalRole}\\)`, "i");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (roleRegex.test(line)) {
        matchingLines.push(line.trim());
        // Capture sub-items
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s+[-*]/.test(lines[j])) {
            matchingLines.push(lines[j].trim());
          } else if (/^\s*$/.test(lines[j])) {
            continue;
          } else {
            break;
          }
        }
        const match = line.match(/\(([A-Z0-9_-]+)\)\s*$/i);
        if (match && !foundId) foundId = match[1];
        break; // Stop at exactly 1 atomic task
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
        // Capture all indented description, response, or param detail lines
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

  // If slice specified but no endpoint matched that slice, do NOT dump unrelated contracts
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
      // Capture immediate purpose/responsibility if present
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

  // If slice specified, prioritize matching abstractions
  if (slice && abstractions.length > 1) {
    const sliceLower = slice.toLowerCase();
    const matching = abstractions.filter((a) => a.toLowerCase().includes(sliceLower));
    if (matching.length > 0) {
      return matching.slice(0, 5);
    }
  }

  return abstractions.slice(0, 5);
}

export function packTask(options: PackTaskOptions): PackTaskResult {
  const repoRoot = process.cwd();
  const canonicalRole = resolveCanonicalRole(options.agent);
  const skillsDir = options.skillsDir ? resolve(options.skillsDir) : join(repoRoot, ".agents", "skills");
  const taskFile = options.taskFile ? resolve(options.taskFile) : join(repoRoot, "artifacts", "planning", "task.md");
  const specFile = options.specFile ? resolve(options.specFile) : join(repoRoot, "artifacts", "architecture", "api_spec.md");
  const abstractionsFile = options.abstractionsFile ? resolve(options.abstractionsFile) : join(repoRoot, "artifacts", "architecture", "abstractions.md");
  const maxLines = options.maxLines && options.maxLines > 0 ? options.maxLines : 95;

  const { skillRules, heuristics, loaded } = extractSkillContext(skillsDir, canonicalRole);
  const taskInfo = extractTask(taskFile, canonicalRole, options.taskId, options.slice);
  const contractsInfo = extractContracts(specFile, options.slice);
  const abstractions = extractAbstractions(abstractionsFile, options.slice);

  const blockLines: string[] = [];

  blockLines.push(`# 🎯 CONTEXTO DE DESPACHO: ${canonicalRole.toUpperCase()}${options.slice ? ` [Slice: ${options.slice}]` : ""}`);
  blockLines.push(`> Generado por \`scripts/pack_task.ts\` para ejecución determinista en Turno 1 (Tier Flash High).`);
  blockLines.push(`> Previene Skill Bypass, garantiza SDD + TDD co-localizado y optimiza ventana de contexto.`);
  blockLines.push("");

  blockLines.push(`## 1. Directivas de Skill y Heurísticas Activas (${canonicalRole})`);
  if (skillRules.length > 0) {
    for (const rule of skillRules) {
      blockLines.push(rule.startsWith("-") || /^\d+\./.test(rule) ? rule : `- ${rule}`);
    }
  } else {
    blockLines.push("- Seguir directivas operativas de la skill correspondiente.");
  }

  blockLines.push("### Heurísticas Aprendidas (Harness² FIFO Cache)");
  if (heuristics.length > 0) {
    for (const h of heuristics) {
      blockLines.push(h);
    }
  } else {
    blockLines.push("- (Ninguna heurística registrada en FIFO cache; operar bajo reglas base)");
  }
  blockLines.push("");

  blockLines.push("## 2. Tarea Atómica Asignada (task.md)");
  blockLines.push(taskInfo.taskText);
  blockLines.push("");

  blockLines.push("## 3. Contratos SDD (api_spec.md)");
  for (const contract of contractsInfo.contracts) {
    blockLines.push(contract);
  }
  blockLines.push("");

  blockLines.push("## 4. Abstracciones & Invariantes de Dominio (abstractions.md)");
  for (const abs of abstractions) {
    blockLines.push(abs);
  }
  blockLines.push("");

  blockLines.push("## 5. Criterio de Finalización Obligatorio");
  blockLines.push("1. Tests TDD co-localizados en verde (<500ms en runner nativo).");
  blockLines.push("2. Cero N+1 queries, cero 'blind fixes' y cero roturas de contratos SDD.");
  blockLines.push("3. Reportar al Master Orchestrator vía \`send_message\` en formato de auditoría.");

  // Enforce strict line budget (<100 lines)
  let finalLines = blockLines;
  if (finalLines.length > maxLines) {
    finalLines = finalLines.slice(0, maxLines - 2);
    finalLines.push("...");
    finalLines.push(`> [Presupuesto de contexto: Truncado a ${maxLines} líneas para preservar ventana de atención]`);
  }

  const output = finalLines.join("\n");
  const lineCount = finalLines.length;

  if (options.output) {
    writeFileSync(resolve(options.output), output, "utf-8");
  }

  return {
    success: true,
    role: canonicalRole,
    canonicalSkill: canonicalRole,
    slice: options.slice,
    taskId: taskInfo.id,
    lineCount,
    output,
    metadata: {
      taskFound: taskInfo.found,
      endpointsCount: contractsInfo.count,
      heuristicsCount: heuristics.length,
      skillLoaded: loaded,
    },
  };
}

export function parseCliArgs(args: string[]): PackTaskOptions {
  let agent = "";
  let slice: string | undefined;
  let taskId: string | undefined;
  let format: "markdown" | "json" = "markdown";
  let output: string | undefined;
  let taskFile: string | undefined;
  let specFile: string | undefined;
  let abstractionsFile: string | undefined;
  let skillsDir: string | undefined;
  let maxLines: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--agent" || arg === "-a") {
      agent = args[++i] || "";
    } else if (arg === "--slice" || arg === "-s") {
      slice = args[++i];
    } else if (arg === "--task" || arg === "-t") {
      taskId = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      const f = args[++i]?.toLowerCase();
      if (f === "json" || f === "markdown") format = f;
    } else if (arg === "--json") {
      format = "json";
    } else if (arg === "--output" || arg === "-o") {
      output = args[++i];
    } else if (arg === "--max-lines") {
      maxLines = parseInt(args[++i], 10);
    } else if (arg === "--task-file") {
      taskFile = args[++i];
    } else if (arg === "--spec-file") {
      specFile = args[++i];
    } else if (arg === "--abstractions-file") {
      abstractionsFile = args[++i];
    } else if (arg === "--skills-dir") {
      skillsDir = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Uso: bun scripts/pack_task.ts --agent <rol> [--slice <nombre>] [--task <id>] [--json] [--output <archivo>]

Opciones:
  --agent, -a <rol>       Rol del subagente (backend, frontend, auditor, devops, planner)
  --slice, -s <nombre>    Nombre del Vertical Slice (ej: auth, users, resource)
  --task, -t <id>         ID o patrón de la tarea atómica en task.md (ej: F1, F6)
  --json                  Salida estructurada en JSON
  --output, -o <archivo>  Guardar prompt compilado en archivo
  --max-lines <n>         Límite de líneas (por defecto 95, presupuesto duro <100)
  --help, -h              Muestra esta ayuda
`);
      process.exit(0);
    }
  }

  if (!agent) {
    console.error("Error: Se requiere el parámetro obligatorio '--agent <rol>'");
    console.error("Ejemplo: bun scripts/pack_task.ts --agent backend --slice resource");
    process.exit(1);
  }

  return {
    agent,
    slice,
    taskId,
    format,
    output,
    taskFile,
    specFile,
    abstractionsFile,
    skillsDir,
    maxLines,
  };
}

if (import.meta.main) {
  const options = parseCliArgs(process.argv.slice(2));
  const result = packTask(options);

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.output);
  }

  process.exit(result.success ? 0 : 1);
}
