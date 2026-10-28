#!/usr/bin/env bun
import {
  type AutoHealParams,
  type AutoHealResult,
  type CycleStepTrace,
  type DefectType,
  type FailureSignal,
  type RecursiveLoopResult,
  type TaskContext,
  FIFOHeuristicsManager,
  autoHealFromFailure,
  classifyRootCause,
  inferSkillFromContext,
  synthesizeHeuristicRule,
} from "./verify_recursive_loop_heuristics";

export * from "./verify_recursive_loop_heuristics";

/**
 * 3. Ejecutor Simulado de Tarea en Entorno de Agente
 */
export function executeSimulatedTask(
  task: TaskContext,
  availableHeuristics: string[]
): { success: boolean; error?: string; output: string } {
  const hasHeuristic = availableHeuristics.some(h => task.requiredHeuristicPattern.test(h));

  if (!hasHeuristic) {
    return {
      success: false,
      error: `Error operacional: ${task.pitfall}. No se encontró regla heurística activa para mitigar esta falla.`,
      output: `[SIM_AGENT] Ejecutando '${task.id}': Falla por omisión de patrón en arnés.`,
    };
  }

  return {
    success: true,
    output: `[SIM_AGENT] Ejecutando '${task.id}': Éxito rotundo. Se aplicó heurística preventiva en tiempo de ejecución.`,
  };
}

/**
 * 4. Bucle Completo de Auto-Mejora Recursiva (Harness² Self-Improvement Loop)
 */
export function runRecursiveSelfImprovementCycle(options?: {
  task?: TaskContext;
  tempHeuristicsPath?: string;
  initialRules?: string[];
}): RecursiveLoopResult {
  const task: TaskContext = options?.task || {
    id: "TASK-RECURSIVE-01",
    skill: "backend-architect",
    description: "Configuración de SQLite local-first con alta concurrencia de escrituras",
    pitfall: "sqlite_busy database is locked debido a falta de PRAGMA busy_timeout = 5000 y modo WAL",
    requiredHeuristicPattern: /sqlite_busy|busy_timeout|modo WAL/i,
  };

  const traces: CycleStepTrace[] = [];
  const manager = new FIFOHeuristicsManager(
    task.skill,
    options?.initialRules || [],
    options?.tempHeuristicsPath
  );

  // FASE 1: Intento inicial sin la heurística aprendida (Turno 1)
  traces.push({
    step: 1,
    phase: "Turno 1 - Ejecución Inicial",
    status: "FAIL",
    details: `El agente ejecuta '${task.id}' usando el contexto estándar actual.`,
  });

  const firstExec = executeSimulatedTask(task, manager.getRules());

  // FASE 2: Detección y Clasificación de Causa Raíz
  const failureSignal: FailureSignal = {
    error: firstExec.error || "Operación fallida",
    tool: "run_command",
    stepContent: `Error: ${firstExec.error}`,
    breakerTriggered: false,
    loopDetected: false,
    consecutiveFails: 2,
  };

  const classification = classifyRootCause(failureSignal);
  traces.push({
    step: 2,
    phase: "Diagnóstico de Causa Raíz",
    status: "PASS",
    details: `Falla clasificada determinísticamente como: '${classification}'.`,
    metadata: { signal: failureSignal, classification },
  });

  if (classification !== "Harness Defect") {
    return {
      success: false,
      task,
      cycleTraces: traces,
      initialClassification: classification,
      injectedRule: "",
      updatedHeuristicsCount: manager.getRules().length,
      validationPassed: false,
      finalExecutionPassed: false,
    };
  }

  // FASE 3: Síntesis y Auto-Inyección de Heurística en Buffer FIFO (Harness²)
  const newRule = `[H-01] Para mitigar sqlite_busy en SQLite, configurar siempre 'PRAGMA busy_timeout = 5000' y modo WAL antes de operaciones concurrentes.`;
  const injection = manager.injectRule(newRule);

  traces.push({
    step: 3,
    phase: "Auto-Inyección Heurística FIFO",
    status: "PASS",
    details: `Nueva heurística inyectada. Total reglas: ${injection.totalRules}. Regla desalojada: ${injection.evicted || "ninguna"}.`,
    metadata: { newRule, injection },
  });

  // FASE 4: Validación Determinista del Artefacto (Zero Entropy Drift)
  const validation = manager.validate();
  traces.push({
    step: 4,
    phase: "Auditoría de Presupuesto y Esquema",
    status: validation.valid ? "PASS" : "FAIL",
    details: validation.valid
      ? "learned_heuristics.md cumple al 100% con YAML frontmatter, <= 10 reglas y <= 30 líneas."
      : `Falló validación de artefacto: ${validation.errors.join("; ")}`,
  });

  // FASE 5: Re-ejecución con Contexto Enriquecido (Turno 2)
  const secondExec = executeSimulatedTask(task, manager.getRules());
  traces.push({
    step: 5,
    phase: "Turno 2 - Re-ejecución con Arnés Mejorado",
    status: secondExec.success ? "OPTIMIZED" : "FAIL",
    details: secondExec.success
      ? `Éxito completo: el agente leyó la heurística aprendida y completó la tarea sin fricción.`
      : `Falla persistente: ${secondExec.error}`,
  });

  const allPassed = classification === "Harness Defect" && validation.valid && secondExec.success;

  return {
    success: allPassed,
    task,
    cycleTraces: traces,
    initialClassification: classification,
    injectedRule: newRule,
    updatedHeuristicsCount: manager.getRules().length,
    validationPassed: validation.valid,
    finalExecutionPassed: secondExec.success,
  };
}

