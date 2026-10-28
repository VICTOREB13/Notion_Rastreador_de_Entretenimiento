import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateArtifactContent } from "../.agents/skills/artifact-standards/scripts/validate_artifact.js";
import type {
  AutoHealParams,
  AutoHealResult,
  DefectType,
  FailureSignal,
} from "./verify_recursive_loop_types";

export * from "./verify_recursive_loop_types";

/**
 * 1. Clasificación determinista de causa raíz (Root Cause Diagnosis)
 */
export function classifyRootCause(signal: FailureSignal): DefectType {
  const combinedText = `${signal.error} ${signal.stepContent || ""}`.toLowerCase();
  const harnessKeywords = [
    "circuit_breaker_blocked", '"decision":"block"', '"decision": "block"',
    '"decision":"deny"', '"decision": "deny"', "anti-loop", "prompt drift",
    "timeout no configurado", "sqlite_busy", "missing mock", "drift guard",
    "contract drift", "api_spec.md mismatch", "presupuesto de entropía",
  ];

  if (
    signal.breakerTriggered ||
    signal.loopDetected ||
    (signal.consecutiveFails && signal.consecutiveFails >= 2) ||
    harnessKeywords.some((kw) => combinedText.includes(kw))
  ) {
    return "Harness Defect";
  }

  if (!signal.error && !signal.stepContent) {
    return "Clean Execution";
  }

  return "Code Defect";
}

/**
 * 2. Gestor FIFO de Heurísticas Aprendidas (Harness² FIFO Manager)
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

  injectRule(newRuleText: string, currentDate = "2026-10-26"): { evicted: string | null; totalRules: number; content: string } {
    let evicted: string | null = null;
    const cleanRule = newRuleText.trim();

    let formattedRule = cleanRule;
    if (cleanRule.startsWith("[H-")) {
      formattedRule = `- ${cleanRule}`;
    } else if (!cleanRule.startsWith("- ") && !cleanRule.startsWith("* ") && !/^\d+\./.test(cleanRule)) {
      formattedRule = `- [H-${String(this.rules.length + 1).padStart(2, "0")}] ${cleanRule}`;
    }

    this.rules.push(formattedRule);

    while (this.rules.length > 10) {
      evicted = this.rules.shift() || null;
    }

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
 * 6. Inferencia de Skill y Síntesis de Regla
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
 * 7. Auto-Sanación en Caliente
 */
export function autoHealFromFailure(params: AutoHealParams): AutoHealResult {
  const tool = params.tool || "unknown";
  const errorText = `${params.error || ""} ${params.breakerReason || ""}`.trim();
  const consecutiveFails = params.consecutiveFails ?? 0;
  const breakerBlocked = Boolean(params.breakerBlocked);

  const failureSignal: FailureSignal = {
    error: errorText,
    tool,
    stepContent: params.stepContent,
    breakerTriggered: breakerBlocked,
    loopDetected: consecutiveFails >= 2,
    consecutiveFails,
  };

  const defectType = classifyRootCause(failureSignal);

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

  const skill = params.skill || inferSkillFromContext(tool, errorText);
  const targetPath = params.customPath
    ? resolve(params.customPath)
    : resolve(process.cwd(), ".agents", "skills", skill, "rules", "learned_heuristics.md");

  const ruleToInject = params.ruleSuggestion || synthesizeHeuristicRule(tool, errorText, params.breakerReason);

  const manager = FIFOHeuristicsManager.fromFile(targetPath, skill);
  const existingRules = manager.getRules();
  const normalizedNew = ruleToInject.trim().replace(/^[-*]\s+(\[H-\d+\]\s*)?/, "").toLowerCase();

  const isDuplicate = existingRules.some((r) => {
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
