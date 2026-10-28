---
tipo: learned_heuristics
skill: backend-architect
reglas_count: 1
fecha_actualizacion: 2026-10-27
---

# Reglas Heurísticas Aprendidas (Harness² FIFO Cache)

> **Política FIFO:** Máximo 10 reglas y 30 líneas. Al agregar la regla 11, eliminar la más antigua.

- [H-01] Para mitigar sqlite_busy en SQLite, configurar siempre 'PRAGMA busy_timeout = 5000' y modo WAL antes de operaciones concurrentes.
