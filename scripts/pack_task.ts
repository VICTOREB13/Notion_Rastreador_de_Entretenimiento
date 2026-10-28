import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  extractAbstractions,
  extractContracts,
  extractSkillContext,
  extractTask,
  resolveCanonicalRole,
  type PackTaskOptions,
  type PackTaskResult,
} from "./pack_task_helpers";

export * from "./pack_task_helpers";

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
