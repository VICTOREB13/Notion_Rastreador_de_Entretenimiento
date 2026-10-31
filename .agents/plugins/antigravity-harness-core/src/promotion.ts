import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { TelemetryDB } from "./telemetry_db";

export interface PromotedHeuristic {
  rule_id: string;
  skill: string;
  rule_text: string;
  promotion_score: number;
  status: string;
  promoted_at: string;
}

export interface PromotionEvaluationResult {
  evaluatedCount: number;
  newlyPromoted: PromotedHeuristic[];
  allPromoted: PromotedHeuristic[];
  globalFilePath?: string;
}

export class PromotionEngine {
  private telemetry: TelemetryDB;
  private globalHeuristicsPath: string;

  constructor(telemetry: TelemetryDB, customGlobalPath?: string) {
    this.telemetry = telemetry;
    if (customGlobalPath) {
      this.globalHeuristicsPath = customGlobalPath;
    } else {
      const home = process.env.USERPROFILE || process.env.HOME || ".";
      this.globalHeuristicsPath = join(home, ".gemini", "config", "heuristics", "global_heuristics.md");
    }
  }

  /**
   * Evalúa las heurísticas registradas en la telemetría y promueve aquellas
   * con alta tasa de éxito empírico (≥ 80%), volumen representativo (≥ 3 éxitos) y evidencia
   * en más de un workspace. Una regla promovida que deja de cumplir se degrada, y una revocada
   * a mano (status = 'revoked') no vuelve a promoverse.
   */
  public evaluateAndPromote(minSuccesses = 3, minScore = 0.8, minWorkspaces = 2): PromotionEvaluationResult {
    const rawHeuristics = (this.telemetry as any).db.query(`
      SELECT
        rule_id,
        skill,
        rule_text,
        SUM(times_injected) as total_injected,
        SUM(times_succeeded) as total_succeeded,
        SUM(times_failed) as total_failed,
        COUNT(DISTINCT workspace_path) as workspace_count
      FROM heuristics_telemetry
      GROUP BY rule_id, skill, rule_text
    `).all() as any[];

    const newlyPromoted: PromotedHeuristic[] = [];

    for (const h of rawHeuristics) {
      const succeeded = Number(h.total_succeeded || 0);
      const failed = Number(h.total_failed || 0);
      const total = succeeded + failed;
      if (total === 0) continue;

      const successRate = succeeded / total;
      const volumeFactor = Math.min(1.0, succeeded / minSuccesses);
      const score = Math.round(successRate * volumeFactor * 100) / 100;
      const qualifies = succeeded >= minSuccesses && score >= minScore && Number(h.workspace_count) >= minWorkspaces;

      if (!qualifies) {
        (this.telemetry as any).db.prepare(`
          UPDATE promoted_heuristics SET status = 'demoted' WHERE rule_id = ? AND status = 'promoted'
        `).run(h.rule_id);
        continue;
      }

      {
        // Verificar si ya fue promovida
        const existing = (this.telemetry as any).db.query(`
          SELECT * FROM promoted_heuristics WHERE rule_id = ?
        `).get(h.rule_id) as any;
        if (existing?.status === "revoked") continue;

        const stmt = (this.telemetry as any).db.prepare(`
          INSERT INTO promoted_heuristics (rule_id, skill, rule_text, promotion_score, status)
          VALUES (?, ?, ?, ?, 'promoted')
          ON CONFLICT(rule_id) DO UPDATE SET
            promotion_score = excluded.promotion_score,
            status = 'promoted';
        `);
        stmt.run(h.rule_id, h.skill, h.rule_text, score);

        const record: PromotedHeuristic = {
          rule_id: h.rule_id,
          skill: h.skill,
          rule_text: h.rule_text,
          promotion_score: score,
          status: "promoted",
          promoted_at: new Date().toISOString(),
        };

        if (!existing) {
          newlyPromoted.push(record);
        }
      }
    }

    const allPromoted = (this.telemetry as any).db.query(`
      SELECT rule_id, skill, rule_text, promotion_score, status, promoted_at
      FROM promoted_heuristics
      WHERE status = 'promoted'
      ORDER BY promotion_score DESC
    `).all() as PromotedHeuristic[];

    this.syncGlobalHeuristicsFile(allPromoted);

    return {
      evaluatedCount: rawHeuristics.length,
      newlyPromoted,
      allPromoted,
      globalFilePath: this.globalHeuristicsPath,
    };
  }

  /**
   * Sincroniza las heurísticas promovidas en un archivo global compartido Markdown.
   */
  public syncGlobalHeuristicsFile(heuristics: PromotedHeuristic[]): void {
    if (!this.globalHeuristicsPath || this.globalHeuristicsPath.startsWith(":memory:")) return;

    try {
      const dir = dirname(this.globalHeuristicsPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const lines = [
        "---",
        "tipo: heuristics_catalog",
        "alcance: global_cross_workspace",
        "version: V9.0.0",
        `total_promoted: ${heuristics.length}`,
        `actualizado: ${new Date().toISOString().split("T")[0]}`,
        "---",
        "",
        "# 🌐 Catálogo Global de Heurísticas Promovidas (Harness³)",
        "",
        "> Reglas validadas empíricamente y promovidas por el motor cross-workspace.",
        "",
      ];

      for (const h of heuristics) {
        lines.push(`- **[${h.rule_id}]** \`(${h.skill})\` ${h.rule_text} *(Score: ${h.promotion_score})*`);
      }

      writeFileSync(this.globalHeuristicsPath, lines.join("\n") + "\n", "utf-8");
    } catch {}
  }
}
