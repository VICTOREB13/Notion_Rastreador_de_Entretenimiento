# Esquema Canónico: `artifacts/planning/implementation_plan.md`

**Rol:** Hoja de ruta paso a paso para la iteración actual bajo estricto principio YAGNI y SDD.
**Tipo de Artefacto:** Artefacto Delta (Efímero / Por Iteración - Se congela al cerrar versión).
**Agente Responsable:** `Project-Planner`.

---

```markdown
---
tipo: implementation_plan
proyecto: Nombre_Del_Proyecto
iteracion: v0.1.0
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, planning, mvp, yagni, sdd, tdd]
---

# 🎯 Plan de Implementación (Iteración Actual)

> **Instrucción para Project-Planner:** Redacta el plan atómico paso a paso. Cumple estrictamente el principio YAGNI (sin sobre-ingeniería).
> **Principio YAGNI & SDD:** Todo código nace de un contrato previo en `api_spec.md` y una suite TDD antes de codificar la solución.

## 🎯 Objetivo de la Iteración
[Objetivo funcional concreto y medible de este ciclo MVP/Versión.]

## 🛠️ Fases de Ejecución

### Fase 1: Contratos y Especificación SDD (Backend-Architect / Planner)
1. Declarar o actualizar incrementalmente endpoints en `api_spec.md` y abstracciones en `abstractions.md`.
2. Definir esquemas de datos del slice (`*.schema.ts` o FormRequests).

### Fase 2: Construcción Guiada por TDD & Vertical Slice (Backend / Frontend)
1. Escribir tests unitarios de contrato fallidos (Fase Red en runner nativo: Bun, Flutter Test, Pest, pytest).
2. Implementar el slice vertical mínimo (`< 300 LoC`) hasta pasar los tests en verde (Fase Green).
3. Asegurar presupuesto de UI: DOM `< 800` nodos y cero errores de consola.

### Fase 3: Quality Gate & Auditoría ODD (Systems-Auditor)
1. Ejecutar pirámide de tests: unitarios locales (<500ms), smoke tests headless y auditoría exploratoria con Playwright MCP.
2. Auditar presupuesto de DOM, consultas N+1, accesibilidad y dependencias sin vulnerabilidades.
3. Emitir dictamen en `artifacts/audit_reports/audit_report.md` (`veredicto: PASS` obligatorio).

### Fase 4: Release Engineering y Cierre de Versión (DevOps-Engineer)
1. Inspección diferencial (`git log vAnterior..HEAD --oneline` y `git diff`).
2. Sincronización de versión en manifiestos (`package.json`, etc.).
3. Redacción de notas en `changelog_vX.md` y extracción a `release_notes.md`.
4. Commit de cierre (`chore(release): bump version to vX.Y.Z`) y Tag semántico anotado (`git tag -a vX.Y.Z`).
5. Publicación en GitHub Releases (`gh release create vX.Y.Z --notes-file release_notes.md`).
```
