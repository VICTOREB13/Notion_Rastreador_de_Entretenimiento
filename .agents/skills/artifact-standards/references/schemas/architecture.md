# Esquema Canónico: `artifacts/architecture/architecture.md`

**Rol:** Tech Stack oficial, límites de componentes y enlace al diagrama interactivo Archify.
**Tipo de Artefacto:** Artefacto Vivo (Living Artifact - Zero-Touch).
**Agente Responsable:** `Project-Planner` / `Backend-Architect`.

---

```markdown
---
tipo: arquitectura
proyecto: Nombre_Del_Proyecto
estado: activo
stack_principal: [Next.js, Tailwind CSS, PostgreSQL, Docker]
diagrama_html: PRJ_Nombre_Del_Proyecto_architecture_diagram.html
tags: [proyecto, arquitectura, tech-stack, archify, living-doc]
---

# 🏗️ Arquitectura del Sistema: [Nombre_Del_Proyecto]

> **Instrucción para Project-Planner / Backend-Architect:** Define el Tech Stack exacto y enlaza el diagrama generado con Archify. Queda estrictamente prohibido usar bloques ```mermaid.
> **Política Zero-Touch:** No lleva versión volátil en el frontmatter. Solo se modifica si cambia el Tech Stack o la topología de red/infraestructura.

## 🏗️ Tech Stack Oficial

- **Frontend:** [Framework, Lenguaje, Bibliotecas UI]
- **Backend:** [Framework, Lenguaje, Runtime]
- **Base de Datos & Cache:** [Motor SQL/NoSQL, Índices, ORM]
- **Infraestructura & Contenedores:** [Docker, Docker Compose, Proxy Nginx/Caddy]

---

## 📐 Diagrama de Arquitectura Interactivo (Archify)

El diagrama de componentes, flujos y fronteras del sistema se mantiene como archivo HTML independiente con SVG interactivo:

🔗 **Ver Diagrama:** [[PRJ_{PROYECTO}_architecture_diagram.html|Abrir Diagrama de Arquitectura Interactivo]]

*(Ubicación en disco: `artifacts/architecture/architecture_diagram.html` | Archivo fuente JSON: `artifacts/architecture/src/architecture_diagram.json`)*
```
