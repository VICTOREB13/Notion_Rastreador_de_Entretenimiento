import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Bootstrap de hooks. Debe seguir sin imports estáticos del arnés.
 *
 * agy trata un hook que termina con exit != 0 como fallo de la herramienta, incluidas las
 * de la lista blanca. Un import roto o un error de sintaxis en circuit_breaker.ts dejaría
 * al agente sin herramientas y sin poder reparar su propio arnés. Por eso todo se carga
 * con import() dinámico y cualquier fallo degrada a la respuesta segura, avisando al agente.
 */
const HOOKS: Record<string, { file: string; handler: string; safe: Record<string, unknown> }> = {
  session_start: { file: "./session_start.ts", handler: "handleSessionStart", safe: {} },
  pre_invocation: { file: "./pre_invocation.ts", handler: "handlePreInvocation", safe: { injectSteps: [] } },
  pre_tool_use: { file: "./pre_tool_use.ts", handler: "handlePreToolUse", safe: { decision: "allow" } },
  post_tool_use: { file: "./post_tool_use.ts", handler: "handlePostToolUse", safe: {} },
  post_invocation: { file: "./post_invocation.ts", handler: "handlePostInvocation", safe: { injectSteps: [] } },
  stop_guardian: { file: "./stop_guardian.ts", handler: "handleStop", safe: { decision: "allow" } },
};

const name = process.argv[2] ?? "";
const hook = HOOKS[name];
const safeOutput = hook?.safe ?? {};
const WATCHDOG_MS = 12_000;

function finish(output: unknown): never {
  process.stdout.write(JSON.stringify(output ?? safeOutput));
  process.exit(0);
}

function reportDegraded(payload: any, err: unknown): void {
  try {
    const cwd = process.cwd();
    const root = payload?.workspacePaths?.[0] ?? cwd.match(/^(.*)[/\\]\.agents[/\\]plugins[/\\][^/\\]+$/)?.[1] ?? cwd;
    const dir = join(resolve(root), "_workspace");
    const detail = String((err as any)?.message ?? err).replace(/\s*\r?\n\s*/g, " ").slice(0, 280);
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, "harness_notices.log"),
      `[HARNESS DEGRADED] El hook '${name}' falló y operó en modo seguro: ${detail}. Corrija el arnés (bun run test:harness) antes de continuar.\n`,
      "utf-8"
    );
  } catch {}
}

async function main(): Promise<void> {
  setTimeout(() => finish(safeOutput), WATCHDOG_MS);

  let raw = "";
  process.stdin.setEncoding("utf-8");
  for await (const chunk of process.stdin) raw += chunk;

  let payload: any = {};
  try {
    payload = raw.trim() ? JSON.parse(raw) : {};
    if (!hook) throw new Error(`Hook desconocido: '${name}'`);
    const mod = await import(hook.file);
    finish(await mod[hook.handler](payload));
  } catch (err) {
    reportDegraded(payload, err);
    finish(safeOutput);
  }
}

main().catch(() => finish(safeOutput));
