import { homedir } from "node:os";
import { isAbsolute, resolve, normalize } from "node:path";

export interface SanitizeResult {
  sanitized: boolean;
  overwrittenArgs: Record<string, any>;
  changes: string[];
}

const PATH_ARG_KEYS = new Set<string>([
  "AbsolutePath",
  "Path",
  "TargetFile",
  "DirectoryPath",
  "SearchPath",
  "SearchDirectory",
  "filePath",
  "filepath",
  "file_path",
  "target_file",
  "targetFile",
  "path",
  "Directory",
  "directory",
]);

function cleanPath(val: string, baseWorkspace: string): { cleaned: string; changed: boolean } {
  let cleaned = val.trim();

  // Strip wrapping quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Una URL no es una ruta local: resolverla contra el workspace la corrompe
  if (/^[a-z][a-z0-9+.-]+:\/\//i.test(cleaned) && !/^file:\/\//i.test(cleaned)) {
    return { cleaned: val, changed: false };
  }

  // Strip file URI protocol (e.g., file:///C:/... or file:///home/...)
  if (/^file:\/\//i.test(cleaned)) {
    cleaned = cleaned.replace(/^file:\/\/(?:localhost)?/i, "");
    try { cleaned = decodeURI(cleaned); } catch {}
    if (/^\/[a-zA-Z]:/i.test(cleaned)) {
      cleaned = cleaned.slice(1);
    }
  }

  if (/^~(?:[/\\]|$)/.test(cleaned)) {
    cleaned = `${homedir()}${cleaned.slice(1)}`;
  }

  // Normalize slashes (preservando el prefijo de rutas UNC //servidor/recurso)
  const isUnc = /^(?:\\\\|\/\/)[^/\\]/.test(cleaned);
  cleaned = cleaned.replace(/\\/g, "/");
  cleaned = cleaned.replace(/^([a-zA-Z]:)\/{2,}/g, "$1/");
  cleaned = cleaned.replace(/(?<!:)\/{2,}/g, "/");
  if (isUnc) cleaned = `/${cleaned}`;

  // Convert relative to absolute
  const isAbs = /^[a-zA-Z]:\//i.test(cleaned) || cleaned.startsWith("//") || isAbsolute(cleaned);
  if (!isAbs && cleaned.length > 0) {
    if (/^[a-zA-Z]:\//i.test(baseWorkspace) && process.platform !== "win32") {
      const base = baseWorkspace.endsWith("/") ? baseWorkspace.slice(0, -1) : baseWorkspace;
      const rel = cleaned.startsWith("/") ? cleaned.slice(1) : cleaned;
      const absolute = normalize(`${base}/${rel}`).replace(/\\/g, "/");
      return { cleaned: absolute, changed: absolute !== val };
    }
    const absolute = resolve(baseWorkspace, cleaned).replace(/\\/g, "/");
    return { cleaned: absolute, changed: absolute !== val };
  }

  return { cleaned, changed: cleaned !== val };
}

// Coincidencia exacta a propósito: buscar "file" o "path" dentro del nombre reescribe
// parámetros de MCP que no son rutas ('profile', 'pathname', 'file_type', 'filePattern').
const NESTED_PATH_KEY_REGEX = /^(?:file|(?:source|dest|destination|target|input|output)[_-]?(?:file|path))$/i;

/**
 * Sanitiza argumentos de herramientas para PreToolUse.
 * Corrige rutas relativas a absolutas, barras duplicadas, comillas redundantes
 * y comandos inconsistentes en Windows.
 */
export function sanitizeToolArgs(
  toolName: string,
  args: Record<string, any> | undefined,
  workspacePaths?: string[]
): SanitizeResult {
  if (!args || typeof args !== "object") {
    return { sanitized: false, overwrittenArgs: {}, changes: [] };
  }

  const overwrittenArgs: Record<string, any> = {};
  const changes: string[] = [];
  const baseWorkspace = workspacePaths?.[0] || process.cwd();

  // 1. Sanitización de Rutas de nivel superior
  for (const [key, value] of Object.entries(args)) {
    const isTargetPermissionPath = key === "Target" && (args.Action === "read_file" || args.Action === "write_file");
    if ((PATH_ARG_KEYS.has(key) || isTargetPermissionPath) && typeof value === "string") {
      const { cleaned, changed } = cleanPath(value, baseWorkspace);
      if (changed) {
        overwrittenArgs[key] = cleaned;
        changes.push(`Sanitized path in '${key}': '${cleaned}'`);
      }
    }
  }

  // 2. Sanitización de Argumentos anidados para call_mcp_tool
  if (args.Arguments && typeof args.Arguments === "object") {
    const nestedOverwrites: Record<string, any> = {};
    for (const [nestedKey, nestedValue] of Object.entries(args.Arguments)) {
      if (typeof nestedValue === "string" && (PATH_ARG_KEYS.has(nestedKey) || NESTED_PATH_KEY_REGEX.test(nestedKey))) {
        const { cleaned, changed } = cleanPath(nestedValue, baseWorkspace);
        if (changed) {
          nestedOverwrites[nestedKey] = cleaned;
          changes.push(`Sanitized path in nested 'Arguments.${nestedKey}': '${cleaned}'`);
        }
      }
    }
    if (Object.keys(nestedOverwrites).length > 0) {
      overwrittenArgs.Arguments = { ...args.Arguments, ...nestedOverwrites };
    }
  }

  // 2. Sanitización de Comandos (run_command)
  if (toolName.toLowerCase().includes("run_command") && typeof args.CommandLine === "string") {
    let cmd = args.CommandLine.trim();

    // Normalizar llamadas a python3 en Windows
    if (process.platform === "win32" && /^python3(\s+|$)/i.test(cmd)) {
      cmd = cmd.replace(/^python3(\s+|$)/i, "python$1");
      changes.push("Normalized 'python3' to 'python' on Windows");
    }

    if (cmd !== args.CommandLine) {
      overwrittenArgs.CommandLine = cmd;
    }
  }

  return {
    sanitized: changes.length > 0,
    overwrittenArgs,
    changes,
  };
}
