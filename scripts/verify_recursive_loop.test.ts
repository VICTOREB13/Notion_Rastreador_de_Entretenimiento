import { describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  autoHealFromFailure,
  classifyRootCause,
  executeSimulatedTask,
  FIFOHeuristicsManager,
  heuristicKey,
  inferSkillFromContext,
  runRecursiveSelfImprovementCycle,
  synthesizeHeuristicRule,
  type TaskContext,
} from "./verify_recursive_loop.js";

describe("Demostración Aislada: Bucle de Auto-Mejora Recursiva (Harness² Loop)", () => {
  describe("1. Clasificación Determinista de Causa Raíz (Root Cause Diagnosis)", () => {
    it("clasifica como 'Harness Defect' cuando el Circuit Breaker bloquea la ejecución", () => {
      const res = classifyRootCause({
        error: "CIRCUIT_BREAKER_BLOCKED: Se han ejecutado 14 herramientas consecutivas sin validar la suite de pruebas.",
        tool: "run_command",
        breakerTriggered: true,
      });
      expect(res).toBe("Harness Defect");
    });

    it("clasifica como 'Harness Defect' ante fallos repetitivos y anti-loop triggers", () => {
      const res = classifyRootCause({
        error: "Error operacional recurrente en herramienta",
        tool: "view_file",
        consecutiveFails: 3,
        loopDetected: true,
      });
      expect(res).toBe("Harness Defect");
    });

    it("clasifica como 'Harness Defect' ante errores de infraestructura conocidos como sqlite_busy o contract drift", () => {
      const res = classifyRootCause({
        error: "sqlite_busy database is locked",
        tool: "run_command",
      });
      expect(res).toBe("Harness Defect");
    });

    it("clasifica como 'Code Defect' ante fallos sintácticos o aserciones de lógica de negocio", () => {
      const res = classifyRootCause({
        error: "TypeError: Cannot read properties of undefined (reading 'calculateTotal')",
        tool: "run_command",
      });
      expect(res).toBe("Code Defect");
    });

    it("clasifica como 'Clean Execution' cuando no existen errores", () => {
      const res = classifyRootCause({
        error: "",
        tool: "run_command",
      });
      expect(res).toBe("Clean Execution");
    });
  });

  describe("2. Gestor FIFO de Heurísticas Aprendidas (Harness² FIFO Manager)", () => {
    it("crea un estado serializado válido conforme a artifact-standards", () => {
      const manager = new FIFOHeuristicsManager("backend-architect", [
        "- [H-01] Validar siempre IDs positivos antes de consultar la BD.",
      ]);
      const content = manager.serialize("2026-10-26");
      expect(content).toContain("tipo: learned_heuristics");
      expect(content).toContain("skill: backend-architect");
      expect(content).toContain("reglas_count: 1");
      expect(content).toContain("fecha_actualizacion: 2026-10-26");

      const validation = manager.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("mantiene estrictamente el límite de 10 reglas expulsando la más antigua (FIFO)", () => {
      const manager = new FIFOHeuristicsManager("backend-architect");
      for (let i = 1; i <= 10; i++) {
        manager.injectRule(`Regla inicial número ${i}`);
      }
      expect(manager.getRules()).toHaveLength(10);
      expect(manager.getRules()[0]).toContain("Regla inicial número 1");

      // Inyectar regla 11 -> debe expulsar Regla 1
      const injection = manager.injectRule("Regla número 11 que supera el umbral");
      expect(injection.totalRules).toBe(10);
      expect(injection.evicted).toContain("Regla inicial número 1");
      expect(manager.getRules()[0]).toContain("Regla inicial número 2");
      expect(manager.getRules()[9]).toContain("Regla número 11");

      const validation = manager.validate();
      expect(validation.valid).toBe(true);
    });

    it("respeta el límite de 30 líneas totales en el archivo (Presupuesto de Entropía)", () => {
      const manager = new FIFOHeuristicsManager("backend-architect");
      for (let i = 1; i <= 10; i++) {
        manager.injectRule(`Regla detallada con descripción amplia #${i}`);
      }
      const serialized = manager.serialize();
      const lineCount = serialized.split(/\r?\n/).length;
      expect(lineCount).toBeLessThanOrEqual(30);

      const validation = manager.validate();
      expect(validation.valid).toBe(true);
    });

    it("escribe y carga desde archivo real en disco de forma segura", () => {
      const testDir = join(tmpdir(), `harness-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(testDir, { recursive: true });
      const testFile = join(testDir, "learned_heuristics.md");

      try {
        const manager = new FIFOHeuristicsManager("frontend-ui", [], testFile);
        manager.injectRule("Regla de testing en disco persistente");

        expect(existsSync(testFile)).toBe(true);
        const reloaded = FIFOHeuristicsManager.fromFile(testFile);
        expect(reloaded.getSkill()).toBe("frontend-ui");
        expect(reloaded.getRules()).toHaveLength(1);
        expect(reloaded.getRules()[0]).toContain("Regla de testing en disco persistente");
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("3. Simulación del Bucle Completo de Auto-Mejora Recursiva", () => {
    it("falla en Turno 1 por defecto de arnés, aprende la heurística y triunfa en Turno 2 (100% Green)", () => {
      const customTask: TaskContext = {
        id: "TEST-HARNESS-CONCURRENCY",
        skill: "backend-architect",
        description: "Control de transacciones concurrentes en base de datos SQLite",
        pitfall: "sqlite_busy database is locked sin reintentos automáticos ni busy_timeout",
        requiredHeuristicPattern: /busy_timeout/i,
      };

      const result = runRecursiveSelfImprovementCycle({
        task: customTask,
        initialRules: [],
      });

      expect(result.success).toBe(true);
      expect(result.initialClassification).toBe("Harness Defect");
      expect(result.validationPassed).toBe(true);
      expect(result.finalExecutionPassed).toBe(true);
      expect(result.updatedHeuristicsCount).toBe(1);
      expect(result.cycleTraces).toHaveLength(5);

      // Paso 1: Falla inicial
      expect(result.cycleTraces[0].status).toBe("FAIL");
      // Paso 2: Diagnóstico
      expect(result.cycleTraces[1].status).toBe("PASS");
      // Paso 3: Inyección
      expect(result.cycleTraces[2].status).toBe("PASS");
      // Paso 4: Validación de esquema y entropía
      expect(result.cycleTraces[3].status).toBe("PASS");
      // Paso 5: Optimizado en Turno 2
      expect(result.cycleTraces[4].status).toBe("OPTIMIZED");
    });
  });

  describe("4. Invocación de CLI y Salida Determinista", () => {
    it("se ejecuta exitosamente desde terminal y emite código de salida 0", () => {
      const output = execSync("bun scripts/verify_recursive_loop.ts", { encoding: "utf-8" });
      expect(output).toContain("DEMOSTRACIÓN AISLADA: BUCLE DE AUTO-MEJORA RECURSIVA");
      expect(output).toContain("✅ 100% OPERATIVO EN TURNO 2");
    });

    it("emite JSON estructurado válido con --json", () => {
      const output = execSync("bun scripts/verify_recursive_loop.ts --json", { encoding: "utf-8" });
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.validationPassed).toBe(true);
      expect(parsed.finalExecutionPassed).toBe(true);
      expect(parsed.cycleTraces).toBeArray();
    });
  });

  describe("5. Auto-Sanación en Caliente (autoHealFromFailure & Opción A)", () => {
    it("infiere el skill canónico correcto a partir del contexto del fallo", () => {
      expect(inferSkillFromContext("run_command", "sqlite_busy database is locked")).toBe("backend-architect");
      expect(inferSkillFromContext("view_file", "Tailwind DOM budget exceeded")).toBe("frontend-ui");
      expect(inferSkillFromContext("run_command", "git worktree failed junction")).toBe("devops-engineer");
      expect(inferSkillFromContext("run_command", "CIRCUIT_BREAKER_BLOCKED 14 herramientas")).toBe("systems-auditor");
      expect(inferSkillFromContext("run_command", "task.md milestone issue")).toBe("project-planner");
      expect(inferSkillFromContext("run_command", "schema frontmatter invalid snake_case")).toBe("artifact-standards");
    });

    it("sintetiza heurísticas precisas según la anomalía detectada", () => {
      expect(synthesizeHeuristicRule("view_file", "", "12 lecturas secuenciales consecutivas")).toContain("priorizar 'grep_search'");
      expect(synthesizeHeuristicRule("run_command", "", "14 herramientas sin validar la suite")).toContain("runner nativo de pruebas");
      expect(synthesizeHeuristicRule("run_command", "sqlite_busy")).toContain("busy_timeout = 5000");
      expect(synthesizeHeuristicRule("run_command", "contract drift detected")).toContain("bun run lint:contracts");
      expect(synthesizeHeuristicRule("unstable_tool", "", "fallos consecutivos")).toContain("pausar y auditar precondiciones");
    });

    it("autoHealFromFailure inyecta heurística determinista ante Harness Defect y respeta el presupuesto", () => {
      const testDir = join(tmpdir(), `auto-heal-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(testDir, { recursive: true });
      const testHeuristicsFile = join(testDir, "learned_heuristics.md");

      try {
        const result = autoHealFromFailure({
          tool: "run_command",
          error: "sqlite_busy database is locked",
          consecutiveFails: 2,
          customPath: testHeuristicsFile,
          skill: "backend-architect",
        });

        expect(result.triggered).toBe(true);
        expect(result.defectType).toBe("Harness Defect");
        expect(result.healed).toBe(true);
        expect(result.injectedRule).not.toBeNull();
        expect(result.injectedRule!).toContain("busy_timeout");
        expect(result.feedbackMessage).toContain("[HARNESS AUTO-HEAL]");
        expect(existsSync(testHeuristicsFile)).toBe(true);

        const content = readFileSync(testHeuristicsFile, "utf-8");
        expect(content).toContain("busy_timeout");

        // Intentar reinyectar la misma regla: no debe duplicar (anti-duplication guard)
        const reResult = autoHealFromFailure({
          tool: "run_command",
          error: "sqlite_busy database is locked",
          consecutiveFails: 2,
          customPath: testHeuristicsFile,
          skill: "backend-architect",
        });
        expect(reResult.healed).toBe(true);
        expect(reResult.alreadyPresent).toBe(true);
        expect(reResult.injectedRule).toBeNull();
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("no ejecuta auto-sanación ante fallos de código de negocio (Code Defect aislado)", () => {
      const result = autoHealFromFailure({
        tool: "run_command",
        error: "AssertionError: expected true to be false",
        consecutiveFails: 1,
        breakerBlocked: false,
      });

      expect(result.triggered).toBe(false);
      expect(result.defectType).toBe("Code Defect");
      expect(result.healed).toBe(false);
    });

    it("se puede ejecutar directamente vía CLI con flag --auto-heal", () => {
      const testDir = join(tmpdir(), `auto-heal-cli-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const testFile = join(testDir, "learned_heuristics.md");

      try {
        const output = execSync(
          `bun scripts/verify_recursive_loop.ts --auto-heal --tool run_command --error "sqlite_busy" --fails 2 --path "${testFile}" --skill backend-architect --json`,
          { encoding: "utf-8" }
        );
        const parsed = JSON.parse(output);
        expect(parsed.triggered).toBe(true);
        expect(parsed.healed).toBe(true);
        expect(parsed.defectType).toBe("Harness Defect");
        expect(existsSync(testFile)).toBe(true);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("la evidencia de código prevalece sobre la repetición del fallo", () => {
      expect(classifyRootCause({ error: "TypeError: x is not a function", consecutiveFails: 5 })).toBe("Code Defect");
      expect(classifyRootCause({ error: "12 tests failed", consecutiveFails: 2 })).toBe("Code Defect");
      expect(classifyRootCause({ error: "exit 1", consecutiveFails: 2 })).toBe("Harness Defect");
      expect(classifyRootCause({ error: "rustc: command not found", consecutiveFails: 1 })).toBe("Harness Defect");
    });

    it("no infiere skills por subcadenas accidentales", () => {
      expect(inferSkillFromContext("run_command", "digit overflow while explaining the plant")).toBe("systems-auditor");
    });

    it("sintetiza reglas concretas y rechaza las genéricas", () => {
      expect(synthesizeHeuristicRule("run_command", "rustc : El término 'rustc' no se reconoce como nombre")).toContain("'rustc'");
      expect(synthesizeHeuristicRule("view_file", "file does not exist")).toContain("find_by_name");
      expect(synthesizeHeuristicRule("run_command", "exit 1:")).toBeNull();
    });

    it("no inyecta nada ante un fallo repetido sin patrón accionable", () => {
      const testDir = join(tmpdir(), `auto-heal-generic-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const file = join(testDir, "learned_heuristics.md");
      try {
        const result = autoHealFromFailure({ tool: "run_command", error: "exit 1:", consecutiveFails: 3, customPath: file, skill: "systems-auditor" });
        expect(result.defectType).toBe("Harness Defect");
        expect(result.healed).toBe(false);
        expect(existsSync(file)).toBe(false);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("una regla que se repite sobrevive al FIFO y los ids no colisionan tras desalojar", () => {
      const testDir = join(tmpdir(), `auto-heal-lru-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const file = join(testDir, "learned_heuristics.md");
      const heal = (ruleSuggestion: string) =>
        autoHealFromFailure({ tool: "t", error: "sqlite_busy", consecutiveFails: 2, customPath: file, skill: "systems-auditor", ruleSuggestion });

      try {
        for (let i = 1; i <= 10; i++) heal(`Regla número ${i} del presupuesto`);
        heal("Regla número 1 del presupuesto");
        heal("Regla nueva que fuerza un desalojo");

        const rules = FIFOHeuristicsManager.fromFile(file).getRules();
        expect(rules.length).toBe(10);
        expect(rules.some((r) => r.includes("Regla número 1 del presupuesto"))).toBe(true);
        expect(rules.some((r) => r.includes("Regla número 2 del presupuesto"))).toBe(false);

        const ids = rules.map((r) => r.match(/\[H-(\d+)\]/)![1]);
        expect(new Set(ids).size).toBe(ids.length);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("no escribe en disco una regla que rompería el esquema", () => {
      const testDir = join(tmpdir(), `auto-heal-invalid-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const file = join(testDir, "learned_heuristics.md");
      try {
        const manager = new FIFOHeuristicsManager("backend-architect", [], file);
        const res = manager.injectRule("Regla\n```mermaid\ngraph TD\n```", "fecha-invalida");
        expect(res.valid).toBe(false);
        expect(existsSync(file)).toBe(false);
        expect(manager.getRules().length).toBe(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("conserva reglas escritas después de un separador en el cuerpo", () => {
      const content = "---\ntipo: learned_heuristics\nskill: backend-architect\n---\n\n- [H-01] Primera\n\n---\n\n- [H-02] Segunda\n";
      expect(FIFOHeuristicsManager.fromContent(content).getRules().length).toBe(2);
    });

    it("la clave de una regla es estable entre archivos y skills distintas", () => {
      expect(heuristicKey("backend-architect", "- [H-01] Usar WAL")).toBe(heuristicKey("backend-architect", "1. [H-07]: Usar WAL"));
      expect(heuristicKey("backend-architect", "Usar WAL")).not.toBe(heuristicKey("frontend-ui", "Usar WAL"));
    });
  });
});
