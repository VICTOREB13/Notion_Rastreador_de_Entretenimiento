#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";

export interface ValidationResult { valid: boolean; errors: string[]; }
export interface ValidateOptions { schemaPath?: string; heuristics?: boolean; }

export function validateLearnedHeuristics(content: string): ValidationResult {
  return validateArtifactContent(content, { heuristics: true });
}

export function validateArtifactContent(content: string, options: ValidateOptions = {}): ValidationResult {
  const errors: string[] = [];
  if (!content || !content.trim()) return { valid: false, errors: ["El archivo de artefacto está completamente vacío."] };

  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== "---") errors.push("El frontmatter YAML debe iniciar estrictamente en la línea 1 con '---'.");

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") { closingIndex = i; break; }
  }

  const frontmatterMap: Record<string, string> = {};
  const clean = (s?: string) => s ? s.replace(/^["']|["']$/g, "").trim() : "";

  if (closingIndex === -1) {
    errors.push("No se encontró el delimitador de cierre '---' para el frontmatter YAML.");
  } else {
    for (let i = 1; i < closingIndex; i++) {
      const line = lines[i], trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (/^\s+/.test(line) && !trimmed.startsWith("-")) {
        errors.push(`Estructura YAML anidada no permitida en la línea ${i + 1}: '${trimmed}'. Obsidian Properties requiere claves planas.`);
        continue;
      }
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        if (!trimmed.startsWith("-")) errors.push(`Línea inválida en frontmatter (falta ':'): '${trimmed}'.`);
        continue;
      }
      const rawKey = trimmed.substring(0, colonIndex).trim();
      const rawVal = trimmed.substring(colonIndex + 1).trim();

      if (/[A-Z]/.test(rawKey)) {
        errors.push(`La clave de frontmatter '${rawKey}' contiene mayúsculas. Todas las claves deben ser estrictamente minúsculas snake_case.`);
      }
      if (!/^[a-z0-9_]+$/.test(rawKey)) {
        errors.push(`La clave de frontmatter '${rawKey}' no cumple con el formato estrictamente snake_case en minúsculas (/^[a-z0-9_]+$/).`);
      }
      frontmatterMap[rawKey] = rawVal;
    }

    const tipo = clean(frontmatterMap["tipo"]);
    const validTipos = ["overview", "arquitectura", "api_spec", "abstracciones", "design_system", "implementation_plan", "task_list", "task", "changelog", "audit_report", "playbook", "playbook-agente", "documentacion", "learned_heuristics"];
    if (!tipo) errors.push("Falta la clave obligatoria 'tipo' en el frontmatter.");
    else if (!validTipos.includes(tipo)) errors.push(`Valor de 'tipo: ${tipo}' no reconocido. Tipos válidos: ${validTipos.join(", ")}.`);

    for (const key of ["fecha", "fecha_actualizacion"] as const) {
      if (frontmatterMap[key] && !/^\d{4}-\d{2}-\d{2}$/.test(clean(frontmatterMap[key]))) {
        errors.push(`Formato de '${key}: ${clean(frontmatterMap[key])}' inválido. Debe ser strictly ISO YYYY-MM-DD (ej. 2026-10-26).`);
      }
    }

    if (frontmatterMap["reglas_count"]) {
      const rCount = parseInt(clean(frontmatterMap["reglas_count"]), 10);
      if (isNaN(rCount) || rCount < 0) {
        errors.push(`Valor de 'reglas_count: ${clean(frontmatterMap["reglas_count"])}' inválido. Debe ser un entero no negativo.`);
      }
    }

    if (frontmatterMap["veredicto"]) {
      const veredicto = clean(frontmatterMap["veredicto"]);
      if (veredicto !== "PASS" && veredicto !== "FAIL") {
        errors.push(`Valor de 'veredicto: ${veredicto}' inválido. Debe ser estrictamente 'PASS' o 'FAIL' en mayúsculas.`);
      }
    }

    if (frontmatterMap["estado"]) {
      const estado = clean(frontmatterMap["estado"]);
      const validEstados = ["activo", "borrador", "completado", "congelado"];
      if (!validEstados.includes(estado)) {
        errors.push(`Valor de 'estado: ${estado}' inválido. Debe ser uno de: ${validEstados.join(", ")}.`);
      }
    }
  }

  const bodyContent = closingIndex !== -1 ? lines.slice(closingIndex + 1).join("\n") : content;
  const isHeuristics = clean(frontmatterMap["tipo"]) === "learned_heuristics" || Boolean(options.heuristics);

  if (isHeuristics) {
    if (lines.length > 30) {
      errors.push(`Presupuesto de entropía excedido: 'learned_heuristics.md' tiene ${lines.length} líneas (límite duro: 30 líneas). Aplique la política FIFO para purgar las heurísticas más antiguas.`);
    }
    const ruleMatches = bodyContent.match(/^\s*(?:\d+\.|\*|-)\s+(?:\[H-\d+\]|Regla|H-\d+|\[Regla)/gim) || bodyContent.match(/^\s*\d+\.\s+/gm);
    const ruleCount = ruleMatches ? ruleMatches.length : 0;
    if (ruleCount > 10) {
      errors.push(`Límite de heurísticas excedido: se detectaron ${ruleCount} reglas (máximo permitido: 10 reglas). Aplique la política FIFO para eliminar reglas obsoletas.`);
    }
  }

  if (/(?:^|\n)\s*```\s*mermaid/i.test(bodyContent)) {
    errors.push("Bloque '```mermaid' detectado. Los diagramas Mermaid están estrictamente prohibidos; use diagramas HTML interactivos de Archify.");
  }

  if (/\[.*?\]\(\s*file:\/\/\/[^)]+\)/i.test(bodyContent)) {
    errors.push("Enlace local con protocolo 'file:///' detectado. Use wikilinks de Obsidian '[[PRJ_{PROYECTO}_{artefacto}|Alias]]' en su lugar.");
  }

  if (options.schemaPath) {
    if (!existsSync(options.schemaPath)) {
      errors.push(`El esquema de referencia especificado no existe: '${options.schemaPath}'.`);
    } else {
      try {
        const schemaRaw = readFileSync(options.schemaPath, "utf-8");
        const schemaTipoMatch = schemaRaw.match(/tipo:\s*([a-z0-9_-]+)/i);
        if (schemaTipoMatch) {
          const expected = schemaTipoMatch[1].trim().toLowerCase();
          const actual = clean(frontmatterMap["tipo"]).toLowerCase();
          const match = actual === expected ||
            (expected === "playbook-agente" && actual === "playbook") ||
            (expected === "playbook" && actual === "playbook-agente") ||
            (expected === "task_list" && actual === "task") ||
            (expected === "task" && actual === "task_list");
          if (actual && !match) {
            errors.push(`El tipo '${actual}' no coincide con el tipo esperado por el esquema '${expected}'.`);
          }
        }
        const schemaFmMatch =
          schemaRaw.match(/```[a-zA-Z0-9_-]*[ \t]*\r?\n---[ \t]*\r?\n([\s\S]*?)\r?\n---/) ||
          schemaRaw.match(/---\r?\n([\s\S]*?)\r?\n---/);
        if (schemaFmMatch) {
          for (const sLine of schemaFmMatch[1].split(/\r?\n/)) {
            if (sLine.trim().startsWith("#")) continue;
            const sc = sLine.indexOf(":");
            if (sc !== -1) {
              const reqKey = sLine.substring(0, sc).trim().toLowerCase();
              if (reqKey && !frontmatterMap[reqKey]) {
                errors.push(`Falta la clave requerida por el esquema: '${reqKey}'.`);
              }
            }
          }
        }
      } catch (err) {
        errors.push(`Error al leer el esquema de referencia: ${String(err)}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("-h") || args.includes("--help")) {
    console.log("Uso: bun validate_artifact.ts <archivo.md> [--schema <ruta_esquema.md>] [--heuristics]");
    process.exit(0);
  }

  let targetFile = "", schemaPath: string | undefined, forceHeuristics = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--schema") schemaPath = args[++i];
    else if (args[i] === "--heuristics") forceHeuristics = true;
    else if (!targetFile) targetFile = args[i];
  }

  if (!targetFile) {
    console.log(JSON.stringify({ valid: false, errors: ["No se proporcionó ningún archivo de artefacto para validar."] }, null, 2));
    process.exit(1);
  }

  const fullTarget = isAbsolute(targetFile) ? targetFile : resolve(process.cwd(), targetFile);
  if (!existsSync(fullTarget)) {
    console.log(JSON.stringify({ valid: false, errors: [`El archivo especificado no existe en disco: '${fullTarget}'.`] }, null, 2));
    process.exit(1);
  }

  const fullSchema = schemaPath ? (isAbsolute(schemaPath) ? schemaPath : resolve(process.cwd(), schemaPath)) : undefined;
  try {
    const result = validateArtifactContent(readFileSync(fullTarget, "utf-8"), {
      schemaPath: fullSchema,
      heuristics: forceHeuristics,
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.log(JSON.stringify({ valid: false, errors: [`Error fatal de lectura o validación: ${String(error)}`] }, null, 2));
    process.exit(1);
  }
}
