#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateArtifactContent } from "../.agents/skills/artifact-standards/scripts/validate_artifact.js";
import { atomicWriteFileSync, withFileLock } from "../.agents/scripts/harness_io";

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
  workspaceRoot?: string;
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
  ruleKey?: string;
  ruleText?: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const stripRulePrefix = (rule: string) => rule.trim().replace(/^(?:[-*]|\d+\.)\s+(?:\[H-\d+\]:?\s*)?/, "");

/**
 * Identidad estable de una regla. Los ids H-NN son locales a cada archivo y se repiten entre
 * skills y workspaces: la telemetría cross-workspace necesita una clave derivada del contenido.
 */
export function heuristicKey(skill: string, ruleText: string): string {
  return createHash("sha256").update(`${skill}:${stripRulePrefix(ruleText).toLowerCase()}`).digest("hex").slice(0, 12);
}

// Evidencia de que el fallo está en el código: repetirlo no lo convierte en defecto del arnés.
const CODE_DEFECT_REGEX = /\b(?:syntaxerror|typeerror|referenceerror|rangeerror|assertionerror|expected .{0,80} (?:received|but got)|cannot find name|panic:|traceback \(most recent call last\)|segmentation fault|\d+ (?:tests? )?failed)\b/i;

// Fallos del entorno o del uso de herramientas: el código de la feature no puede resolverlos.
const ENVIRONMENT_DEFECT_REGEX = /no se reconoce como|is not recognized as|command not found|invalid tool call|enoent|file does not exist|no such file or directory|ebusy|eperm|eacces|permission denied|acceso denegado/i;

/**
 * 1. Clasificación determinista de causa raíz (Root Cause Diagnosis)
 * Separa fallas intrínsecas del código de fallas del arnés o contexto del agente.
 */
