#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateArtifactContent } from "../.agents/skills/artifact-standards/scripts/validate_artifact.js";

export type DefectType = "Harness Defect" | "Code Defect" | "Clean Execution";

export interface FailureSignal {
  error: string;
  tool?: string;
  stepContent?: string;
  breakerTriggered?: boolean;
  loopDetected?: boolean;
  consecutiveFails?: number;
}

export interface TaskContext {
  id: string;
  skill: string;
  description: string;
  pitfall: string;
  requiredHeuristicPattern: RegExp;
}

export interface CycleStepTrace {
  step: number;
  phase: string;
  status: "FAIL" | "PASS" | "OPTIMIZED";
  details: string;
  metadata?: Record<string, any>;
}

export interface RecursiveLoopResult {
  success: boolean;
  task: TaskContext;
  cycleTraces: CycleStepTrace[];
  initialClassification: DefectType;
  injectedRule: string;
  updatedHeuristicsCount: number;
  validationPassed: boolean;
  finalExecutionPassed: boolean;
}

export interface AutoHealParams {
  tool: string;
  error?: string;
  stepContent?: string;
  consecutiveFails?: number;
  breakerBlocked?: boolean;
  breakerReason?: string;
  skill?: string;
  customPath?: string;
  ruleSuggestion?: string;
  currentDate?: string;
}

export interface AutoHealResult {
  triggered: boolean;
  defectType: DefectType;
  healed: boolean;
  skill: string;
  injectedRule: string | null;
  evictedRule: string | null;
  filePath: string;
  feedbackMessage: string;
  alreadyPresent?: boolean;
}

/**
 * 1. Clasificación determinista de causa raíz (Root Cause Diagnosis)
 * Separa fallas intrínsecas del código de fallas del arnés o contexto del agente.
 */
export function classifyRootCause(signal: FailureSignal): DefectType {
  const combinedText = `${signal.error} ${signal.stepContent || ""}`.toLowerCase();

  // Señales directas de Defecto de Arnés (Harness Defect)
  if (
    signal.breakerTriggered ||
    signal.loopDetected ||
    (signal.consecutiveFails && signal.consecutiveFails >= 2) ||
    combinedText.includes("circuit_breaker_blocked") ||
    combinedText.includes('"decision":"block"') ||
    combinedText.includes('"decision": "block"') ||
    combinedText.includes('"decision":"deny"') ||
    combinedText.includes('"decision": "deny"') ||
    combinedText.includes("anti-loop") ||
    combinedText.includes("prompt drift") ||
    combinedText.includes("timeout no configurado") ||
    combinedText.includes("sqlite_busy") ||
    combinedText.includes("missing mock") ||
    combinedText.includes("drift guard") ||
    combinedText.includes("contract drift") ||
    combinedText.includes("api_spec.md mismatch") ||
    combinedText.includes("presupuesto de entropía")
  ) {
    return "Harness Defect";
  }

  // Si no hay fallas
  if (!signal.error && !signal.stepContent) {
    return "Clean Execution";
  }

  // Falla de código (Code Defect): errores sintácticos, asserts de tests unitarios de negocio
  return "Code Defect";
}

/**
 * 2. Gestor FIFO de Heurísticas Aprendidas (Harness² FIFO Manager)
 * Respeta el límite duro de 30 líneas y 10 reglas máximas bajo política FIFO.
 */
export class FIFOHeuristicsManager {
  private skill: string;
  private rules: string[];
  private targetPath?: string;

  constructor(skill: string, initialRules: string[] = [], targetPath?: string) {
    this.skill = skill;
    this.rules = [...initialRules];
    this.targetPath = targetPath;
  }

  static fromFile(filePath: string, fallbackSkill?: string): FIFOHeuristicsManager {
    if (!existsSync(filePath)) {
      const match = filePath.match(/skills[/\\]([^/\\]+)[/\\]rules/);
      const skill = fallbackSkill || (match ? match[1] : "general");
      return new FIFOHeuristicsManager(skill, [], filePath);
    }
    const content = readFileSync(filePath, "utf-8");
    return FIFOHeuristicsManager.fromContent(content, filePath, fallbackSkill);
  }

