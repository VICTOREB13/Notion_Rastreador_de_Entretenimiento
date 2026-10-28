# Esquema Canónico: Playbooks de Agentes (`.agents/skills/<agent>/SKILL.md`)

**Rol:** Definición operativa y visualización nativa en Obsidian Properties.
**Tipo de Artefacto:** Documentación de Bóveda Obsidian / Arnés.
**Agente Responsable:** `Project-Planner`.

---

```markdown
---
tipo: playbook-agente
rol: Autonomous Subagent
tier: Tier Flash (High)
alias: flash
estado: activo
tags:
  - agentes
  - backend
  - subagentes
  - modelos
---

# Nombre del Agente (Rol)

> **Misión:** Resumen de alto nivel de las funciones y límites del agente.

## 📋 Especificaciones de Operación
- **Tier & Modelo:** **Tier Flash (High)** (alias Antigravity: `flash`, Gemini Flash High; ver `.agents/models.yaml`).
- **Autoload Skills:** `skill-1`, `skill-2`, `artifact-standards`.
- **Herramientas MCP:** `context7`, `playwright`.
- **Permisos:** Terminal (true), Filesystem (Read/Write), Browser (false).
```