export function classifyRootCause(signal: FailureSignal): DefectType {
  const combinedText = `${signal.error} ${signal.stepContent || ""}`.toLowerCase();

  // Señales directas de Defecto de Arnés (Harness Defect)
  if (
    signal.breakerTriggered ||
    ENVIRONMENT_DEFECT_REGEX.test(combinedText) ||
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

  // Falla de código (Code Defect): errores sintácticos, asserts de tests unitarios de negocio
  if (CODE_DEFECT_REGEX.test(combinedText)) {
    return "Code Defect";
  }

  // Sin evidencia de código, la repetición sí apunta a un problema de arnés o de uso de herramienta
  if (signal.loopDetected || (signal.consecutiveFails && signal.consecutiveFails >= 2)) {
    return "Harness Defect";
  }

  // Si no hay fallas
  if (!signal.error && !signal.stepContent) {
    return "Clean Execution";
  }

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
      if (trimmed === "---" && !frontmatterDone) {
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

  private nextRuleId(): string {
    const ids = this.rules.map((r) => Number(r.match(/\[H-(\d+)\]/)?.[1] ?? 0));
    return String(Math.max(0, ...ids) + 1).padStart(2, "0");
  }

  /** Índice de una regla equivalente (mismo contenido, sin prefijos de lista ni id). */
  findEquivalent(ruleText: string): number {
    const target = stripRulePrefix(ruleText).toLowerCase();
    if (!target) return -1;
    return this.rules.findIndex((r) => {
      const norm = stripRulePrefix(r).toLowerCase();
      return norm.length > 0 && (norm === target || norm.includes(target) || target.includes(norm));
    });
  }

  /** Una regla que vuelve a dispararse sigue siendo relevante: pasa al final de la cola FIFO. */
  refreshRule(index: number, currentDate = today()): void {
    const [rule] = this.rules.splice(index, 1);
    this.rules.push(rule);
    if (this.targetPath) atomicWriteFileSync(this.targetPath, this.serialize(currentDate));
  }

  /**
   * Inyecta una nueva regla en el buffer FIFO.
   * Si excede 10 reglas o 30 líneas, expulsa la regla más antigua. Valida antes de escribir:
   * un resultado inválido nunca llega a disco y el buffer queda como estaba.
   */
  injectRule(newRuleText: string, currentDate = today()): { evicted: string | null; totalRules: number; content: string; valid: boolean; errors: string[] } {
    let evicted: string | null = null;
    const snapshot = [...this.rules];
    const cleanRule = newRuleText.trim();

    // Formatear regla con prefijo si no lo tiene
    let formattedRule = cleanRule;
    if (cleanRule.startsWith("[H-")) {
      formattedRule = `- ${cleanRule}`;
    } else if (!cleanRule.startsWith("- ") && !cleanRule.startsWith("* ") && !/^\d+\./.test(cleanRule)) {
      formattedRule = `- [H-${this.nextRuleId()}] ${cleanRule}`;
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

    const validation = validateArtifactContent(serialized, { heuristics: true });
    if (!validation.valid) {
      this.rules = snapshot;
      return { evicted: null, totalRules: this.rules.length, content: serialized, valid: false, errors: validation.errors };
    }

    if (this.targetPath) {
      atomicWriteFileSync(this.targetPath, serialized);
    }

    return {
      evicted,
      totalRules: this.rules.length,
      content: serialized,
      valid: true,
      errors: [],
    };
  }

  serialize(currentDate = today()): string {
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
  if (/breaker|anti-loop|\baudit\b|\bodd\b|playwright|quality gate|test runner|friction|14 herramientas|lecturas/i.test(text)) {
    return "systems-auditor";
  }
  if (/\bschema\b|\byaml\b|frontmatter|\bartifacts?\b|wikilink|entropía/i.test(text)) {
    return "artifact-standards";
  }
  if (/sqlite|database|\bdb\b|\bquery\b|\bsql\b|prisma|eloquent|api_spec|\bbackend\b|\bshelf\b|\bdio\b|\bmigrations?\b/i.test(text)) {
    return "backend-architect";
  }
  if (/\bcss\b|\bhtml\b|\bdom\b|\bui\b|tailwind|\bstyles?\b|\bfrontend\b|\bcomponents?\b|\breact\b|flutter ui/i.test(text)) {
    return "frontend-ui";
  }
  if (/docker|\bci\b|\bcd\b|worktree|\bgit\b|junction|\breleases?\b|devops|\bdeploy/i.test(text)) {
    return "devops-engineer";
  }
  if (/\bplan\b|\btasks?\b|task\.md|milestone|\bissues?\b|planner|\bsdd\b/i.test(text)) {
    return "project-planner";
  }
  return "systems-auditor";
}

/**
 * 6. Síntesis determinista de Regla Heurística Preventiva
 * Devuelve null si no hay patrón accionable: una regla genérica ocuparía un hueco del
 * presupuesto FIFO y expulsaría reglas reales sin aportar nada al agente.
 */
export function synthesizeHeuristicRule(tool: string, errorText: string, breakerReason?: string): string | null {
  const combined = `${tool} ${errorText} ${breakerReason || ""}`.toLowerCase();
  const safeTool = tool.replace(/[^\w:./ -]/g, "").slice(0, 60);

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
  const missingCommand = errorText.match(/['"]?([\w.-]+)['"]?\s+no se reconoce como|['"]?([\w.-]+)['"]?\s+is not recognized as|(?:^|\s)([\w.-]+): (?:command )?not found/i);
  if (missingCommand) {
    const command = missingCommand[1] || missingCommand[2] || missingCommand[3];
    return `El comando '${command}' no está disponible en este entorno: verificar su instalación y PATH antes de usarlo, o usar una alternativa.`;
  }
  if (/file does not exist|no such file or directory|enoent/.test(combined)) {
    return `Antes de usar '${safeTool}', confirmar la ruta con 'find_by_name' o 'list_dir' en lugar de asumir que el archivo existe.`;
  }
  if (combined.includes("invalid tool call")) {
    return `Revisar el esquema de argumentos de '${safeTool}' antes de reintentar: la llamada fue rechazada por inválida.`;
  }
  if (/\b(?:ebusy|eperm|eacces)\b|permission denied|acceso denegado/.test(combined)) {
    return `Ante errores de acceso en '${safeTool}', cerrar los procesos que retienen el archivo antes de reintentar.`;
  }
  if (combined.includes("consecutivas") || combined.includes("fallos consecutivos") || combined.includes("anti-loop")) {
    return `Al alcanzar 2 fallos consecutivos en '${safeTool}', pausar y auditar precondiciones en lugar de reintentar en bucle.`;
  }
  return null;
}

/**
 * 7. Auto-Sanación en Caliente (Reflejo Silencioso de Arnés / Opción A)
 * Inyecta una heurística preventiva en learned_heuristics.md cuando una herramienta
 * falla consecutivamente (>= 2 fallos) o se dispara el Circuit Breaker.
 */
export function autoHealFromFailure(params: AutoHealParams): AutoHealResult {
  try {
    return runAutoHeal(params);
  } catch (err) {
    // Un disco de solo lectura o un archivo bloqueado no puede tumbar el hook que nos llamó
    return {
      triggered: true,
      defectType: "Harness Defect",
      healed: false,
      skill: params.skill || "systems-auditor",
      injectedRule: null,
      evictedRule: null,
      filePath: params.customPath || "",
      feedbackMessage: `[HARNESS AUTO-HEAL ERROR] ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function runAutoHeal(params: AutoHealParams): AutoHealResult {
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
    : resolve(params.workspaceRoot || process.cwd(), ".agents", "skills", skill, "rules", "learned_heuristics.md");

  // 4. Sintetizar regla si no se proporcionó una
  const ruleToInject = params.ruleSuggestion || synthesizeHeuristicRule(tool, errorText, params.breakerReason);
  if (!ruleToInject) {
    return {
      triggered: true,
      defectType,
      healed: false,
      skill,
      injectedRule: null,
      evictedRule: null,
      filePath: targetPath,
      feedbackMessage: `[HARNESS AUTO-HEAL] Fallo repetido en '${tool}' sin patrón conocido: no se registra regla genérica. Requiere diagnóstico del Systems-Auditor.`,
    };
  }

  const ruleKey = heuristicKey(skill, ruleToInject);
  const currentDate = params.currentDate || new Date().toISOString().slice(0, 10);

  // 5-6. Duplicado o inyección FIFO como una sola sección crítica entre procesos de hook
  return withFileLock(targetPath, () => {
    const manager = FIFOHeuristicsManager.fromFile(targetPath, skill);
    const duplicateIndex = manager.findEquivalent(ruleToInject);

    if (duplicateIndex !== -1) {
      manager.refreshRule(duplicateIndex, currentDate);
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
        ruleKey,
        ruleText: ruleToInject,
      };
    }

    const injection = manager.injectRule(ruleToInject, currentDate);

    if (!injection.valid) {
      return {
        triggered: true,
        defectType,
        healed: false,
        skill,
        injectedRule: null,
        evictedRule: null,
        filePath: targetPath,
        feedbackMessage: `[HARNESS AUTO-HEAL ERROR] Falló validación de heurísticas: ${injection.errors.join("; ")}`,
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
      ruleKey,
      ruleText: ruleToInject,
    };
  });
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
