import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractAbstractions,
  extractContracts,
  extractSkillContext,
  extractTask,
  packTask,
  resolveCanonicalRole,
} from "./pack_task";

const FIXTURES_DIR = join(process.cwd(), "_workspace", "test_pack_fixtures");

describe("Subagent Context Packager (pack_task.ts)", () => {
  beforeAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURES_DIR, { recursive: true });

    // Fixture task.md
    const taskContent = `---
tipo: task_list
proyecto: TestProject
iteracion: v1.0.0
estado: activo
fecha: 2026-10-27
tags: [test, tasks]
---
# Checklist de Tareas
- [ ] (Backend-Architect) Implementar endpoint de autenticación JWT (F101).
- [ ] (Frontend-UI) Diseñar formulario de login responsivo (F102).
- [x] (Systems-Auditor) Auditar presupuestos de DOM en landing (F103).
`;
    writeFileSync(join(FIXTURES_DIR, "task.md"), taskContent, "utf-8");

    // Fixture api_spec.md
    const specContent = `---
tipo: api_spec
proyecto: TestProject
estado: activo
tags: [api, test]
---
# Especificación de API
## 📡 Endpoints de la API
- **POST /api/auth/login**
  - Descripción: Autenticación de usuarios.
  - Respuesta: \`200 OK\`
- **GET /api/auth/profile**
  - Descripción: Perfil del usuario autenticado.
  - Respuesta: \`200 OK\`
- **GET /api/items**
  - Descripción: Listado general de items.
  - Respuesta: \`200 OK\`
`;
    writeFileSync(join(FIXTURES_DIR, "api_spec.md"), specContent, "utf-8");

    // Fixture abstractions.md
    const absContent = `---
tipo: abstracciones
proyecto: TestProject
estado: activo
tags: [abstracciones, test]
---
# Abstracciones
## 🏛️ Filosofía de Diseño
- Separación estricta de responsabilidades.
## 📐 Interfaces y Contratos de Dominio
### \`IAuthService\`
- Propósito: Frontera de autenticación.
### \`ITokenGenerator\`
- Propósito: Generación de tokens JWT.
`;
    writeFileSync(join(FIXTURES_DIR, "abstractions.md"), absContent, "utf-8");

    // Fixture skill structure
    const skillDir = join(FIXTURES_DIR, "skills", "backend-architect");
    mkdirSync(join(skillDir, "rules"), { recursive: true });

    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---
name: Backend-Architect
description: Test skill
---
# Backend Architect
## Reglas de Oro y Directivas Operativas
1. SDD Obligatorio: contratos primero en api_spec.md.
2. TDD co-localizado con runner nativo <500ms.
3. Cero blind fixes ni parches sin tests.
`,
      "utf-8"
    );

    writeFileSync(
      join(skillDir, "rules", "learned_heuristics.md"),
      `---
tipo: learned_heuristics
skill: backend-architect
reglas_count: 2
fecha_actualizacion: 2026-10-27
---
# Reglas Heurísticas Aprendidas
- [H1] En SQLite, memoizar la inicialización para evitar data race en Flutter.
- [H2] Siempre usar índices compuestos con tenant_id a la izquierda.
`,
      "utf-8"
    );
  });

  afterAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  it("1. Resuelve alias de agentes a roles canónicos correctamente", () => {
    expect(resolveCanonicalRole("backend")).toBe("backend-architect");
    expect(resolveCanonicalRole("backend-architect")).toBe("backend-architect");
    expect(resolveCanonicalRole("frontend")).toBe("frontend-ui");
    expect(resolveCanonicalRole("ui")).toBe("frontend-ui");
    expect(resolveCanonicalRole("auditor")).toBe("systems-auditor");
    expect(resolveCanonicalRole("systems")).toBe("systems-auditor");
    expect(resolveCanonicalRole("devops")).toBe("devops-engineer");
    expect(resolveCanonicalRole("planner")).toBe("project-planner");
  });

  it("2. Extrae directivas de skill y heurísticas aprendidas desde fixtures", () => {
    const { skillRules, heuristics, loaded } = extractSkillContext(
      join(FIXTURES_DIR, "skills"),
      "backend-architect"
    );
    expect(loaded).toBe(true);
    expect(skillRules.length).toBeGreaterThanOrEqual(2);
    expect(skillRules[0]).toContain("SDD Obligatorio");
    expect(heuristics.length).toBe(2);
    expect(heuristics[0]).toContain("SQLite, memoizar");
  });

  it("3. Extrae tarea atómica por ID específico", () => {
    const result = extractTask(
      join(FIXTURES_DIR, "task.md"),
      "backend-architect",
      "F101"
    );
    expect(result.found).toBe(true);
    expect(result.id).toBe("F101");
    expect(result.taskText).toContain("F101");
    expect(result.taskText).toContain("JWT");
  });

  it("4. Extrae primera tarea pendiente si no se pasa ID", () => {
    const result = extractTask(
      join(FIXTURES_DIR, "task.md"),
      "frontend-ui"
    );
    expect(result.found).toBe(true);
    expect(result.taskText).toContain("formulario de login");
  });

  it("5. Extrae contratos filtrados por Vertical Slice", () => {
    const sliceResult = extractContracts(
      join(FIXTURES_DIR, "api_spec.md"),
      "auth"
    );
    expect(sliceResult.contracts.length).toBeGreaterThanOrEqual(2);
    const joined = sliceResult.contracts.join("\n");
    expect(joined).toContain("/api/auth/login");
    expect(joined).toContain("/api/auth/profile");
    expect(joined).not.toContain("/api/items");
  });

  it("6. Extrae contratos globales si no se especifica slice", () => {
    const allResult = extractContracts(
      join(FIXTURES_DIR, "api_spec.md"),
      undefined
    );
    expect(allResult.contracts.join("\n")).toContain("/api/items");
  });

  it("7. Extrae abstracciones del sistema", () => {
    const abs = extractAbstractions(join(FIXTURES_DIR, "abstractions.md"));
    expect(abs.length).toBeGreaterThanOrEqual(2);
    expect(abs.join("\n")).toContain("IAuthService");
    expect(abs.join("\n")).toContain("ITokenGenerator");
  });

  it("8. Empaqueta el prompt completo con presupuesto de líneas (< 100 líneas)", () => {
    const result = packTask({
      agent: "backend",
      slice: "auth",
      taskId: "F101",
      taskFile: join(FIXTURES_DIR, "task.md"),
      specFile: join(FIXTURES_DIR, "api_spec.md"),
      abstractionsFile: join(FIXTURES_DIR, "abstractions.md"),
      skillsDir: join(FIXTURES_DIR, "skills"),
    });

    expect(result.success).toBe(true);
    expect(result.lineCount).toBeLessThan(100);
    expect(result.output).toContain("# 🎯 CONTEXTO DE DESPACHO: BACKEND-ARCHITECT [Slice: auth]");
    expect(result.output).toContain("## 1. Directivas de Skill y Heurísticas Activas");
    expect(result.output).toContain("## 2. Tarea Atómica Asignada");
    expect(result.output).toContain("## 3. Contratos SDD (api_spec.md)");
    expect(result.output).toContain("## 4. Abstracciones & Invariantes de Dominio");
    expect(result.metadata.taskFound).toBe(true);
    expect(result.metadata.heuristicsCount).toBe(2);
  });

  it("9. Funciona contra los artefactos vivos reales del repositorio", () => {
    const realResult = packTask({
      agent: "backend-architect",
      slice: "resource",
    });

    expect(realResult.success).toBe(true);
    expect(realResult.lineCount).toBeLessThan(100);
    expect(realResult.metadata.skillLoaded).toBe(true);
    expect(realResult.output).toContain("BACKEND-ARCHITECT");
  });

  it("10. Ejecución vía CLI emite JSON estructurado con flag --json", () => {
    const cmd = `bun scripts/pack_task.ts --agent backend --slice auth --json --task-file "${join(FIXTURES_DIR, "task.md")}" --spec-file "${join(FIXTURES_DIR, "api_spec.md")}" --abstractions-file "${join(FIXTURES_DIR, "abstractions.md")}" --skills-dir "${join(FIXTURES_DIR, "skills")}"`;
    const stdout = execSync(cmd, { encoding: "utf-8" });
    const parsed = JSON.parse(stdout);

    expect(parsed.success).toBe(true);
    expect(parsed.role).toBe("backend-architect");
    expect(parsed.slice).toBe("auth");
    expect(parsed.lineCount).toBeLessThan(100);
  });

  it("11. Escribe archivo de salida si se pasa opción output", () => {
    const outPath = join(FIXTURES_DIR, "packed_prompt.md");
    const result = packTask({
      agent: "auditor",
      output: outPath,
      taskFile: join(FIXTURES_DIR, "task.md"),
      specFile: join(FIXTURES_DIR, "api_spec.md"),
      abstractionsFile: join(FIXTURES_DIR, "abstractions.md"),
      skillsDir: join(FIXTURES_DIR, "skills"),
    });

    expect(result.success).toBe(true);
    expect(existsSync(outPath)).toBe(true);
    const content = readFileSync(outPath, "utf-8");
    expect(content).toContain("SYSTEMS-AUDITOR");
  });

  it("12. Maneja gracefully archivos inexistentes con fallbacks seguros", () => {
    const fallback = packTask({
      agent: "devops",
      taskFile: join(FIXTURES_DIR, "non_existent_task.md"),
      specFile: join(FIXTURES_DIR, "non_existent_spec.md"),
      abstractionsFile: join(FIXTURES_DIR, "non_existent_abs.md"),
      skillsDir: join(FIXTURES_DIR, "non_existent_skills"),
    });

    expect(fallback.success).toBe(true);
    expect(fallback.lineCount).toBeLessThan(100);
    expect(fallback.output).toContain("DEVOPS-ENGINEER");
  });

  it("13. Preserva detalles multilínea de contratos (Descripción, Respuesta, etc.)", () => {
    const contracts = extractContracts(join(FIXTURES_DIR, "api_spec.md"), "auth");
    const joined = contracts.contracts.join("\n");
    expect(joined).toContain("Descripción: Autenticación de usuarios.");
    expect(joined).toContain("Respuesta: `200 OK`");
  });

  it("14. Preserva subtareas anidadas en tareas pendientes", () => {
    const nestedTaskPath = join(FIXTURES_DIR, "nested_task.md");
    writeFileSync(
      nestedTaskPath,
      `- [ ] (Backend-Architect) Tarea con subtareas
  - Subtarea 1: crear esquema
  - Subtarea 2: crear servicio
- [ ] (Frontend-UI) Tarea UI
`,
      "utf-8"
    );

    const task = extractTask(nestedTaskPath, "backend-architect");
    expect(task.found).toBe(true);
    expect(task.taskText).toContain("Subtarea 1: crear esquema");
    expect(task.taskText).toContain("Subtarea 2: crear servicio");
    expect(task.taskText).not.toContain("Tarea UI");
  });

  it("15. Aísla contratos cuando el slice no tiene endpoints (no fuga todos los endpoints)", () => {
    const emptySlice = extractContracts(join(FIXTURES_DIR, "api_spec.md"), "billing");
    expect(emptySlice.count).toBe(0);
    const joined = emptySlice.contracts.join("\n");
    expect(joined).toContain("Sin contratos declarados aún en api_spec.md para el slice 'billing'");
    expect(joined).not.toContain("/api/auth/login");
    expect(joined).not.toContain("/api/items");
  });
});
