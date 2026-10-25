---
tipo: overview
proyecto: Notion_Rastreador_de_Entretenimiento
version: v1.0.0
estado: activo
fecha: 2026-10-25
tags: [proyecto, overview, artefacto, master-index]
---

# 🚀 Visión General del Proyecto: Notion Rastreador de Entretenimiento

> **Rol del Documento (SSoT del Negocio):** Mantiene la visión de negocio y el estado funcional del proyecto. Aquí es donde reside formalmente la versión global del proyecto (`version: v1.0.0`). Actúa como índice maestro navegable para Obsidian y agentes autónomos bajo el estándar SDLC V8.

## 📖 ¿Qué hace el proyecto?

**Notion Rastreador de Entretenimiento** es un sistema de automatización y orquestación de datos diseñado para sincronizar, consolidar y enriquecer colecciones personales de **Videojuegos** y **Películas** en bases de datos relacionales de **Notion**, ejecutado de forma desatendida mediante **GitHub Actions**.

### Capacidades Nucleares:
1. **Rastreador de Videojuegos (`games.py`):**
   - Sincronización automática con la biblioteca de Steam para títulos con más de 30 minutos de tiempo jugado.
   - Enriquecimiento de metadatos: portadas en alta resolución, enlaces a Wikipedia y géneros.
   - Estimación de tiempos de juego con HowLongToBeat (historia principal y completista).
   - Deduplicación heurística mediante *fuzzy matching* (`difflib.SequenceMatcher`) con normalización de caracteres especiales.
2. **Rastreador de Películas (`movies.py`):**
   - Detección inteligente de nuevos registros ingresados en Notion.
   - Búsqueda multi-estrategia con fallback en The Movie Database (TMDB) extrayendo posters oficiales, sinopsis en español y categorización por género.
   - Vinculación automática a artículos de Wikipedia en español.
   - Política estricta de protección de datos ("candados manuales") para no sobreescribir ediciones personalizadas del usuario.

---

## 🗺️ Índice Oficial de Artefactos

### 🟢 Artefactos Vivos (Perpetuos / SSoT - Zero-Touch Policy)
- **Arquitectura del Sistema:** [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture|Arquitectura del Sistema]]
- **Diagrama Interactivo (Archify):** [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture_diagram.html|Diagrama de Arquitectura Interactivo (HTML)]]
- **Abstracciones de Código:** [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Data Seams]]
- **Contratos de Datos (API):** [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificación de API y Modelos Notion]]
- **Sistema de Diseño (Design System):** [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Sistema de Diseño y Tokens UI/UX]]

### 🟡 Artefactos Delta (Iteración Activa)
- **Plan de Implementación:** [[PRJ_Notion_Rastreador_de_Entretenimiento_implementation_plan|Plan de Implementación (Migración VSA)]]
- **Checklist de Tareas:** [[PRJ_Notion_Rastreador_de_Entretenimiento_task|Checklist de Tareas Atómicas]]
- **Historial de Cambios SemVer:** [[PRJ_Notion_Rastreador_de_Entretenimiento_changelog_v1|Changelog Oficial v1.0.0]]
- **Último Quality Gate:** [[PRJ_Notion_Rastreador_de_Entretenimiento_audit_report|Reporte de Auditoría y Quality Gate]]
