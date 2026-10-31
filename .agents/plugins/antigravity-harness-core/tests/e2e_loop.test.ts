import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { TelemetryDB } from "../src/telemetry_db";

/**
 * Ejercita el bucle tal como lo ejecuta agy: procesos reales con cwd = carpeta de hooks.json,
 * el payload observado en agy 1.3.1 y un transcript que recibe el resultado después de
 * PostToolUse. A diferencia de verify_recursive_loop.ts, aquí nada está simulado por dentro.
 */
const PLUGIN_ROOT = resolve(import.meta.dir, "..");
const E2E_TIMEOUT_MS = 90_000;

describe("Harness³ E2E: bucle de auto-mejora con hooks reales", () => {
  let sandbox: string;
  let dataDir: string;
  let stepCounter: number;

  const makeWorkspace = (name: string) => {
    const ws = join(sandbox, name);
    mkdirSync(join(ws, ".agents", "skills", "systems-auditor", "rules"), { recursive: true });
    return ws.replace(/\\/g, "/");
  };

  const env = () => {
    const vars: Record<string, string | undefined> = { ...process.env, PLUGIN_DATA: dataDir, USERPROFILE: sandbox, HOME: sandbox };
    delete vars.TOOL_COUNTER_FILE;
    return vars as Record<string, string>;
  };

  const runHook = (hook: string, payload: Record<string, unknown>, cwd = PLUGIN_ROOT) => {
    const proc = spawnSync("bun", ["run", "./src/hook_entry.ts", hook], {
      cwd,
      input: JSON.stringify(payload),
      encoding: "utf-8",
      env: env(),
    });
    return { status: proc.status, output: JSON.parse(proc.stdout || "null") };
  };

  const common = (ws: string, conversationId: string) => ({
    conversationId,
    workspacePaths: [ws],
    transcriptPath: join(ws, "transcript_full.jsonl"),
  });

  /** Un ciclo completo de run_command: agy entrega error "" y escribe el exit code más tarde. */
  const runCommand = (ws: string, conversationId: string, commandLine: string, exitCode: number, output = "") => {
    const stepIdx = ++stepCounter;
    const base = { ...common(ws, conversationId), stepIdx, toolCall: { name: "run_command", args: { CommandLine: commandLine } } };
    const pre = runHook("pre_tool_use", base);
    if (pre.output.decision === "deny") return pre.output;

    runHook("post_tool_use", { ...base, error: "" });
    appendFileSync(base.transcriptPath, `${JSON.stringify({
      step_index: stepIdx,
      source: "MODEL",
      type: "GENERIC",
      status: "DONE",
      content: `Created At: x\nCompleted At: y\n\nThe command exited with code ${exitCode}.\nOutput:\n${output}`,
    })}\n`);
    runHook("post_invocation", common(ws, conversationId));
    return pre.output;
  };

  const counterState = (ws: string, conversationId: string) =>
    JSON.parse(readFileSync(join(ws, "_workspace", "tool_counters", `${conversationId}.json`), "utf-8"));

  const heuristicsOf = (ws: string) => {
    const skillsDir = join(ws, ".agents", "skills");
    return readdirSync(skillsDir)
      .map((skill) => join(skillsDir, skill, "rules", "learned_heuristics.md"))
      .filter(existsSync)
      .map((file) => readFileSync(file, "utf-8"))
      .join("\n");
  };

  const MISSING_RUSTC = "rustc : El término 'rustc' no se reconoce como nombre de un cmdlet, función, archivo de script o programa ejecutable.";

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "harness-e2e-"));
    dataDir = join(sandbox, "plugin-data");
    mkdirSync(dataDir, { recursive: true });
    stepCounter = 1;
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  test("Un comando que falla con error vacío se detecta, se aprende y se entrega al agente", () => {
    const ws = makeWorkspace("ws");

    runCommand(ws, "conv-1", "rustc --version", 1, MISSING_RUSTC);
    expect(counterState(ws, "conv-1").consecutive_failures["run_command:rustc"]).toBe(1);
    expect(heuristicsOf(ws)).not.toContain("rustc");

    runCommand(ws, "conv-1", "rustc --version", 1, MISSING_RUSTC);
    expect(heuristicsOf(ws)).toContain("El comando 'rustc' no está disponible");

    // La regla se escribió en el workspace, no en la carpeta del plugin (cwd del hook)
    expect(existsSync(join(PLUGIN_ROOT, ".agents"))).toBe(false);
    expect(existsSync(join(PLUGIN_ROOT, "_workspace"))).toBe(false);

    // Turno siguiente: el agente recibe el aviso una vez y la regla en cada invocación
    const next = runHook("pre_invocation", { ...common(ws, "conv-1"), invocationNum: 3 }).output.injectSteps[0].ephemeralMessage;
    expect(next).toContain("[HARNESS AUTO-HEAL]");
    expect(next).toContain("rustc");

    const later = runHook("pre_invocation", { ...common(ws, "conv-1"), invocationNum: 4 }).output.injectSteps[0].ephemeralMessage;
    expect(later).not.toContain("[HARNESS AUTO-HEAL]");
    expect(later).toContain("rustc");
  }, E2E_TIMEOUT_MS);

  test("El breaker abre solo para ese comando y un nuevo turno humano lo cierra", () => {
    const ws = makeWorkspace("ws");
    for (let i = 0; i < 3; i++) runCommand(ws, "conv-1", "rustc --version", 1, MISSING_RUSTC);

    const denied = runCommand(ws, "conv-1", "rustc main.rs", 1, MISSING_RUSTC);
    expect(denied.decision).toBe("deny");
    expect(denied.reason).toContain("CIRCUIT_BREAKER_BLOCKED");
    expect(runCommand(ws, "conv-1", "git status", 0).decision).toBe("allow");

    // Otra conversación no hereda el bloqueo
    expect(runCommand(ws, "conv-2", "rustc main.rs", 1, MISSING_RUSTC).decision).toBe("allow");

    runHook("pre_invocation", { ...common(ws, "conv-1"), invocationNum: 0 });
    expect(runCommand(ws, "conv-1", "rustc main.rs", 1, MISSING_RUSTC).decision).toBe("allow");
  }, E2E_TIMEOUT_MS);

  test("Un fallo que se repite con evidencia de código no contamina las heurísticas", () => {
    const ws = makeWorkspace("ws");
    for (let i = 0; i < 2; i++) runCommand(ws, "conv-1", "node app.js", 1, "TypeError: x is not a function");
    expect(heuristicsOf(ws)).toBe("");
  }, E2E_TIMEOUT_MS);

  test("Un bucle de pruebas fallidas es visible para el anti-loop y bloquea reejecutar sin cambios", () => {
    const ws = makeWorkspace("ws");
    for (let i = 0; i < 3; i++) runCommand(ws, "conv-1", "bun test", 1, "1 fail");

    const state = counterState(ws, "conv-1");
    expect(state.last_test_passed).toBe(false);
    expect(state.consecutive_test_failures).toBe(3);

    const notice = runHook("pre_invocation", { ...common(ws, "conv-1"), invocationNum: 5 }).output.injectSteps[0].ephemeralMessage;
    expect(notice).toContain("[HARNESS ANTI-LOOP]");
    expect(runCommand(ws, "conv-1", "bun test", 1, "1 fail").decision).toBe("deny");
  }, E2E_TIMEOUT_MS);

  test("El Stop Guardian exige tests en verde solo si la sesión editó código", () => {
    const ws = makeWorkspace("ws");
    const stop = { ...common(ws, "conv-1"), terminationReason: "NO_TOOL_CALL", fullyIdle: true };

    expect(runHook("stop_guardian", stop).output.decision).toBe("allow");

    const edit = { ...common(ws, "conv-1"), stepIdx: ++stepCounter, toolCall: { name: "write_to_file", args: { TargetFile: `${ws}/src/app.ts` } } };
    runHook("post_tool_use", { ...edit, error: "" });
    expect(runHook("stop_guardian", stop).output.decision).toBe("continue");

    runCommand(ws, "conv-1", "bun test", 0);
    expect(runHook("stop_guardian", stop).output.decision).toBe("allow");
  }, E2E_TIMEOUT_MS);

  test("Una regla que evita el fallo en varios workspaces se promociona a todos", () => {
    for (const name of ["a", "b", "c"]) {
      const ws = makeWorkspace(name);
      for (let i = 0; i < 2; i++) runCommand(ws, `learn-${name}`, "rustc --version", 1, MISSING_RUSTC);

      // Sesión posterior: la herramienta se usa y el fallo no reaparece
      runCommand(ws, `verify-${name}`, "cargo --version", 0);
      runHook("stop_guardian", { ...common(ws, `verify-${name}`), terminationReason: "NO_TOOL_CALL", fullyIdle: true });
    }

    const telemetry = new TelemetryDB(join(dataDir, "telemetry.db"));
    const promoted = telemetry.getPromotedHeuristics(5);
    telemetry.close();
    expect(promoted.length).toBe(1);
    expect(promoted[0].rule_text).toContain("rustc");

    const fresh = makeWorkspace("nuevo");
    const message = runHook("pre_invocation", { ...common(fresh, "conv-x"), invocationNum: 1 }).output.injectSteps[0].ephemeralMessage;
    expect(message).toContain("(promoted:");
  }, E2E_TIMEOUT_MS);

  test("Si el arnés no carga, el hook responde en modo seguro y avisa al agente en vez de bloquearlo", () => {
    const ws = makeWorkspace("ws");
    const broken = join(sandbox, "broken-plugin");
    mkdirSync(join(broken, "src"), { recursive: true });
    copyFileSync(join(PLUGIN_ROOT, "src", "hook_entry.ts"), join(broken, "src", "hook_entry.ts"));
    writeFileSync(join(broken, "src", "pre_tool_use.ts"), "import { nada } from './no_existe';\nexport const handlePreToolUse = nada;\n");

    const payload = { ...common(ws, "conv-1"), stepIdx: 2, toolCall: { name: "send_message", args: {} } };
    const res = runHook("pre_tool_use", payload, broken);

    expect(res.status).toBe(0);
    expect(res.output).toEqual({ decision: "allow" });
    expect(readFileSync(join(ws, "_workspace", "harness_notices.log"), "utf-8")).toContain("[HARNESS DEGRADED]");
  }, E2E_TIMEOUT_MS);
});
