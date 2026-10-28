# Esquema Canónico: `.agents/skills/<skill>/rules/learned_heuristics.md`

**Rol:** Memoria operativa y caché de heurísticas aprendidas del bucle Harness² (Anti-Prompt Drift).
**Tipo de Artefacto:** Reglas del Arnés (Presupuesto estricto: máximo 30 líneas y 10 reglas bajo política FIFO).
**Agente Responsable:** `Systems-Auditor` (registro) / Todos los subagentes (cumplimiento).

---

```markdown
---
tipo: learned_heuristics
skill: systems-auditor
reglas_count: 2
fecha_actualizacion: YYYY-MM-DD
---

# Reglas Heurísticas Aprendidas (Harness² FIFO Cache)

> **Política FIFO:** Máximo 10 reglas y 30 líneas. Al agregar la regla 11, la regla más antigua se purga.

1. [H-01]: [Contexto/Herramienta]: Descripción concisa de la heurística aprendida para prevenir errores recurrentes.
2. [H-02]: [Contexto/Herramienta]: Descripción concisa de la directiva técnica obligatoria.
```