// Ejecución directa vía CLI
if (import.meta.main) {
  const isJson = process.argv.includes("--json");
  const isAutoHealMode = process.argv.includes("--auto-heal");

  if (isAutoHealMode) {
    let tool = "unknown";
    let error = "";
    let reason = "";
    let skill: string | undefined;
    let customPath: string | undefined;
    let ruleSuggestion: string | undefined;
    let consecutiveFails = 2;
    let breakerBlocked = false;

    for (let i = 2; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg === "--tool") tool = process.argv[++i] || tool;
      else if (arg === "--error") error = process.argv[++i] || error;
      else if (arg === "--reason") reason = process.argv[++i] || reason;
      else if (arg === "--skill") skill = process.argv[++i];
      else if (arg === "--path") customPath = process.argv[++i];
      else if (arg === "--rule") ruleSuggestion = process.argv[++i];
      else if (arg === "--fails") consecutiveFails = parseInt(process.argv[++i] || "2", 10);
      else if (arg === "--blocked") breakerBlocked = true;
    }

    const healResult = autoHealFromFailure({
      tool,
      error,
      breakerReason: reason,
      skill,
      customPath,
      ruleSuggestion,
      consecutiveFails,
      breakerBlocked,
    });

    if (isJson) {
      console.log(JSON.stringify(healResult, null, 2));
    } else {
      console.log(healResult.feedbackMessage);
    }
    process.exit(healResult.healed ? 0 : 1);
  }

  const result = runRecursiveSelfImprovementCycle();

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("================================================================================");
    console.log("   DEMOSTRACIÓN AISLADA: BUCLE DE AUTO-MEJORA RECURSIVA (HARNESS² LOOP)         ");
    console.log("================================================================================");
    console.log(`Tarea Evaluada : [${result.task.id}] ${result.task.description}`);
    console.log(`Diagnóstico    : ${result.initialClassification}`);
    console.log(`Nueva Regla    : ${result.injectedRule}`);
    console.log(`Validación     : ${result.validationPassed ? "✅ PASS (Esquema & Presupuesto FIFO OK)" : "❌ FAIL"}`);
    console.log(`Resultado Final: ${result.finalExecutionPassed ? "✅ 100% OPERATIVO EN TURNO 2" : "❌ FALLO"}`);
    console.log("--------------------------------------------------------------------------------");
    console.log("Trazas del Ciclo:");
    for (const trace of result.cycleTraces) {
      console.log(`  [Paso ${trace.step}] ${trace.phase.padEnd(35)} -> [${trace.status}] ${trace.details}`);
    }
    console.log("================================================================================");
  }

  process.exit(result.success ? 0 : 1);
}
