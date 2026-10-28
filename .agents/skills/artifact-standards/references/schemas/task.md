# Esquema Canónico: `artifacts/planning/task.md`

**Rol:** Checklist de tareas atómicas con asignación explícita de subagente responsable.
**Tipo de Artefacto:** Artefacto Delta (Efímero / Por Iteración - Se congela al cerrar versión).
**Agente Responsable:** `Project-Planner` (creación) y todos los agentes (actualización).

---

```markdown
---
tipo: task_list
proyecto: Nombre_Del_Proyecto
iteracion: v0.1.0
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, tasks, checklist, vsa, tdd]
---

# Checklist de Tareas

> **Instrucción para Agentes:** Marcar con `[x]` al completar cada tarea. Toda tarea debe indicar su subagente responsable explícitamente entre paréntesis: `[ ] (Nombre-Agente) Descripción`.
> **Desarrollo Guiado por VSA & TDD:** Cada slice vertical co-localiza esquemas y tests unitarios antes de implementar la funcionalidad.

## Tareas Pendientes

- [ ] (Project-Planner) Diseñar arquitectura técnica, registrar contratos y generar `architecture_diagram.html` con Archify.
- [ ] (Backend-Architect) Redactar `api_spec.md`/`abstractions.md`, co-localizar esquemas de validación de slice y suite de tests unitarios TDD (Fase Red).
- [ ] (Backend-Architect) Implementar el slice vertical VSA para pasar tests en verde (Fase Green) asegurando cero consultas N+1.
- [ ] (Frontend-UI) Diseñar vistas responsivas consumiendo `api_spec.md`, respetando presupuesto DOM (<800 nodos) y cero errores en consola.
- [ ] (Systems-Auditor) Ejecutar pirámide de tests de 3 niveles (unitarios, smoke headless y auditoría Playwright MCP), emitiendo veredicto en `audit_report.md`.
- [ ] (DevOps-Engineer) Validar Quality Gate PASS, ejecutar pipeline de release determinista de 6 pasos y publicar release semántico con `gh release create`.
```
