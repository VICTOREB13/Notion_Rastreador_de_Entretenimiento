---
tipo: learned_heuristics
skill: systems-auditor
reglas_count: 4
fecha_actualizacion: 2026-10-31
---

# Reglas Heurísticas Aprendidas (Harness² FIFO Cache)

> **Política FIFO:** Máximo 10 reglas y 30 líneas. Al agregar la regla 11, eliminar la más antigua.

1. [H-01]: En Windows PowerShell, ejecutar `bun test` con prefijo `./` (ej: `bun test ./.agents/scripts/...`) para que el runner no ignore la ruta del archivo.
2. [H-02]: En Bun SQLite sobre Windows, cerrar siempre la conexión `db.close()` en bloques finally antes de manipular archivos en disco para prevenir bloqueos EBUSY.
3. [H-03]: En la Fase 6 de auditoría, ejecutar `bun run .agents/scripts/distill_session.ts` y evaluar `_workspace/friction_report.md` antes del veredicto final.
- [H-04] Para lecturas extensas o múltiples archivos, priorizar 'grep_search', 'find_by_name' o scripts en scripts/ para evitar agotar el límite de lecturas.