  static fromContent(content: string, targetPath?: string, fallbackSkill?: string): FIFOHeuristicsManager {
    const lines = content.split(/\r?\n/);
    let skill = "general";
    const rules: string[] = [];

    // Parse frontmatter
    let inFrontmatter = false;
    let frontmatterDone = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "---") {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          inFrontmatter = false;
          frontmatterDone = true;
          continue;
        }
      }

      if (inFrontmatter) {
        if (trimmed.startsWith("skill:")) {
          skill = trimmed.replace("skill:", "").trim().replace(/^["']|["']$/g, "");
        }
        continue;
      }

      if (frontmatterDone) {
        // Capture rule bullets or numbered list items
        if (/^[-*]\s+\[H-\d+\]/i.test(trimmed) || /^[-*]\s+/i.test(trimmed) || /^\d+\.\s+/i.test(trimmed)) {
          rules.push(trimmed);
        }
      }
    }

    if (skill === "general") {
      if (fallbackSkill) {
        skill = fallbackSkill;
      } else if (targetPath) {
        const match = targetPath.match(/skills[/\\]([^/\\]+)[/\\]rules/);
        if (match) skill = match[1];
      }
    }

    return new FIFOHeuristicsManager(skill, rules, targetPath);
  }

  getRules(): string[] {
    return [...this.rules];
  }

  getSkill(): string {
    return this.skill;
  }

  /**
   * Inyecta una nueva regla en el buffer FIFO.
   * Si excede 10 reglas o 30 líneas, expulsa la regla más antigua.
   */
  injectRule(newRuleText: string, currentDate = "2026-10-26"): { evicted: string | null; totalRules: number; content: string } {
    let evicted: string | null = null;
    const cleanRule = newRuleText.trim();

    // Formatear regla con prefijo si no lo tiene
    let formattedRule = cleanRule;
    if (cleanRule.startsWith("[H-")) {
      formattedRule = `- ${cleanRule}`;
    } else if (!cleanRule.startsWith("- ") && !cleanRule.startsWith("* ") && !/^\d+\./.test(cleanRule)) {
      formattedRule = `- [H-${String(this.rules.length + 1).padStart(2, "0")}] ${cleanRule}`;
    }

    this.rules.push(formattedRule);

    // Regla FIFO 1: Máximo 10 reglas
    while (this.rules.length > 10) {
      evicted = this.rules.shift() || null;
    }

    // Regla FIFO 2: Máximo 30 líneas totales en el archivo serializado
    let serialized = this.serialize(currentDate);
    while (serialized.split(/\r?\n/).length > 30 && this.rules.length > 1) {
      const prevEvicted = this.rules.shift() || null;
      if (!evicted) evicted = prevEvicted;
      serialized = this.serialize(currentDate);
    }

    if (this.targetPath) {
      mkdirSync(dirname(this.targetPath), { recursive: true });
      writeFileSync(this.targetPath, serialized, "utf-8");
    }

    return {
      evicted,
      totalRules: this.rules.length,
      content: serialized,
    };
  }

  serialize(currentDate = "2026-10-26"): string {
    const lines: string[] = [
      "---",
      "tipo: learned_heuristics",
      `skill: ${this.skill}`,
      `reglas_count: ${this.rules.length}`,
      `fecha_actualizacion: ${currentDate}`,
      "---",
      "",
      "# Reglas Heurísticas Aprendidas (Harness² FIFO Cache)",
      "",
      "> **Política FIFO:** Máximo 10 reglas y 30 líneas. Al agregar la regla 11, eliminar la más antigua.",
      "",
    ];

    for (const rule of this.rules) {
      lines.push(rule);
    }

    return lines.join("\n") + "\n";
  }

  validate(): { valid: boolean; errors: string[] } {
    const content = this.serialize();
    return validateArtifactContent(content, { heuristics: true });
  }
}

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
    consecutiveFails: 2, // Desencadena anti-loop
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

/**
 * 5. Inferencia determinista de Skill a partir del contexto del fallo
 */
export function inferSkillFromContext(tool: string, errorText: string): string {
  const text = `${tool} ${errorText}`.toLowerCase();
  if (/breaker|circuit_breaker|anti-loop|audit|odd|playwright|quality gate|test runner|friction|14 herramientas|lecturas/i.test(text)) {
    return "systems-auditor";
  }
  if (/schema|yaml|frontmatter|artifact|wikilink|entropía/i.test(text)) {
    return "artifact-standards";
  }
  if (/sqlite|database|\bdb\b|query|\bsql\b|prisma|eloquent|api_spec|backend|shelf|dio|migration/i.test(text)) {
    return "backend-architect";
  }
  if (/css|html|\bdom\b|\bui\b|tailwind|style|frontend|component|react|flutter ui/i.test(text)) {
    return "frontend-ui";
  }
  if (/docker|\bci\b|\bcd\b|worktree|git|junction|release|devops|deploy/i.test(text)) {
    return "devops-engineer";
  }
  if (/plan|task|milestone|issue|planner|\bsdd\b/i.test(text)) {
    return "project-planner";
  }
  return "systems-auditor";
}

/**
 * 6. Síntesis determinista de Regla Heurística Preventiva
 */
