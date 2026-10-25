---
tipo: implementation_plan
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: v1.0.0
estado: activo
fecha: 2026-10-25
tags: [proyecto, planning, vsa, yagni, sdd, tdd]
---

# 🎯 Plan de Implementación: Migración VSA y Ecosistema SDLC V8

> **Artefacto Delta (Efímero / Por Iteración):** Define el alcance atómico, la delimitación de slices y las fases paso a paso para la adopción de la Arquitectura V8 bajo estricto principio YAGNI.
> **Principio YAGNI & SDD:** Cada cambio arquitectónico debe responder a un contrato previo en `api_spec.md` y formalizarse con una suite TDD co-localizada antes de modificar lógica de negocio.

---

## 🎯 Objetivo de la Iteración

Normalizar y migrar el repositorio **Notion Rastreador de Entretenimiento** a la Arquitectura SDLC V8 de Agentes, evolucionando los scripts monolíticos (`games.py` y `movies.py`) hacia **Vertical Slice Architecture (VSA)** con pruebas unitarias co-localizadas bajo `pytest` (< 500ms), asegurando observabilidad ODD, cumplimiento del sistema de diseño y preparación del bucle de auto-mejora Harness².

---

## 🛠️ Fases de Ejecución

### Fase 1: Normalización de Artefactos Vivos y Contratos SDD (Project-Planner / Backend-Architect)
1. Consolidar los 5 Artefactos Vivos perpetuos en `artifacts/` eliminando sufijos volátiles y garantizando YAML frontmatter plano en snake_case.
2. Formalizar el esquema de bases de datos de Notion y los contratos de endpoints en `artifacts/architecture/api_spec.md`.
3. Sincronizar las abstracciones de código, funciones puras y data seams en `artifacts/architecture/abstractions.md`.
4. Establecer el sistema de diseño visual y tokens en `artifacts/architecture/design_system.md`.

### Fase 2: Descomposición en Vertical Slice Architecture (VSA) (Backend-Architect)
1. Reestructurar la base de código modularizando por dominios funcionales independientes:
   - `src/features/games/`: Ingesta de Steam, deduplicación fuzzy, consulta HLTB y sincronización Notion.
   - `src/features/movies/`: Fallback en cascada TMDB, búsqueda en Wikipedia y enriquecimiento Notion.
   - `src/core/clients/`: Clientes HTTP tipados con manejo determinista de errores y backoff para Notion, Steam, TMDB y Wikipedia.
2. Garantizar que cada módulo y controlador no exceda el límite de `300 LoC`.
3. Preservar intactas las interfaces de ejecución existentes para que los workflows de GitHub Actions (`games.yml` y `peliculas.yml`) continúen operando de forma transparente.

### Fase 3: Construcción Guiada por TDD & Pirámide de Pruebas (Backend-Architect / Systems-Auditor)
1. Co-localizar pruebas unitarias nativas con `pytest` para cada slice:
   - `src/features/games/tests/test_games.py`: Validación de `limpiar_nombre`, `similar` y lógica de estados finales.
   - `src/features/movies/tests/test_movies.py`: Validación de regex de extracción de año, fallbacks de búsqueda y protección de candados.
2. Configurar mocks deterministas offline para llamadas de red (ejecución Nivel 1 en `< 500ms`).
3. Verificar la ejecución de smoke tests headless (Nivel 2) y emitir el reporte inicial en `artifacts/audit_reports/audit_report.md`.

### Fase 4: Auditoría ODD y Cierre de Iteración (Systems-Auditor / DevOps-Engineer)
1. Evaluar la cobertura de pruebas, ausencia de consultas N+1 y consumo de tokens.
2. Confirmar que `release.yml` se mantiene omitido/intacto hasta nuevo aviso explícito del usuario.
3. Consolidar los cambios con commit semántico:
   `feat(v8): migrar proyecto a arquitectura sdlc v8 con bucle harness2 y artefactos vivos`.
