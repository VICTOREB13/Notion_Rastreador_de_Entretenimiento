# Antigravity Harness³ Core Rules

Este plugin proporciona el arnés autónomo de tercera dimensión (Harness³) para Antigravity CLI:
1. **Sanitización In-Flight y Circuit Breaker (`PreToolUse`)**: Corrección automática de rutas/comandos vía `overwrite` y corte determinista (`decision: "deny"`) ante bloqueos de bucle o agotamiento de presupuesto TDD.
2. **Auto-Curación y Telemetría (`PostToolUse`)**: Auto-sanación determinista de fallas recurrentes con inyección FIFO en `learned_heuristics.md` y registro en `telemetry.db`.
3. **Inyección Efímera (`PreInvocation`)**: Suministro de heurísticas activas mediante `ephemeralMessage` (Zero-Prompt-Bloat), evitando la contaminación permanente del contexto.
4. **Telemetría SQLite y Promoción Cross-Workspace**: Evaluación empírica de heurísticas locales y promoción a reglas globales compartidas.
5. **Quality Gate Guardián (`Stop`)**: Si la sesión editó código, exige contratos SDD alineados y suite de pruebas en verde antes de finalizar; destila la sesión y evalúa la promoción de heurísticas.