export function synthesizeHeuristicRule(tool: string, errorText: string, breakerReason?: string): string {
  const combined = `${tool} ${errorText} ${breakerReason || ""}`.toLowerCase();

  if (combined.includes("12 lecturas") || combined.includes("lecturas secuenciales") || (tool === "view_file" && combined.includes("block"))) {
    return "Para lecturas extensas o múltiples archivos, priorizar 'grep_search', 'find_by_name' o scripts en scripts/ para evitar agotar el límite de lecturas.";
  }
  if (combined.includes("14 herramientas") || combined.includes("suite de pruebas") || combined.includes("tdd enforcer")) {
    return "Ejecutar el runner nativo de pruebas ('bun test', 'flutter test', etc.) periódicamente para validar TDD y prevenir bloqueos del breaker.";
  }
  if (combined.includes("sqlite_busy") || combined.includes("database is locked")) {
    return "Para mitigar sqlite_busy en SQLite, configurar siempre 'PRAGMA busy_timeout = 5000' y modo WAL antes de operaciones concurrentes.";
  }
  if (combined.includes("contract drift") || combined.includes("api_spec.md mismatch") || combined.includes("drift guard")) {
    return "Alinear contratos en api_spec.md y validar con 'bun run lint:contracts' antes de implementar o refactorizar endpoints.";
  }
  if (combined.includes("consecutivas") || combined.includes("fallos consecutivos") || combined.includes("anti-loop")) {
    return `Al alcanzar 2 fallos consecutivos en '${tool}', pausar y auditar precondiciones en lugar de reintentar en bucle.`;
  }
  return `Verificar precondiciones de arnés y sintaxis de '${tool}' tras fallos operacionales repetidos.`;
}

/**
 * 7. Auto-Sanación en Caliente (Reflejo Silencioso de Arnés / Opción A)
 * Inyecta una heurística preventiva en learned_heuristics.md cuando una herramienta
 * falla consecutivamente (>= 2 fallos) o se dispara el Circuit Breaker.
 */
export function autoHealFromFailure(params: AutoHealParams): AutoHealResult {
  const tool = params.tool || "unknown";
  const errorText = `${params.error || ""} ${params.breakerReason || ""}`.trim();
  const consecutiveFails = params.consecutiveFails ?? 0;
  const breakerBlocked = Boolean(params.breakerBlocked);

  // 1. Diagnóstico de causa raíz
  const failureSignal: FailureSignal = {
    error: errorText,
    tool,
    stepContent: params.stepContent,
    breakerTriggered: breakerBlocked,
    loopDetected: consecutiveFails >= 2,
    consecutiveFails,
  };

  const defectType = classifyRootCause(failureSignal);

  // 2. Si no es un defecto de arnés o no alcanzó el umbral de disparo
  const shouldHeal = breakerBlocked || consecutiveFails >= 2 || defectType === "Harness Defect";
  if (!shouldHeal || defectType !== "Harness Defect") {
    return {
      triggered: false,
      defectType,
      healed: false,
      skill: params.skill || inferSkillFromContext(tool, errorText),
      injectedRule: null,
      evictedRule: null,
      filePath: params.customPath || "",
      feedbackMessage: `[HARNESS AUTO-HEAL] Clasificado como '${defectType}'. No se requiere intervención sobre el arnés.`,
    };
  }

  // 3. Resolver skill y ruta del archivo de heurísticas
  const skill = params.skill || inferSkillFromContext(tool, errorText);
  const targetPath = params.customPath
    ? resolve(params.customPath)
    : resolve(process.cwd(), ".agents", "skills", skill, "rules", "learned_heuristics.md");

  // 4. Sintetizar regla si no se proporcionó una
  const ruleToInject = params.ruleSuggestion || synthesizeHeuristicRule(tool, errorText, params.breakerReason);

  // 5. Cargar gestor FIFO y verificar duplicados
  const manager = FIFOHeuristicsManager.fromFile(targetPath, skill);
  const existingRules = manager.getRules();
  const normalizedNew = ruleToInject.trim().replace(/^[-*]\s+(\[H-\d+\]\s*)?/, "").toLowerCase();

  const isDuplicate = existingRules.some(r => {
    const norm = r.trim().replace(/^[-*]\s+(\[H-\d+\]\s*)?/, "").toLowerCase();
    return norm === normalizedNew || norm.includes(normalizedNew) || normalizedNew.includes(norm);
  });

  if (isDuplicate) {
    return {
      triggered: true,
      defectType,
      healed: true,
      skill,
      injectedRule: null,
      evictedRule: null,
      filePath: targetPath,
      feedbackMessage: `[HARNESS AUTO-HEAL] Heurística preventiva ya activa en ${skill}: "${ruleToInject}".`,
      alreadyPresent: true,
    };
  }

  // 6. Inyectar regla respetando límites FIFO (10 reglas / 30 líneas)
  const currentDate = params.currentDate || new Date().toISOString().slice(0, 10);
  const injection = manager.injectRule(ruleToInject, currentDate);
  const validation = manager.validate();

  if (!validation.valid) {
    return {
      triggered: true,
      defectType,
      healed: false,
      skill,
      injectedRule: ruleToInject,
      evictedRule: injection.evicted,
      filePath: targetPath,
      feedbackMessage: `[HARNESS AUTO-HEAL ERROR] Falló validación de heurísticas: ${validation.errors.join("; ")}`,
    };
  }

  return {
    triggered: true,
    defectType,
    healed: true,
    skill,
    injectedRule: ruleToInject,
    evictedRule: injection.evicted,
    filePath: targetPath,
    feedbackMessage: `[HARNESS AUTO-HEAL] Heurística preventiva inyectada en .agents/skills/${skill}/rules/learned_heuristics.md: "${ruleToInject}" (Reglas: ${injection.totalRules}/10${injection.evicted ? `, desalojada FIFO: '${injection.evicted}'` : ""}).`,
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
