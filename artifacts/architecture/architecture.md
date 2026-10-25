---
tipo: arquitectura
proyecto: Notion_Rastreador_de_Entretenimiento
estado: activo
stack_principal: [Python, Requests, HowLongToBeatPy, Streamlit, Notion-API, Steam-API, TMDB-API, GitHub-Actions]
diagrama_html: PRJ_Notion_Rastreador_de_Entretenimiento_architecture_diagram.html
tags: [proyecto, arquitectura, tech-stack, archify, living-doc]
---

# 🏗️ Arquitectura del Sistema: Notion Rastreador de Entretenimiento

> **Artefacto Vivo (Perpetuo / Zero-Touch):** Este documento representa la arquitectura técnica vigente del sistema. No lleva versión volátil en el frontmatter. Únicamente se modifica cuando cambia el Tech Stack, los límites de infraestructura o la topología global de componentes. Queda estrictamente prohibido usar bloques ```mermaid.

## 🏗️ Tech Stack Oficial

- **Lenguaje & Runtime:** Python 3.10+
- **Bibliotecas de Dominio & HTTP:** `requests`, `howlongtobeatpy`, `python-dotenv`, `urllib.parse`
- **Frontend / Analítica (Opcional / Dashboard):** `streamlit`, `pandas`, `plotly`
- **Persistencia Externa & SSoT:** Notion Database API (`v2022-06-28`), Supabase (driver complementario)
- **APIs de Metadatos de Terceros:**
  - Steam Web API (`IPlayerService`, Store API)
  - The Movie Database (TMDB v3 API)
  - Wikipedia API (`es.wikipedia.org/w/api.php`)
  - HowLongToBeat (HLTB scraper asíncrono/síncrono)
  - RAWG Video Games Database API (fallback opcional)
- **Automatización & CI/CD:** GitHub Actions (cron jobs programados cada 6h y 24h, triggers de despacho manual `workflow_dispatch`)

---

## 📐 Diagrama de Arquitectura Interactivo (Archify)

El diagrama visual de componentes, límites de red y dependencias se genera en formato HTML interactivo autónomo con SVG vectorial vía **Archify**:

🔗 **Ver Diagrama:** [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture_diagram.html|Abrir Diagrama de Arquitectura Interactivo (HTML)]]

*(Archivo en disco: `artifacts/architecture/architecture_diagram.html` | Fuente JSON: `artifacts/architecture/src/architecture_diagram.json`)*

---

## 🏛️ Topología y Flujo de Procesamiento

```text
[ GitHub Actions Cron ]
         │
         ├──► [ games.py ] ──► Steam API / HLTB / Wikipedia ──► [ Notion Games DB ]
         │
         └──► [ movies.py ] ──► TMDB API / Wikipedia ──────────► [ Notion Movies DB ]
```

1. **Disparador:** GitHub Actions inicia el flujo programado según el schedule cron (`games.yml`: `0 */6 * * *`, `peliculas.yml`: `0 6 * * *`).
2. **Ingesta y Filtrado:** El motor consulta Notion para extraer los títulos existentes y evitar duplicados o sobreescritura de campos con bloqueo manual.
3. **Consulta de Proveedores Externos:** Se ejecutan llamadas concurrentes/secuenciales con mecanismos de fallback y normalización fonética/ortográfica.
4. **Mutación de Estado:** Se despachan mutaciones atómicas (`POST` para creación de páginas, `PATCH` para actualización incremental de propiedades) respetando la tasa de refresco y cuotas de la API de Notion.

---

## 📚 Especificaciones Técnicas y Contratos Relacionados

- **Contrato de Datos y API:** [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificación de API y Modelos Notion]]
- **Abstracciones del Sistema y Código:** [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Data Seams]]
- **Sistema de Diseño y Tokens:** [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Sistema de Diseño y Tokens UI/UX]]
