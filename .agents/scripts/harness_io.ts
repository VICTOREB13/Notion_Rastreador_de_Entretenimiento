import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Escritura atómica (tmp + rename). En Windows el rename falla con EPERM/EBUSY si otro
 * proceso tiene el destino abierto: se reintenta y, en último caso, se escribe directo.
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, content, "utf-8");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      renameSync(tmp, filePath);
      return;
    } catch {
      sleepSync(10 * (attempt + 1));
    }
  }
  writeFileSync(filePath, content, "utf-8");
  try { unlinkSync(tmp); } catch {}
}

/**
 * Exclusión mutua entre procesos de hook para ciclos leer-modificar-escribir.
 * Si el lock no se obtiene a tiempo se continúa sin él: perder una regla es
 * preferible a agotar el timeout del hook (que bloquearía la herramienta).
 */
export function withFileLock<T>(targetPath: string, fn: () => T, staleMs = 5000): T {
  const lockPath = `${targetPath}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + 1500;
  let acquired = false;

  while (!acquired) {
    try {
      closeSync(openSync(lockPath, "wx"));
      acquired = true;
    } catch {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > staleMs) unlinkSync(lockPath);
      } catch {}
      if (Date.now() > deadline) break;
      sleepSync(15);
    }
  }

  try {
    return fn();
  } finally {
    if (acquired) {
      try { unlinkSync(lockPath); } catch {}
    }
  }
}

/**
 * Raíz real del workspace. Los hooks corren con cwd = carpeta de hooks.json (el plugin),
 * así que process.cwd() nunca debe usarse directamente para localizar estado o skills.
 */
export function resolveWorkspaceRoot(payload?: { workspacePaths?: string[] } | null): string {
  const fromPayload = payload?.workspacePaths?.[0];
  if (fromPayload) return resolve(fromPayload);
  const cwd = process.cwd();
  const pluginMatch = cwd.match(/^(.*)[/\\]\.agents[/\\]plugins[/\\][^/\\]+$/);
  return pluginMatch ? resolve(pluginMatch[1]) : cwd;
}

/**
 * Estado del breaker aislado por conversación: subagentes concurrentes no se contaminan
 * ni heredan bloqueos de sesiones anteriores. TOOL_COUNTER_FILE sigue teniendo prioridad.
 */
export function resolveCounterPath(workspaceRoot: string, conversationId?: string): string {
  if (process.env.TOOL_COUNTER_FILE) return resolve(process.env.TOOL_COUNTER_FILE);
  if (conversationId) {
    return join(workspaceRoot, "_workspace", "tool_counters", `${conversationId.replace(/[^\w.-]/g, "_")}.json`);
  }
  return join(workspaceRoot, "_workspace", "tool_counter.json");
}

const noticesPath = (workspaceRoot: string) => join(workspaceRoot, "_workspace", "harness_notices.log");

/** Encola un aviso para el agente: PostToolUse no puede devolver contenido, PreInvocation sí. */
export function pushNotice(workspaceRoot: string, message: string): void {
  try {
    mkdirSync(join(workspaceRoot, "_workspace"), { recursive: true });
    appendFileSync(noticesPath(workspaceRoot), `${message.replace(/\s*\r?\n\s*/g, " ").slice(0, 400)}\n`, "utf-8");
  } catch {}
}

export function drainNotices(workspaceRoot: string, max = 5): string[] {
  const path = noticesPath(workspaceRoot);
  if (!existsSync(path)) return [];
  const draining = `${path}.${process.pid}.draining`;
  try {
    renameSync(path, draining);
    const lines = readFileSync(draining, "utf-8").split(/\r?\n/).filter((l) => l.trim().length > 0);
    unlinkSync(draining);
    return [...new Set(lines)].slice(-max);
  } catch {
    return [];
  }
}

export function pruneOldFiles(dir: string, maxAgeDays: number): number {
  if (!existsSync(dir)) return 0;
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    try {
      const full = join(dir, name);
      if (statSync(full).mtimeMs < cutoff) {
        unlinkSync(full);
        removed++;
      }
    } catch {}
  }
  return removed;
}

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{16,}/g, "<redacted>"],
  [/\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}/g, "<redacted>"],
  [/\bAIza[A-Za-z0-9_-]{20,}/g, "<redacted>"],
  [/\bxox[abps]-[A-Za-z0-9-]{10,}/g, "<redacted>"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer <redacted>"],
  [/\b(password|passwd|pwd|secret|token|api[_-]?key)(\s*[=:]\s*)\S+/gi, "$1$2<redacted>"],
];

/** La telemetría es global y persistente: nunca debe guardar credenciales de un error. */
export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}
