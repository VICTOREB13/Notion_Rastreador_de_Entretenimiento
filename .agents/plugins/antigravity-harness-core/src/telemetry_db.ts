import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

export interface ToolExecutionRecord {
  conversationId?: string;
  stepIdx?: number;
  toolName: string;
  isSuccess: boolean;
  errorMessage?: string;
  sanitized?: boolean;
  executionTimeMs?: number;
}

export interface HeuristicUsageRecord {
  ruleId: string;
  skill: string;
  ruleText: string;
  workspacePath?: string;
  success?: boolean;
}

export class TelemetryDB {
  private db: Database;
  private dbPath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else if (process.env.PLUGIN_DATA) {
      this.dbPath = join(process.env.PLUGIN_DATA, "telemetry.db");
    } else {
      const home = process.env.USERPROFILE || process.env.HOME || ".";
      this.dbPath = join(home, ".gemini", "antigravity-cli", "plugin-data", "antigravity-harness-core", "telemetry.db");
    }

    if (this.dbPath !== ":memory:") {
      const dir = dirname(this.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(this.dbPath);
    this.initSchema();
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  private initSchema(): void {
    // Configuración pragmas WAL para alta concurrencia
    if (this.dbPath !== ":memory:") {
      try {
        this.db.run("PRAGMA journal_mode = WAL;");
        this.db.run("PRAGMA busy_timeout = 5000;");
      } catch {}
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS tool_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        step_idx INTEGER,
        tool_name TEXT NOT NULL,
        is_success INTEGER NOT NULL,
        error_message TEXT,
        sanitized INTEGER DEFAULT 0,
        execution_time_ms INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS error_signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signature_hash TEXT UNIQUE NOT NULL,
        tool_name TEXT NOT NULL,
        error_pattern TEXT NOT NULL,
        occurrence_count INTEGER DEFAULT 1,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS heuristics_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        rule_text TEXT NOT NULL,
        times_injected INTEGER DEFAULT 0,
        times_succeeded INTEGER DEFAULT 0,
        times_failed INTEGER DEFAULT 0,
        workspace_path TEXT,
        last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(rule_id, workspace_path)
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS promoted_heuristics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT UNIQUE NOT NULL,
        skill TEXT NOT NULL,
        rule_text TEXT NOT NULL,
        promotion_score REAL NOT NULL,
        status TEXT DEFAULT 'promoted',
        promoted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  public recordToolExecution(exec: ToolExecutionRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO tool_executions (conversation_id, step_idx, tool_name, is_success, error_message, sanitized, execution_time_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      exec.conversationId || null,
      exec.stepIdx || 0,
      exec.toolName,
      exec.isSuccess ? 1 : 0,
      exec.errorMessage || null,
      exec.sanitized ? 1 : 0,
      exec.executionTimeMs || 0
    );
    return Number(res.lastInsertRowid);
  }

  public recordErrorSignature(toolName: string, errorSnippet: string): void {
    if (!errorSnippet) return;
    const normalized = errorSnippet.replace(/\d+/g, "N").replace(/(['"]).*?\1/g, "STRING").trim().slice(0, 300);
    const hash = createHash("sha256").update(`${toolName}:${normalized}`).digest("hex").slice(0, 16);

    const stmt = this.db.prepare(`
      INSERT INTO error_signatures (signature_hash, tool_name, error_pattern, occurrence_count, last_seen)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(signature_hash) DO UPDATE SET
        occurrence_count = occurrence_count + 1,
        last_seen = CURRENT_TIMESTAMP;
    `);
    stmt.run(hash, toolName, normalized);
  }

  public recordHeuristicUsage(record: HeuristicUsageRecord): void {
    const ws = record.workspacePath || "global";
    const incSuccess = record.success === true ? 1 : 0;
    const incFailed = record.success === false ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO heuristics_telemetry (rule_id, skill, rule_text, times_injected, times_succeeded, times_failed, workspace_path, last_used)
      VALUES (?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(rule_id, workspace_path) DO UPDATE SET
        times_injected = times_injected + 1,
        times_succeeded = times_succeeded + excluded.times_succeeded,
        times_failed = times_failed + excluded.times_failed,
        last_used = CURRENT_TIMESTAMP;
    `);
    stmt.run(record.ruleId, record.skill, record.ruleText, incSuccess, incFailed, ws);
  }

  public getMetrics(): { totalCalls: number; successCount: number; failureCount: number; sanitizedCount: number } {
    const row = this.db.query(`
      SELECT
        COUNT(*) as totalCalls,
        SUM(CASE WHEN is_success = 1 THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN is_success = 0 THEN 1 ELSE 0 END) as failureCount,
        SUM(CASE WHEN sanitized = 1 THEN 1 ELSE 0 END) as sanitizedCount
      FROM tool_executions;
    `).get() as any;

    return {
      totalCalls: row?.totalCalls || 0,
      successCount: row?.successCount || 0,
      failureCount: row?.failureCount || 0,
      sanitizedCount: row?.sanitizedCount || 0,
    };
  }

  public getHeuristicsTelemetry(): any[] {
    return this.db.query(`SELECT * FROM heuristics_telemetry ORDER BY times_succeeded DESC;`).all();
  }

  public getErrorSignatures(): any[] {
    return this.db.query(`SELECT * FROM error_signatures ORDER BY occurrence_count DESC;`).all();
  }

  public close(): void {
    try {
      this.db.close();
    } catch {}
  }
}
