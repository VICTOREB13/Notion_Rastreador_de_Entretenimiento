# Esquema Canónico: `artifacts/planning/changelog_vX.md`

**Rol:** Historial versionado de iteraciones y releases según Keep a Changelog + Semantic Versioning, con métricas cuantitativas, erradicación de AI slop y sincronización directa con GitHub Releases (`gh release create`).
**Tipo de Artefacto:** Artefacto Delta (Efímero durante iteración / Congelado por versión mayor).
**Agente Responsable:** `DevOps-Engineer` / `Project-Planner`.

---

```markdown
---
tipo: changelog
proyecto: Nombre_Del_Proyecto
version: v1.0.0
estado: activo
fecha: YYYY-MM-DD
tags: [proyecto, changelog, versiones, release, quality-gate]
---

# Registro de Cambios (Changelog) - [Nombre_Del_Proyecto]

Todos los cambios notables de este proyecto se documentarán en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]
_Cambios en desarrollo en la iteración activa pendientes de corte de versión y tag oficial._

---

## [X.Y.Z] - YYYY-MM-DD (Descriptor Temático / Subtítulo del Release)

### Added & Modularized
- **Descomposición Modular & Nuevos Componentes (`ruta/al/componente.ext`):**
  - Creación de widgets o servicios modulares desacoplados respetando el principio de responsabilidad única (SRP).
  - Reducción drástica de complejidad ciclomática y modularización de archivos monolíticos (< 300 LoC por pantalla o módulo).
  - Métricas cuantitativas del cambio: reducción neta de LoC (ej. `-85.0% global`, de `6,455` a `969 LoC`), catálogo de nuevos módulos y funciones.

### Refactored & Enhanced
- **Centralización y Arquitectura Canónica (`ruta/al/servicio.ext`):**
  - Unificación de fuentes de verdad (ej. Helpers globales, gestión centralizada de estados y temas).
  - Implementación de patrones de resiliencia (HTTP resiliente, reintentos con backoff, inmutabilidad).
  - Encapsulación de lógica de negocio y reglas de dominio fuera de las capas de presentación.

### Removed & Optimized (Anti-Slop)
- **Poda Global de AI Slop y Optimización de Assets:**
  - Erradicación sistemática de comentarios didácticos redundantes de IA (ej. `// Save button`, `// Title`, notas explicativas obvias).
  - Depuración de assets huérfanos y paquetes/dependencias inactivas (ej. reducción de `X KB/MB` en bundle final).
  - Elevación del estándar hacia código limpio, idiomático y profesional.

### Fixed & Enhanced
- **Corrección de Errores de Dominio y Persistencia (`ruta/al/archivo.ext`):**
  - Diagnóstico preciso de causa raíz (Root Cause) y solución implementada sin parches superficiales.
  - Soporte canónico de valores nulos o estados límite (ej. Patrón Sentinel, saneamiento de entradas).
  - Robustez en llamadas de red y manejo defensivo de memoria (límites de longitud en strings y rangos numéricos acotados).

### Modernized & Upgraded
- **Migración a Estándares y APIs Modernas:**
  - Sustitución de APIs deprecadas por las directivas actuales oficiales de los frameworks y lenguajes.
  - Alineación de compilación, versiones de SDK y compatibilidad de herramientas CI/CD.

### Quality Gate & DevOps
- **Certificación de Pruebas Automatizadas & Pipeline:**
  - Ejecución de suites deterministas offline con 100% de tasa de aprobación (ej. `17 suites / 99 tests exitosos`).
  - Veredicto vinculante de `audit_report.md`: `PASS (QUALITY GATE CERTIFIED)`.
  - Configuración y validación de pipelines de compilación multi-plataforma y empaquetado de binarios en CI/CD.

### Security
- **Hardening y Protección de Datos:**
  - Sanitización de consultas y erradicación de vulnerabilidades IDOR / inyección.
  - Gestión cifrada y segura de credenciales y API keys.
```

---

## 📐 Reglas Estrictas de Redacción de Changelog & GitHub Releases

1. **Métricas Cuantitativas Obligatorias:** No uses afirmaciones vagas. Siempre que aplique, incluye métricas verificables: porcentaje de reducción de LoC, cantidad exacta de nuevos módulos creados, suites de tests aprobados, milisegundos de latencia o bytes optimizados.
2. **Rutas y Símbolos Explícitos:** Cita siempre los nombres de archivos (`path/to/file.ext`), clases (`ClassName`) y métodos (`methodName()`) modificados usando backticks.
3. **Cero AI Slop:** Queda estrictamente prohibido incluir viñetas genéricas tipo *"Mejoras generales de rendimiento"*, *"Corrección de varios errores menores"* o *"Actualización de código"*. Cada entrada debe explicar el problema real y la solución arquitectónica.
4. **Sincronización con GitHub Releases:** La sección completa de la versión en `changelog_vX.md` constituye la fuente de verdad directa para el cuerpo de `gh release create`, garantizando que tanto el historial en el repositorio como la release oficial en GitHub luzcan un acabado técnico impecable.
