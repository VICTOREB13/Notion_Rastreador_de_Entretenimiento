---
tipo: documentacion
proyecto: Arquitectura_Agentes_V8
version: v8.0.0-research
estado: completado
fecha: 2026-10-24
tags:
  - dagger
  - e2e
  - layerfs
  - taste-skill
  - vertical-slice
  - harness2
  - arquitectura
  - v8
---

# 🏛️ Auditoría Técnica y Veredicto Arquitectónico: Evaluación de Nuevas Prácticas y Herramientas para la V8

> **Propósito:** Evaluar con rigor técnico y crítico la viabilidad de incorporar **Dagger 1.0 Beta**, **E2E Tester Army**, **LayerFS**, **Taste-Skill**, **Vertical Slice Architecture** y **Google Research Harness²** al ecosistema de desarrollo multiagente en **Antigravity CLI** sobre un entorno Windows 11 / Laragon / Bun / Git.

---

## 📊 Matriz Ejecutiva de Decisión

| Herramienta / Concepto | Veredicto | ¿Por qué NO como dependencia directa? (Riesgos y Fricción) | La Gema / Concepto Nuclear que SÍ Adoptamos en V8 |
| :--- | :---: | :--- | :--- |
| **Dagger 1.0 Beta** | ❌ **DESCARTAR** | Requiere Docker/WSL2; problemas de red con servicios Win32 de Laragon (MySQL/PHP); DAGs y GraphQL que ofuscan la salida para los subagentes; añade 10-20s por ciclo. | **Test-Native Granularity:** Ejecutar exclusivamente los tests asociados al `git diff` o al Vertical Slice modificado vía `bun test --filter`. |
| **E2E Tester Army** | ⚠️ **DESCARTAR PAQUETE / ADOPTAR ARQUITECTURA** | Depende de APIs externas (facturación aparte fuera de Antigravity); la "auto-curación" de selectores enmascara regresiones en TDD/SDD. | **Pirámide de Testing Escalonada de 3 Niveles** (Tests unitarios Bun -> Smoke tests Playwright headless -> Auditoría agéntica en PRs). |
| **LayerFS** | ❌ **DESCARTAR** | Diseñado para Linux FUSE (`/dev/fuse`); emulación en Windows con WinFsp genera bloqueos de archivo y riesgo de corrupción en MySQL/Laragon. | **Espacios Efímeros con `git worktree` + NTFS Directory Junctions (`mklink /J`)**: Aislamiento total sin duplicar `node_modules` ni `vendor`. |
| **Taste-Skill** | 💎 **YA DISPONIBLE (Uso Condicionado)** | Ya está instalada como `design-taste-frontend`. Su propia regla fundacional prohíbe usarla en dashboards, tablas de datos o software transaccional. | **Inferencia de Dials (`VARIANCE`, `MOTION`, `DENSITY`)** y declaración obligatoria de "Design Read" en el prompt para evitar el *Skill Bypass*. |
| **Vertical Slice Architecture (VSA)** | 🚀 **NÚCLEO ESTRUCTURAL V8** | Ninguno. Resuelve la dispersión de archivos del MVC, elimina colisiones de Git entre subagentes y mantiene los archivos `< 300 LoC`. | **Co-localización de Contratos y Tests:** El slice implementa el contrato de `api_spec.md` y valida su propio TDD de forma autocontenida. |
| **Harness² (Google Research)** | 💡 **INTEGRACIÓN METODOLÓGICA (No Runtime)** | El framework en Python es para benchmarks sintéticos y dispararía el consumo de tokens 8x si se ejecutara en vivo como bucle ciego. | **Bucle de Auto-Mejora del Arnés en Git:** Convertir los fallos de Quality Gate en commits `chore(harness): ...` sobre `.agents/` y skills. |

---

## 1. Dagger 1.0 Beta (`dagger-10-beta`)

### 1.1 Diagnóstico Técnico
Dagger 1.0 Beta introduce un motor *"Test-Native CI"* que analiza el grafo de dependencias y reejecuta únicamente los tests modificados, apoyándose en su nuevo lenguaje ("Dang").

### 1.2 Por qué es una Mala Idea en tu Entorno Específico
1. **Colisión de Red Bare-Metal (Laragon vs. Contenedores):** Laragon opera como servicio Win32 nativo en tu máquina (`localhost:3306`, `localhost:80`). Dagger se ejecuta obligatoriamente dentro de un motor de contenedores en WSL2. Conectar Dagger a tu MySQL local requiere configurar túneles hacia `host.docker.internal`, introduciendo fragilidad en cada ejecución.
2. **Penalización de Rendimiento en Windows:** Levantar el daemon de Dagger, resolver capas OCI y exportar el grafo de BuildKit toma entre **8 y 20 segundos por ejecución**. En contraste, `bun test` corre localmente en **120 milisegundos**.
3. **Ofuscación de Logs para el LLM:** Cuando un test falla en Dagger, el error viene envuelto en capas de telemetría de GraphQL y Docker, consumiendo miles de tokens innecesarios para que el subagente entienda qué línea de código falló.

