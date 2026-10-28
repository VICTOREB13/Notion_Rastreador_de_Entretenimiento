# Esquema Canónico: `artifacts/project_overview.md`

**Rol:** Visión general del proyecto, índice de navegación oficial y Single Source of Truth (SSoT) de la versión global.
**Tipo de Artefacto:** Artefacto Vivo (Perpetuo / SSoT - Zero-Touch en Patch/Minor).
**Agente Responsable:** `Project-Planner`.

---

```markdown
---
tipo: overview
proyecto: Nombre_Del_Proyecto
version: v0.1.0
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, overview, artefacto]
---

# 🚀 Visión General del Proyecto: [Nombre_Del_Proyecto]

> **Instrucción para Project-Planner:** Actualiza este archivo en cada iteración para reflejar qué hace el proyecto en su estado actual (términos de negocio y funcionalidad clave).

## 📖 ¿Qué hace el proyecto?
[Descripción concisa y orientada al usuario final del sistema o prototipo actual.]

---

## 🗺️ Índice Oficial de Artefactos

- **Arquitectura:** [[PRJ_{PROYECTO}_architecture|Arquitectura del Sistema]]
- **Diagrama Interactivo:** [[PRJ_{PROYECTO}_architecture_diagram.html|Diagrama HTML (Archify)]]
- **Abstracciones:** [[PRJ_{PROYECTO}_abstractions|Abstracciones]]
- **Contrato de Datos (API):** [[PRJ_{PROYECTO}_api_spec|Especificación de API y Modelos]]
- **Sistema de Diseño:** [[PRJ_{PROYECTO}_design_system|Sistema de Diseño y Tokens]]
- **Plan de Implementación:** [[PRJ_{PROYECTO}_implementation_plan|Plan de Implementación Actual]]
- **Checklist de Tareas:** [[PRJ_{PROYECTO}_task|Checklist de Tareas]]
- **Historial de Cambios:** [[PRJ_{PROYECTO}_changelog_v1|Registro de Versiones (Changelog)]]
- **Último Reporte de Auditoría:** [[PRJ_{PROYECTO}_audit_report|Reporte de Auditoría (Quality Gate)]]
```
