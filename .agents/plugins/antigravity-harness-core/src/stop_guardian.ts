import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { lintContracts } from "../../../../scripts/lint_contracts";

export interface StopPayload {
  executionNum?: number;
  terminationReason?: string;
  error?: string;
  fullyIdle?: boolean;
  workspacePaths?: string[];
  [key: string]: any;
}

export interface StopResponse {
  decision: "allow" | "continue";
  reason?: string;
}

export interface StopGuardianOptions {
  customWorkspace?: string;
  customRetryStatePath?: string;
  customCounterPath?: string;
  skipTestRun?: boolean;
  maxRetries?: number;
}

export function handleStop(payload: StopPayload, options?: StopGuardianOptions): StopResponse {
  // Solo interceptamos cuando el agente intenta finalizar normalmente (NO_TOOL_CALL) y está ocioso
  const reason = payload.terminationReason || "";
  const fullyIdle = payload.fullyIdle !== false;

  if (reason !== "NO_TOOL_CALL" || !fullyIdle) {
    return { decision: "allow" };
  }

  const workspaceRoot = options?.customWorkspace || payload.workspacePaths?.[0] || process.cwd();
  const retryPath = resolve(
    options?.customRetryStatePath || join(workspaceRoot, "_workspace", "stop_guardian_state.json")
  );
  const maxRetries = options?.maxRetries ?? 2;

  // 1. Cargar estado de reintentos del guardián
  let retryCount = 0;
  try {
    if (existsSync(retryPath)) {
      const data = JSON.parse(readFileSync(retryPath, "utf-8"));
      retryCount = typeof data.retryCount === "number" ? data.retryCount : 0;
    }
  } catch {}

  // 2. Anti-Loop: Si ya se forzó la continuación 2 veces, permitir parada para no bloquear al usuario
  if (retryCount >= maxRetries) {
    try {
      if (existsSync(retryPath)) unlinkSync(retryPath);
    } catch {}
    return {
      decision: "allow",
      reason: `[Harness³ Stop Guardian] Se alcanzó el límite de ${maxRetries} reintentos. Terminación permitida.`,
    };
  }

  // 3. Verificación de Quality Gate: Contratos SDD
  const issues: string[] = [];
  const specPath = resolve(workspaceRoot, "artifacts", "architecture", "api_spec.md");

  if (existsSync(specPath)) {
    try {
      const srcCandidateDirs = [resolve(workspaceRoot, "src")];
      for (const d of ["packages", "apps", "lib", "routes", "features"]) {
        const fullD = resolve(workspaceRoot, d);
        if (existsSync(fullD)) {
          srcCandidateDirs.push(fullD);
        }
      }

      const sddRes = lintContracts({
        specFile: specPath,
        srcDirs: srcCandidateDirs,
        allowMissing: false,
      });

      if (!sddRes.valid) {
        if (sddRes.missing.length > 0) {
          issues.push(`Contratos SDD pendientes sin implementar: ${sddRes.missing.join(", ")}`);
        }
        if (sddRes.orphans.length > 0) {
          issues.push(`Endpoints en código huérfanos sin contrato en spec: ${sddRes.orphans.join(", ")}`);
        }
      }
    } catch {}
  }

  // 4. Verificación de Presupuesto TDD
  const counterPath = resolve(
    options?.customCounterPath || join(workspaceRoot, "_workspace", "tool_counter.json")
  );
  if (existsSync(counterPath)) {
    try {
      const counterData = JSON.parse(readFileSync(counterPath, "utf-8"));
      if (counterData.tools_since_last_test_runner >= 14) {
        issues.push(
          `Presupuesto TDD agotado (${counterData.tools_since_last_test_runner} herramientas ejecutadas sin correr tests unitarios). Ejecute 'bun test' para validar la suite.`
        );
      }
    } catch {}
  }

  // 5. Decisión del Guardián
  if (issues.length > 0) {
    const nextRetry = retryCount + 1;
    try {
      const dir = dirname(retryPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(retryPath, JSON.stringify({ retryCount: nextRetry, lastIssues: issues, timestamp: new Date().toISOString() }), "utf-8");
    } catch {}

    return {
      decision: "continue",
      reason: `[HARNESS³ QUALITY GATE GUARDIAN] Se detectaron verificaciones de calidad pendientes antes de concluir (Reintento ${nextRetry}/${maxRetries}):\n` +
        issues.map((i) => ` - ${i}`).join("\n") +
        "\nPor favor aplique el ciclo SDD + TDD para resolver estos pendientes antes de finalizar.",
    };
  }

  // Si todo está en orden, limpiar archivo de reintentos y permitir finalizar
  try {
    if (existsSync(retryPath)) unlinkSync(retryPath);
  } catch {}

  return { decision: "allow" };
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
      const payload: StopPayload = inputData.trim() ? JSON.parse(inputData) : {};
      const res = handleStop(payload);
      process.stdout.write(JSON.stringify(res));
    } catch {
      process.stdout.write(JSON.stringify({ decision: "allow" }));
    }
    process.exit(0);
  });
}
