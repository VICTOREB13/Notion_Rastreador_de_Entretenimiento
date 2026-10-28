---
name: artifact-standards
description: >-
  Enforce strict YAML frontmatter schemas, file structures, Obsidian wikilink conventions,
  system code abstractions (abstractions.md), and Archify HTML diagram integration across all project artifacts
  (overview, architecture, abstractions, api_spec, implementation_plan, task, changelog, audit_report).
  Prevents typing errors, schema mismatches, and broken references.
auto_load_skills: []
permissions:
  browser: false
  terminal: false
  file_system: read_write
---

# Artifact Standards & Schema Enforcement (Anti-Typo Protocol)

Canonical, non-negotiable specification for all Markdown and HTML artifacts authored by agents (`Project-Planner`, `Backend-Architect`, `Frontend-UI`, `Systems-Auditor`, `DevOps-Engineer`). Ensures Obsidian Properties native compatibility, zero typos, and deterministic validation.

> **Output Language Directive:** ALWAYS communicate with the user, report progress, and author living/delta markdown artifacts in **SPANISH**.

## Core Directives & Golden Rules

1. **Mandatory YAML Frontmatter:** Must start strictly at line 1 with `---` and close with `---`. No blank lines or text before it.
2. **Obsidian Flat Properties:** FORBIDDEN to nest YAML objects. All keys must be first-level flat lowercase: `tipo`, `proyecto`, `version`, `iteracion`, `estado`, `fecha`, `veredicto`, `stack_principal`, `tags`.
3. **Strict Typed Values:**
   - `tipo`: canonical snake_case (`overview`, `arquitectura`, `api_spec`, `abstracciones`, `design_system`, `implementation_plan`, `task_list`, `changelog`, `audit_report`, `playbook-agente`, `learned-heuristics`, `documentacion`).
   - `veredicto`: strictly `PASS` or `FAIL` (uppercase).
   - `estado`: `activo`, `borrador`, `completado`, `congelado`.
   - `fecha`: ISO format `YYYY-MM-DD`.
   - Colons `: ` in values must be wrapped in `"..."` or split into atomic keys.
4. **Obsidian Wikilinks:** Cross-reference format `[[PRJ_{PROYECTO}_{artefacto}|{Alias}]]`. FORBIDDEN to use `file:///` or un-prefixed wikilinks.
5. **Zero Mermaid (Archify HTML):** ````mermaid```` blocks strictly forbidden. Diagrams must be interactive standalone HTML in `artifacts/architecture/` (`architecture_diagram.html`) backed by JSON specs in `artifacts/architecture/src/`.
6. **Deterministic Validator:** FORBIDDEN to eyeball validation. Must execute:
   `bun .agents/skills/artifact-standards/scripts/validate_artifact.ts <file.md> [--schema <path>] [--heuristics]`
7. **Active Research via `context7` MCP:** Use `context7` (`resolve-library-id`, `query-docs`) for external JSON Schema specs or YAML parsers. FORBIDDEN to search local repository files or notes.

## Schema Catalog (On-Demand Loading)

| Artifact | Type | Target Path | Reference Schema |
|---|---|---|---|
| **Project Overview** | Living | `artifacts/project_overview.md` | [`references/schemas/overview.md`](references/schemas/overview.md) |
| **Architecture** | Living | `artifacts/architecture/architecture.md` | [`references/schemas/architecture.md`](references/schemas/architecture.md) |
| **API Spec** | Living | `artifacts/architecture/api_spec.md` | [`references/schemas/api_spec.md`](references/schemas/api_spec.md) |
| **Abstractions** | Living | `artifacts/architecture/abstractions.md` | [`references/schemas/abstractions.md`](references/schemas/abstractions.md) |
| **Design System** | Living | `artifacts/architecture/design_system.md` | [`references/schemas/design_system.md`](references/schemas/design_system.md) |
| **Implementation Plan** | Delta | `artifacts/planning/implementation_plan.md` | [`references/schemas/implementation_plan.md`](references/schemas/implementation_plan.md) |
| **Task Checklist** | Delta | `artifacts/planning/task.md` | [`references/schemas/task.md`](references/schemas/task.md) |
| **Changelog & Releases** | Delta | `artifacts/planning/changelog_vX.md` | [`references/schemas/changelog.md`](references/schemas/changelog.md) |
| **Audit Report** | Delta | `artifacts/audit_reports/audit_report.md` | [`references/schemas/audit_report.md`](references/schemas/audit_report.md) |
| **Agent Playbooks** | Harness | `.agents/skills/<agent>/SKILL.md` | [`references/schemas/playbook.md`](references/schemas/playbook.md) |
| **Learned Heuristics** | FIFO | `.agents/skills/<skill>/rules/learned_heuristics.md` | [`references/schemas/learned_heuristics.md`](references/schemas/learned_heuristics.md) |