### 1.3 Qué Extraemos para la V8
* **Filtrado Inteligente de Pruebas:** Adoptar el principio "Test-Native" sin Dagger. En lugar de ejecutar `bun test` en toda la suite, el agente ejecuta `bun test --filter <nombre_del_slice>` apuntando solo a los archivos modificados en su `git status`.

---

## 2. E2E Tester Army (`e2e.tester.army`)

### 2.1 Diagnóstico Técnico
Un framework que promete optimizar tokens combinando selectores deterministas con pasos guiados por IA (`agent.act()`), almacenando en caché la resolución de la interfaz.

### 2.2 Por qué Descartar el Paquete y Adoptar el Concepto
1. **Riesgo Crítico de Falsos Positivos por "Auto-Curación":** En TDD y SDD, si un campo cambia de nombre o un botón desaparece, el test **debe fallar** de inmediato. Los agentes que "auto-curan" selectores se adaptan al error en lugar de denunciarlo, validando código que viola la especificación.
2. **Duplicidad de Facturación:** Antigravity CLI ya es un entorno de agentes con modelos de frontera. Añadir un SDK que consulta a OpenAI/Anthropic por fuera fragmenta la auditoría de costes y añade claves de API redundantes.

### 2.3 Qué Extraemos para la V8: La Pirámide de Testing Escalonada
Adoptamos al 100% tu planteamiento: **no correr todos los tests en cada commit**.

```
                  ▲
                 / \
                /   \     NIVEL 3: Auditoría Agéntica ODD (Playwright MCP)
               /     \    Solo en Quality Gates de PR / Releases. Inspección visual,
              /───────\   DOM (<800 nodos), consola del navegador y flujo completo.
             /         \
            /           \   NIVEL 2: Smoke Tests Deterministas (Playwright Headless)
           /             \  Scripts estáticos de flujos críticos (Login, Checkout).
          /───────────────\ Cero tokens. Ejecución local en 2-4 segundos.
         /                 \
        /                   \  NIVEL 1: Contratos SDD y Tests Unitarios (Bun Test / Pest)
       /                     \ Ultra-rápidos (<500ms). Se ejecutan antes de cada commit.
      /───────────────────────\ Co-localizados en el Vertical Slice. 0 tokens consumidos.
```

---

## 3. LayerFS (`Ephemeral-AI-Lab/layerfs`)

### 3.1 Diagnóstico Técnico
LayerFS es un sistema de archivos virtual Copy-on-Write (CoW) sobre SQLite enfocado en agentes. A diferencia de un `git worktree` puro, LayerFS retiene archivos ignorados (`node_modules/`, `vendor/`) en un snapshot virtual.

### 3.2 Por qué es Inviable en Windows
1. **Dependencia FUSE:** Requiere controladores de espacio de usuario Linux (`/dev/fuse`). En Windows, esto exige WinFsp, que históricamente sufre de bloqueos de I/O en NTFS, incompatibilidades de permisos con PowerShell y falsos positivos de Windows Defender.
2. **Corrupción en Laragon:** Los bloqueos de archivo virtuales de LayerFS chocan frontalmente con el motor de almacenamiento InnoDB de MySQL y el gestor de sesiones de Apache/PHP.

### 3.3 La Solución Nativa: `git worktree` + NTFS Directory Junctions
Logramos exactamente el mismo beneficio (aislamiento instantáneo y cero duplicación de almacenamiento) con herramientas estándar del sistema operativo:

```powershell
# 1. Crear el worktree aislado para el subagente
git worktree add ..\worktree-backend agent/backend

# 2. Enlace simbólico de directorio NTFS (Zero-Copy instantáneo sin duplicar gigabytes)
cmd /c mklink /J "..\worktree-backend\node_modules" ".\node_modules"
```
* **Ventajas:** `mklink /J` opera a nivel del kernel NTFS nativo de Windows, **no requiere permisos de Administrador**, es instantáneo y es 100% compatible con Git, Bun y Laragon.

---

## 4. Taste-Skill (`Leonxlnx/taste-skill`)

### 4.1 Estado Actual en el Ecosistema
Ya está instalada en tu sistema bajo `.gemini/config/skills/design-taste-frontend/SKILL.md` y referenciada en `.agents/models.yaml`.

### 4.2 Advertencia de Uso y Delimitación
La regla número 1 de la skill declara taxativamente:
> *Landing pages, portfolios, and redesigns. Not dashboards, not data tables, not multi-step product UI.*

* **Cuándo usarla:** Sitios de marketing, páginas de inicio y rediseños de marca.
* **Cuándo NO usarla:** Dashboards de administración, sistemas de inventario o tablas de datos (donde el uso de tipografías editoriales y márgenes dramáticos degrada la usabilidad). Para software transaccional, las skills correctas son `ui-ux-pro-max` y `refactoring-ui`.

### 4.3 Protocolo Anti-Bypass
Para forzar al subagente a no ignorar la skill, el orquestador inyecta en el prompt:
```markdown
[DIRECTIVA OBLIGATORIA]: Aplica design-taste-frontend:
1. Emite tu 'Design Read' en 1 línea antes del código.
2. Configura los Three Dials: DESIGN_VARIANCE (1-10), MOTION_INTENSITY (1-10), VISUAL_DENSITY (1-10).
3. Prohibido usar degradados 'AI-purple' o componentes genéricos de 3 columnas.
```

