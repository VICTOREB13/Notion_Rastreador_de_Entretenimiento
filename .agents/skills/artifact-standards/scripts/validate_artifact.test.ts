import { describe, expect, it } from "bun:test";
import { validateArtifactContent, validateLearnedHeuristics } from "./validate_artifact";

describe("Deterministic Artifact Validator (validate_artifact.ts)", () => {
  it("acepta un artefacto válido con frontmatter en línea 1 y sin mermaid", () => {
    const validContent = `---
tipo: overview
proyecto: MiProyecto
version: v1.0.0
estado: activo
fecha: 2026-10-26
tags: [arquitectura, v8]
---

# Título del Proyecto
Contenido normal con wikilink [[PRJ_MiProyecto_architecture|Arquitectura]].
`;
    const res = validateArtifactContent(validContent);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("falla si el frontmatter no inicia en la línea 1", () => {
    const invalidContent = `
---
tipo: overview
proyecto: MiProyecto
---
# Documento
`;
    const res = validateArtifactContent(invalidContent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("línea 1"))).toBe(true);
  });

  it("falla si el frontmatter no tiene delimitador de cierre '---'", () => {
    const unclosedContent = `---
tipo: overview
proyecto: MiProyecto
# Sin cierre
`;
    const res = validateArtifactContent(unclosedContent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("cierre"))).toBe(true);
  });

  it("detecta claves con mayúsculas en el frontmatter (Casing Rule)", () => {
    const upperKeyContent = `---
Tipo: overview
Proyecto: MiProyecto
fecha: 2026-10-26
---
# Cuerpo
`;
    const res = validateArtifactContent(upperKeyContent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("Tipo"))).toBe(true);
    expect(res.errors.some((e) => e.includes("Proyecto"))).toBe(true);
  });

  it("detecta objetos anidados en el frontmatter (Obsidian Flat Properties)", () => {
    const nestedContent = `---
tipo: overview
permisos:
  terminal: true
fecha: 2026-10-26
---
# Cuerpo
`;
    const res = validateArtifactContent(nestedContent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("anidada"))).toBe(true);
  });

  it("falla si se detecta un bloque de diagrama Mermaid", () => {
    const mermaidContent = `---
tipo: arquitectura
proyecto: MiProyecto
fecha: 2026-10-26
---
# Arquitectura

\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;
    const res = validateArtifactContent(mermaidContent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("mermaid"))).toBe(true);
  });

  it("falla si se detectan rutas de archivos locales file:///", () => {
    const localLinkContent = `---
tipo: overview
proyecto: MiProyecto
fecha: 2026-10-26
---
Ver [archivo](file:///C:/Users/test/file.md)
`;
    const res = validateArtifactContent(localLinkContent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("file:///"))).toBe(true);
  });

  it("valida veredicto en mayúsculas estricto (PASS/FAIL)", () => {
    const invalidVerdictContent = `---
tipo: audit_report
proyecto: MiProyecto
veredicto: pass
fecha: 2026-10-26
---
# Auditoría
`;
    const res = validateArtifactContent(invalidVerdictContent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("veredicto"))).toBe(true);

    const validVerdictContent = `---
tipo: audit_report
proyecto: MiProyecto
veredicto: PASS
fecha: 2026-10-26
---
# Auditoría
`;
    const validRes = validateArtifactContent(validVerdictContent);
    expect(validRes.valid).toBe(true);
  });

  it("valida formato de fecha ISO YYYY-MM-DD", () => {
    const invalidDateContent = `---
tipo: overview
proyecto: MiProyecto
fecha: 26/10/2026
---
# Cuerpo
`;
    const res = validateArtifactContent(invalidDateContent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("fecha"))).toBe(true);
  });

  it("se ejecuta en menos de 15ms (Meta de Rendimiento)", () => {
    const content = `---
tipo: overview
proyecto: Benchmark
version: v1.0.0
estado: activo
fecha: 2026-10-26
tags: [bench, performance]
---
# Contenido para medir velocidad
`.repeat(20);

    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      validateArtifactContent(content);
    }
    const t1 = performance.now();
    const avgMs = (t1 - t0) / 50;

    expect(avgMs).toBeLessThan(15);
  });

  describe("Presupuesto de Entropía y Heurísticas Aprendidas (Regla FIFO)", () => {
    it("acepta learned_heuristics válido dentro del límite de 30 líneas y 10 reglas", () => {
      const validHeuristics = `---
tipo: learned_heuristics
skill: systems-auditor
reglas_count: 2
fecha_actualizacion: 2026-10-26
---

# Reglas Heurísticas Aprendidas (Harness² FIFO Cache)

1. [H-01]: Usar prefijo './' para ejecutar bun test en PowerShell.
2. [H-02]: Escapar comillas en scripts bun:sqlite.
`;
      const res = validateLearnedHeuristics(validHeuristics);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("falla si el archivo supera el límite duro de 30 líneas (Presupuesto de Entropía)", () => {
      const lines = [
        "---",
        "tipo: learned_heuristics",
        "skill: backend-architect",
        "---",
        "# Reglas",
      ];
      for (let i = 1; i <= 28; i++) {
        lines.push(`${i}. [H-${i}]: Regla de prueba número ${i}.`);
      }
      const longContent = lines.join("\n");
      expect(longContent.split("\n").length).toBeGreaterThan(30);

      const res = validateLearnedHeuristics(longContent);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Presupuesto de entropía excedido"))).toBe(true);
    });

    it("falla si se registran más de 10 reglas (Límite Máximo de Reglas)", () => {
      const lines = [
        "---",
        "tipo: learned_heuristics",
        "skill: frontend-ui",
        "---",
        "# Reglas",
      ];
      for (let i = 1; i <= 11; i++) {
        lines.push(`${i}. [H-${i}]: Regla ${i}`);
      }
      const overflowRules = lines.join("\n");
      // Menos de 30 líneas pero más de 10 reglas
      expect(overflowRules.split("\n").length).toBeLessThanOrEqual(30);

      const res = validateLearnedHeuristics(overflowRules);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Límite de heurísticas excedido"))).toBe(true);
    });

    it("valida formato de fecha_actualizacion y reglas_count en frontmatter de learned_heuristics", () => {
      const invalidActDate = `---
tipo: learned_heuristics
skill: systems-auditor
reglas_count: 0
fecha_actualizacion: 26-10-2026
---
# Reglas
`;
      const res1 = validateLearnedHeuristics(invalidActDate);
      expect(res1.valid).toBe(false);
      expect(res1.errors.some((e) => e.includes("fecha_actualizacion"))).toBe(true);

      const invalidReglasCount = `---
tipo: learned_heuristics
skill: systems-auditor
reglas_count: invalid_number
fecha_actualizacion: 2026-10-26
---
# Reglas
`;
      const res2 = validateLearnedHeuristics(invalidReglasCount);
      expect(res2.valid).toBe(false);
      expect(res2.errors.some((e) => e.includes("reglas_count"))).toBe(true);

      const validZeroRules = `---
tipo: learned_heuristics
skill: backend-architect
reglas_count: 0
fecha_actualizacion: 2026-10-26
---
# Reglas Heurísticas Aprendidas (Harness² FIFO Cache)
`;
      const res3 = validateLearnedHeuristics(validZeroRules);
      expect(res3.valid).toBe(true);
      expect(res3.errors).toHaveLength(0);
    });

    it("acepta tipos canónicos adicionales como documentacion y playbook-agente", () => {
      const docContent = `---
tipo: documentacion
estado: activo
version: v1.0.0
---
# Documento
`;
      const resDoc = validateArtifactContent(docContent);
      expect(resDoc.valid).toBe(true);
      expect(resDoc.errors).toHaveLength(0);

      const playbookContent = `---
tipo: playbook-agente
rol: Autonomous Subagent
tier: Tier Flash (High)
alias: flash
estado: activo
---
# Playbook
`;
      const resPlaybook = validateArtifactContent(playbookContent);
      expect(resPlaybook.valid).toBe(true);
      expect(resPlaybook.errors).toHaveLength(0);
    });
  });
});


