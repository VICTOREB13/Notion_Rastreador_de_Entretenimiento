# Esquema Canónico: `artifacts/audit_reports/audit_report.md`

**Rol:** Reporte de auditoría de Quality Gate y matriz de pruebas imparcial (`veredicto: PASS` o `FAIL`).
**Tipo de Artefacto:** Artefacto Delta (Efímero / Por Iteración - Se congela como registro inmutable al cerrar release).
**Agente Responsable:** `Systems-Auditor`.

---

```markdown
---
tipo: audit_report
proyecto: Nombre_Del_Proyecto
iteracion: v0.1.0
veredicto: PASS
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, audit, quality-gate, odd, harness2]
---

# 🛡️ Reporte de Auditoría y Quality Gate

> **Instrucción para Systems-Auditor:** Eres el guardián imparcial de la calidad. Ningún despliegue se autoriza sin `veredicto: PASS`.
> **Pirámide de Pruebas Escalonada:** Solo los tests de contrato unitarios se corren por commit; los smoke tests y la inspección agéntica Playwright se ejecutan en este Quality Gate.

## 🧪 Pirámide de Pruebas Escalonada
- [ ] **Nivel 1: Tests Unitarios y Contratos SDD (Runner Nativo: Bun, Flutter Test, Pest, pytest):** [Ejecutados localmente en <500ms o runner nativo por slice. 0 fallos, 0 tokens]
- [ ] **Nivel 2: Smoke Tests Deterministas (Playwright Headless):** [Flujos críticos de login, navegación y operaciones clave validados en 2-4s]
- [ ] **Nivel 3: Auditoría Agéntica ODD (Playwright MCP):** [Inspección visual interactiva, consola del navegador sin excepciones y validación de flujos]

## 📊 Auditoría de Rendimiento y Nodos DOM
- [ ] **Auditoría de DOM:** [Medición real con Playwright (`document.querySelectorAll('*').length`). Presupuesto: < 800 recomendado, < 1400 máximo]
- [ ] **Consultas N+1 & Base de Datos:** [Verificación de queries en ORM, índices compuestos y carga ansiosa]

## 🎨 Auditoría de Usabilidad y Psicología de Interacción (`design-everyday-things` & `ux-heuristics`)
- [ ] **Affordances, Signifiers y Feedback:** [Verificación de affordances perceptibles, signifiers claros, prevención activa de errores y retroalimentación inmediata según Don Norman y heurísticas de Nielsen]

## 🛡️ SecOps y Dependencias
- [ ] **Escaneo de Vulnerabilidades:** [`bun pm audit`, `npm audit` o `composer audit` con 0 vulnerabilidades altas o críticas]
- [ ] **Control de Acceso / IDOR:** [Verificación de autorización centralizada y aislamiento de datos]

---

## 🔍 Diagnóstico de Causa Raíz (Root Cause Diagnosis)

- **Tipo de Diagnóstico:** [N/A - Todo en Orden | Defecto de Código | Defecto de Arnés]
- **Detalle de Evaluación:**
  - *Defecto de Código:* La especificación era clara, pero la implementación contiene un bug o regresión.
  - *Defecto de Arnés:* El fallo se originó por ambigüedad en `api_spec.md`/`abstractions.md`, falta de guardrails en las skills, o un mock/linter desalineado.
- **Acción Correctiva del Arnés:** [Si aplica, describir la directiva exacta a corregir en `.agents/` con commit `chore(harness): ...`].

---

## 🚦 Veredicto Final

**veredicto:** PASS
*(O `veredicto: FAIL` si se incumplió algún criterio. Justificar la razón y reasignar tareas en `task.md`)*
```
