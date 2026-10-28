import { Database } from "bun:sqlite";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  distillSession,
  generateFrictionReport,
  parseTranscriptContent,
  resolveLatestConversation,
} from "./distill_session";

const TEST_DIR = resolve(process.cwd(), "_workspace", "_test_distill");

if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

afterAll(() => {
  try {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch {}
});


describe("distill_session.ts - Trace Distillation & Friction Metrics", () => {
  describe("resolveLatestConversation", () => {
    it("retorna null si la base de datos no existe", () => {
      const res = resolveLatestConversation(resolve(TEST_DIR, "nonexistent.db"), "C:/my/workspace");
      expect(res).toBeNull();
    });

    it("resuelve la conversación más reciente filtrando por workspace_uris", () => {
      const dbPath = resolve(TEST_DIR, "test_summaries.db");
      if (existsSync(dbPath)) {
        try { unlinkSync(dbPath); } catch {}
      }
      const db = new Database(dbPath);
      db.run(`
        CREATE TABLE IF NOT EXISTS conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          workspace_uris TEXT,
          last_modified_time TEXT
        );
      `);
      db.run(`DELETE FROM conversation_summaries;`);
      db.run(`
        INSERT INTO conversation_summaries VALUES
        ('uuid-other-1', '["file:///C:/Users/other/Project"]', '2026-10-26 12:00:00'),
        ('uuid-target-old', '["file:///C:/Users/vmesp/Documents/Proyectos/Plantilla-Base-Agentes"]', '2026-10-26 13:00:00'),
        ('uuid-target-new', '["file:///C:/Users/vmesp/Documents/Proyectos/Plantilla-Base-Agentes"]', '2026-10-26 14:00:00');
      `);
      db.close();

      const resolved = resolveLatestConversation(
        dbPath,
        "C:\\Users\\vmesp\\Documents\\Proyectos\\Plantilla-Base-Agentes"
      );
      expect(resolved).toBe("uuid-target-new");
    });

    it("resuelve workspace_uris con codificación URL (%20) y barras invertidas", () => {
      const dbPath = resolve(TEST_DIR, "test_summaries_encoded.db");
      if (existsSync(dbPath)) {
        try { unlinkSync(dbPath); } catch {}
      }
      const db = new Database(dbPath);
      db.run(`
        CREATE TABLE IF NOT EXISTS conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          workspace_uris TEXT,
          last_modified_time TEXT
        );
      `);
      db.run(`DELETE FROM conversation_summaries;`);
      db.run(`
        INSERT INTO conversation_summaries VALUES
        ('uuid-encoded-1', '["file:///C:/Users/vmesp/My%20Cool%20Project"]', '2026-10-26 16:00:00');
      `);
      db.close();

      const resolved = resolveLatestConversation(dbPath, "C:\\Users\\vmesp\\My Cool Project");
      expect(resolved).toBe("uuid-encoded-1");
    });

    it("hace fallback a la conversación más reciente si ningún workspace coincide", () => {
      const dbPath = resolve(TEST_DIR, "test_summaries_fallback.db");
      if (existsSync(dbPath)) {
        try { unlinkSync(dbPath); } catch {}
      }
      const db = new Database(dbPath);
      db.run(`
        CREATE TABLE IF NOT EXISTS conversation_summaries (
          conversation_id TEXT PRIMARY KEY,
          workspace_uris TEXT,
          last_modified_time TEXT
        );
      `);
      db.run(`DELETE FROM conversation_summaries;`);
      db.run(`
        INSERT INTO conversation_summaries VALUES
        ('uuid-fallback-1', '["file:///C:/unrelated/a"]', '2026-10-26 10:00:00'),
        ('uuid-fallback-2', '["file:///C:/unrelated/b"]', '2026-10-26 15:00:00');
      `);
      db.close();

      const resolved = resolveLatestConversation(dbPath, "C:/completely/different/path");
      expect(resolved).toBe("uuid-fallback-2");
    });
  });

  describe("parseTranscriptContent", () => {
    it("maneja contenido vacío o corrupto con gracia", () => {
      const emptyMetrics = parseTranscriptContent("");
      expect(emptyMetrics.total_steps).toBe(0);
      expect(emptyMetrics.root_cause_signal).toBe("Ejecución Limpia");

      const corruptMetrics = parseTranscriptContent("not json\n{also invalid\n");
      expect(corruptMetrics.total_steps).toBe(0);
    });

    it("contabiliza turnos de usuario, modelo y conteo de herramientas correctamente", () => {
      const transcript = [
        JSON.stringify({ step_index: 0, source: "USER_EXPLICIT", type: "USER_INPUT", content: "Hola" }),
        JSON.stringify({
          step_index: 1,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "run_command", args: { CommandLine: "bun test" } }],
        }),
        JSON.stringify({
          step_index: 2,
          source: "MODEL",
          type: "GENERIC",
          content: "The command exited with code 0.\nOutput: All pass",
        }),
        JSON.stringify({
          step_index: 3,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "write_to_file", args: { TargetFile: "test.ts" } }],
        }),
      ].join("\n");

      const metrics = parseTranscriptContent(transcript, "test-uuid-1");
      expect(metrics.total_steps).toBe(4);
      expect(metrics.user_turns).toBe(1);
      expect(metrics.model_turns).toBe(3);
      expect(metrics.total_tool_calls).toBe(2);
      expect(metrics.tool_counts["run_command"]).toBe(1);
      expect(metrics.tool_counts["write_to_file"]).toBe(1);
      expect(metrics.total_tool_failures).toBe(0);
      expect(metrics.root_cause_signal).toBe("Ejecución Limpia");
    });

    it("detecta fallos de herramientas por exit code no-cero y clasifica como Defecto de Código", () => {
      const transcript = [
        JSON.stringify({
          step_index: 0,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "run_command", args: { CommandLine: "pytest" } }],
        }),
        JSON.stringify({
          step_index: 1,
          source: "MODEL",
          type: "GENERIC",
          content: "Command exited with code 1.\nError: 2 tests failed",
        }),
      ].join("\n");

      const metrics = parseTranscriptContent(transcript, "test-uuid-2");
      expect(metrics.total_tool_failures).toBe(1);
      expect(metrics.tool_failures["run_command"]).toBe(1);
      expect(metrics.root_cause_signal).toBe("Defecto de Código");
    });

    it("detecta ráfagas de lectura consecutivas y banderas cuando superan 12", () => {
      const steps = [];
      for (let i = 0; i < 14; i++) {
        steps.push(
          JSON.stringify({
            step_index: i,
            source: "MODEL",
            type: "PLANNER_RESPONSE",
            tool_calls: [{ name: "view_file", args: { AbsolutePath: `file_${i}.ts` } }],
          })
        );
      }

      const metrics = parseTranscriptContent(steps.join("\n"));
      expect(metrics.max_read_streak).toBe(14);
      expect(metrics.read_streaks_above_limit).toBe(2); // Llamadas 13 y 14 superan 12
      expect(metrics.root_cause_signal).toBe("Defecto de Arnés");
    });

    it("detecta bucles idénticos repetitivos (>= 3 llamadas consecutivas idénticas)", () => {
      const steps = [
        JSON.stringify({
          step_index: 0,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "read_file", args: { path: "same.txt" } }],
        }),
        JSON.stringify({
          step_index: 1,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "read_file", args: { path: "same.txt" } }],
        }),
        JSON.stringify({
          step_index: 2,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "read_file", args: { path: "same.txt" } }],
        }),
      ];

      const metrics = parseTranscriptContent(steps.join("\n"));
      expect(metrics.repetitive_loops.length).toBe(1);
      expect(metrics.repetitive_loops[0].tool).toBe("read_file");
      expect(metrics.repetitive_loops[0].count).toBe(3);
    });

    it("detecta bloqueos de CIRCUIT_BREAKER_BLOCKED y clasifica como Defecto de Arnés", () => {
      const transcript = [
        JSON.stringify({
          step_index: 0,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "read_file", args: { path: "overflow.txt" } }],
        }),
        JSON.stringify({
          step_index: 1,
          source: "SYSTEM",
          type: "SYSTEM_MESSAGE",
          content: "CIRCUIT_BREAKER_BLOCKED: Se superó el límite de 12 lecturas secuenciales consecutivas.",
        }),
      ].join("\n");

      const metrics = parseTranscriptContent(transcript);
      expect(metrics.circuit_breaker_blocks).toBe(1);
      expect(metrics.root_cause_signal).toBe("Defecto de Arnés");
      expect(metrics.auditor_directive).toContain("Fricción severa detectada");
    });

    it("detecta fallos consecutivos de la misma herramienta (anti-loop >= 2)", () => {
      const transcript = [
        JSON.stringify({
          step_index: 0,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "npm_test", args: {} }],
        }),
        JSON.stringify({
          step_index: 1,
          source: "MODEL",
          type: "GENERIC",
          content: "Command exited with code 1. Tests failed.",
        }),
        JSON.stringify({
          step_index: 2,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "npm_test", args: {} }],
        }),
        JSON.stringify({
          step_index: 3,
          source: "MODEL",
          type: "GENERIC",
          content: "Command exited with code 1. Tests failed again.",
        }),
      ].join("\n");

      const metrics = parseTranscriptContent(transcript);
      expect(metrics.anti_loop_triggers).toBeGreaterThanOrEqual(1);
      expect(metrics.root_cause_signal).toBe("Defecto de Arnés");
    });

    it("no confunde contenido leído que contiene 'error:' o 'CIRCUIT_BREAKER_BLOCKED' con fallos reales (falso positivo)", () => {
      const transcript = [
        JSON.stringify({
          step_index: 0,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "view_file", args: { AbsolutePath: "circuit_breaker.ts" } }],
        }),
        JSON.stringify({
          step_index: 1,
          source: "MODEL",
          type: "GENERIC",
          status: "DONE",
          content: "File Path: circuit_breaker.ts\nLine 234: CIRCUIT_BREAKER_BLOCKED: limit reached\nLine 235: error: invalid syntax",
        }),
      ].join("\n");

      const metrics = parseTranscriptContent(transcript);
      expect(metrics.total_tool_failures).toBe(0);
      expect(metrics.circuit_breaker_blocks).toBe(0);
      expect(metrics.tool_failures["view_file"]).toBeUndefined();
      expect(metrics.root_cause_signal).toBe("Ejecución Limpia");
    });

    it("asigna resultados de llamadas paralelas a herramientas en orden FIFO", () => {
      const transcript = [
        JSON.stringify({
          step_index: 0,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [
            { name: "run_command", args: { CommandLine: "fail_cmd" } },
            { name: "view_file", args: { AbsolutePath: "ok_file.ts" } },
          ],
        }),
        // Resultado de run_command: falla
        JSON.stringify({
          step_index: 1,
          source: "MODEL",
          type: "GENERIC",
          status: "DONE",
          content: "Command exited with code 1. SyntaxError",
        }),
        // Resultado de view_file: éxito
        JSON.stringify({
          step_index: 2,
          source: "MODEL",
          type: "GENERIC",
          status: "DONE",
          content: "File content of ok_file.ts",
        }),
      ].join("\n");

      const metrics = parseTranscriptContent(transcript);
      expect(metrics.total_tool_calls).toBe(2);
      expect(metrics.total_tool_failures).toBe(1);
      expect(metrics.tool_failures["run_command"]).toBe(1);
      expect(metrics.tool_failures["view_file"]).toBeUndefined();
    });

    it("mantiene la racha de lectura cuando se llaman herramientas que no resetean la racha (ej. send_message)", () => {
      const transcript = [
        JSON.stringify({
          step_index: 0,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "read_file", args: { path: "a.ts" } }],
        }),
        JSON.stringify({
          step_index: 1,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "send_message", args: { Message: "note" } }],
        }),
        JSON.stringify({
          step_index: 2,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "read_file", args: { path: "b.ts" } }],
        }),
        JSON.stringify({
          step_index: 3,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "grep_search", args: { Query: "foo" } }],
        }),
        JSON.stringify({
          step_index: 4,
          source: "MODEL",
          type: "PLANNER_RESPONSE",
          tool_calls: [{ name: "read_file", args: { path: "c.ts" } }],
        }),
      ].join("\n");

      const metrics = parseTranscriptContent(transcript);
      expect(metrics.max_read_streak).toBe(2);
    });
  });

  describe("generateFrictionReport", () => {
    it("genera un reporte estrictamente menor a 25 líneas", () => {
      const metrics = parseTranscriptContent(
        [
          JSON.stringify({
            step_index: 0,
            source: "USER_EXPLICIT",
            type: "USER_INPUT",
            content: "Construir feature",
          }),
          JSON.stringify({
            step_index: 1,
            source: "MODEL",
            type: "PLANNER_RESPONSE",
            tool_calls: [{ name: "grep_search", args: { Query: "test" } }],
          }),
          JSON.stringify({
            step_index: 2,
            source: "MODEL",
            type: "GENERIC",
            content: "Found 2 matches",
          }),
        ].join("\n"),
        "sample-uuid"
      );

      const report = generateFrictionReport(metrics);
      const lineCount = report.trim().split(/\r?\n/).length;

      expect(lineCount).toBeLessThan(25);
      expect(report).toContain("# Reporte de Fricción de Sesión (Trace Distillation)");
      expect(report).toContain("sample-uuid");
      expect(report).toContain("grep_search");
    });
  });

  describe("distillSession CLI & File Workflow", () => {
    it("procesa un archivo transcript.jsonl y escribe el reporte en outputPath", () => {
      const transcriptFile = resolve(TEST_DIR, "transcript.jsonl");
      const outputFile = resolve(TEST_DIR, "friction_report.md");

      writeFileSync(
        transcriptFile,
        [
          JSON.stringify({
            step_index: 0,
            source: "USER_EXPLICIT",
            type: "USER_INPUT",
            content: "Test CLI integration",
          }),
          JSON.stringify({
            step_index: 1,
            source: "MODEL",
            type: "PLANNER_RESPONSE",
            tool_calls: [{ name: "run_command", args: { CommandLine: "echo ok" } }],
          }),
          JSON.stringify({
            step_index: 2,
            source: "MODEL",
            type: "GENERIC",
            content: "The command exited with code 0.\nOutput: ok",
          }),
        ].join("\n"),
        "utf-8"
      );

      const metrics = distillSession({
        transcriptPath: transcriptFile,
        outputPath: outputFile,
        uuid: "cli-test-uuid",
      });

      expect(existsSync(outputFile)).toBe(true);
      expect(metrics.conversation_id).toBe("cli-test-uuid");
      expect(metrics.total_steps).toBe(3);
      expect(metrics.total_tool_calls).toBe(1);
    });

    it("lanza un error explícito si la ruta del transcript no existe", () => {
      expect(() => {
        distillSession({
          transcriptPath: resolve(TEST_DIR, "missing.jsonl"),
        });
      }).toThrow("El archivo de transcripción no existe");
    });
  });
});