---

## 5. Vertical Slice Architecture (VSA) y AI Pair Programming

### 5.1 Por qué es la Mayor Revolución para Agentes de Código
En la arquitectura tradicional en capas (MVC / Clean):
* Modificar una funcionalidad simple obliga a abrir archivos en 6 carpetas distintas (`Controllers/`, `Models/`, `Services/`, `Requests/`, `Views/`, `Routes/`).
* Esto satura la ventana de contexto del LLM y genera **conflictos de merge catastróficos** cuando dos subagentes trabajan en paralelo.

### 5.2 Estructura VSA en tu Stack
Vertical Slice agrupa todo lo que cambia junto en **un único directorio autocontenido por caso de uso**:

```
src/features/auth/login/
├── login.route.ts      # Endpoint del caso de uso
├── login.schema.ts     # Contrato SDD (Zod / Request validation)
├── login.service.ts    # Lógica de negocio pura (<150 LoC)
└── login.test.ts       # Suite TDD co-localizada ejecutada en 50ms por Bun
```

* **Cumplimiento automático de `< 300 LoC`:** Como el archivo solo resuelve ese caso de uso, nunca se convierte en un archivo gigante.
* **Cero conflictos de Git:** Si el agente A trabaja en `features/auth/login` y el agente B en `features/billing/checkout`, **nunca tocan los mismos archivos**.

---

## 6. Harness² de Google Research (`google-research/harness2`)

### 6.1 Realidad del Paper y por qué NO correr su código en vivo
El paper (*Harness²: Recursive Agent Harnessing for an Open World*, Octubre 2026) demuestra que **mejorar el arnés que envuelve a la IA es más efectivo que reentrenar el modelo**. Sin embargo, su código en Python es un evaluador de benchmarks sintéticos que prueba múltiples permutaciones en paralelo; ejecutarlo en vivo en tu desarrollo local multiplicaría tu consumo de tokens por 8x o 10x.

### 6.2 El Descubrimiento: Tu Repositorio YA ES un Arnés Harness²
Harness² formaliza un arnés mediante 8 componentes editables. Tu entorno en Antigravity CLI tiene una equivalencia exacta 1:1:

| Componente Harness² (Google) | Equivalente en tu Arquitectura V7/V8 |
| :--- | :--- |
| **1. System Prompts** | `AGENTS.md` y `Master Prompt.md` |
| **2. Guardrails (Límites duros)** | Límites `<300 LoC`, `<800 nodos DOM`, `audit_report.md` |
| **3. Memory** | Bus de Artefactos (`artifacts/`) y logs de sesión |
| **4. Tool Guidance** | Instrucciones de `context7`, Playwright y Obsidian |
| **5. Subagents** | Configuración de delegación en `.agents/models.yaml` |
| **6. Skills** | Catálogo modular en `.gemini/config/skills/` y `.agents/skills/` |
| **7. Scripts** | Scripts en PowerShell, comandos de Bun y Composer |
| **8. Plugins / Middleware** | Servidores MCP (Context7, Playwright, Obsidian) |

### 6.3 Cómo Integrar Harness² en la V8: El Bucle de Auto-Mejora en Git
En lugar de un evaluador automático costoso, adoptamos la metodología de **Evolución del Arnés impulsada por Git**:

1. Si un subagente genera código deficiente (ej. viola el presupuesto de nodos DOM o introduce una consulta N+1), el Quality Gate de `audit_report.md` emite `FAIL`.
2. El agente auditor determina si la causa fue una **falla en el arnés** (el prompt fue ambiguo, faltó una regla en la skill o un linter no estaba configurado).
3. Se actualiza el archivo del arnés correspondiente y se commitea con un tipo de commit dedicado:
   ```bash
   git commit -m "chore(harness): refine frontend-ui skill to enforce DOM budget <800 nodes"
   ```
4. **Resultado:** Tu entorno evoluciona y se vuelve más inteligente y estricto con cada versión que construyes, documentado de forma nativa en tu historial de Git.

---

## 📌 Conclusión y Hoja de Ruta de Implementación para V8

1. **Rechazar:** Dagger (usar scripts nativos de Bun) y LayerFS (usar `git worktree` + `mklink /J`).
2. **Rechazar el paquete `e2e` pero adoptar su Pirámide de 3 Niveles:** Tests unitarios rápidos por Vertical Slice -> Smoke tests headless -> Auditoría Playwright en PRs.
3. **Mantener `design-taste-frontend`:** Exclusivamente para landings y páginas públicas con protocolo de dials en el prompt.
4. **Adoptar Vertical Slice Architecture (VSA):** Como arquitectura de código estándar en los nuevos proyectos para garantizar archivos modulares y prevenir conflictos de Git.
5. **Formalizar el Arnés Harness²:** Tratar a `.agents/`, playbooks y skills como el arnés de desarrollo y evolucionarlo mediante commits `chore(harness): ...` tras cada Quality Gate.
