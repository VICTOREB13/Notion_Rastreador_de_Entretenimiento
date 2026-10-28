---
tipo: arquitectura
proyecto: Notion_Rastreador_de_Entretenimiento
estado: activo
stack_principal: [TypeScript, Bun, Hono-RPC, Prisma-ORM, SQLite, Google-GenAI, Next.js-16, Notion-API, Steam-API, TMDB-API]
diagrama_html: PRJ_Notion_Rastreador_de_Entretenimiento_architecture_diagram.html
tags: [proyecto, arquitectura, tech-stack, archify, modular-monolith, sqlite, living-doc]
---

# 🏗️ Arquitectura del Sistema: Notion Rastreador de Entretenimiento

> **Artefacto Vivo (Perpetuo / Zero-Touch):** Este documento representa la arquitectura técnica vigente del sistema. No lleva versión volátil en el frontmatter. Únicamente se modifica cuando cambia el Tech Stack, los límites de infraestructura o la topología global de componentes. Queda estrictamente prohibido usar bloques ```mermaid.

## 🏗️ Tech Stack Oficial

- **Lenguaje & Runtimes:** TypeScript 5.8+ sobre **Bun 1.4+** (alta velocidad en ejecución y testing nativo con `bun test`).
- **Framework Web & RPC:** **Hono v4+** con exportación de `AppType` para RPC tipado de extremo a extremo hacia el frontend.
- **Persistencia Local-First:** **SQLite 3** embebido (`file:./data/entertainment.db`) con **Prisma ORM** (cero dependencias de PostgreSQL, transacciones ACID locales y latencia <1ms).
- **Frontend Showcase Web:** **Next.js 16 (App Router)** con Tailwind CSS v4, Motion y el catálogo estético de Marca Personal (`SpotlightCard`, `DarkIslandSplineCard`, `ConsolidatedMetricBand`, etc.).
- **Persistencia Externa & Headless CMS:** Notion Database API (`v2022-06-28`) con sondeo incremental inteligente por `last_edited_time`.
- **Selector Dinámico de IA Multi-Proveedor:**
  - Google Gemini (`@google/genai` con `gemini-2.5-flash`)
  - DeepSeek API (`deepseek-chat`)
  - Groq LPU (`llama-3.3-70b-versatile`)
  - Ollama Local (`http://localhost:11434`)
- **APIs de Metadatos de Terceros:**
  - Steam Web API (`IPlayerService`, `ISteamUser`, Store API)
  - The Movie Database (TMDB v3 API)
  - Wikipedia API (`es.wikipedia.org/w/api.php`)
  - HowLongToBeat (HLTB scraper)

---

## 📐 Diagrama de Arquitectura Interactivo (Archify)

El diagrama visual de componentes, límites de red y dependencias se genera en formato HTML interactivo autónomo con SVG vectorial vía **Archify**:

🔗 **Ver Diagrama:** [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture_diagram.html|Abrir Diagrama de Arquitectura Interactivo (HTML)]]

*(Archivo en disco: `artifacts/architecture/architecture_diagram.html` | Fuente JSON: `artifacts/architecture/src/architecture_diagram.json`)*

---

## 🏛️ Topología y Flujo de Procesamiento

```text
┌─────────────────────────┐
│ External APIs & Cloud   │
│ (Steam, Notion, TMDB)   │
└────────────┬────────────┘
             │
             ▼
┌───────────────────────────────────────────────┐
│      MODULAR MONOLITH BACKEND (Bun 1.4+)      │
│  ┌────────────────────┐   ┌─────────────────┐ │
│  │ Daemon API Core    ├──►│ SQLite Embebido │ │
│  │ (Hono RPC/Workers) │   │ (Prisma ORM)    │ │
│  └─────────┬──────────┘   └─────────────────┘ │
└────────────┼──────────────────────────────────┘
             │ Hono RPC (hc<AppType>)
             ▼
┌─────────────────────────┐
│ Next.js 16 Showcase UI  │
│ (Bento, Spline, Live)   │
└─────────────────────────┘
```

1. **Daemon Desatendido:** Workers en segundo plano ejecutándose en Bun 1.4+ que gestionan el sondeo incremental de Notion (cada 120s) y el monitoreo en vivo de Steam (cada 60s).
2. **Persistencia SQLite:** Almacena catálogo consolidado, historial de sesiones atómicas (`GameSession`) y agregados de series temporales (`DailyPlaytime`).
3. **Pipeline de Enriquecimiento IA:** Selector polimórfico que genera análisis de Vibe, pitch personalizado y tropos narrativos en JSON determinista.
4. **Showcase Web:** Consume la API en tiempo real con latencias sub-milisegundo para renderizar las tarjetas Bento, el badge interactivo "Jugando AHORA" y las curvas de horas de juego.

---

## 📚 Especificaciones Técnicas y Contratos Relacionados

- **Contrato de Datos y API:** [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificación de API y Modelos SQLite]]
- **Abstracciones del Sistema y Código:** [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Data Seams]]
- **Sistema de Diseño y Tokens:** [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Sistema de Diseño y Tokens UI/UX]]
