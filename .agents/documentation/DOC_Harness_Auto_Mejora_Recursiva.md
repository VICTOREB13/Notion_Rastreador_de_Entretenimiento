---
tipo: playbook
estado: activo
version: V9 SDLC Git-Native & Harness³ Plugin Ecosystem
tags:
  - arnes
  - harness2
  - harness3
  - automejora-recursiva
  - circuit-breaker
  - orca-hooks
  - destilacion-trazas
  - odd
  - offloading-mecanico
  - presupuesto-entropia
---

# Arquitectura de Arnés Determinista y Bucle de Auto-Mejora Tridimensional (Harness³ V9)

El ecosistema de agentes opera bajo la **Arquitectura V9**, incorporando formalmente el **Arnés de Auto-Mejora Tridimensional (Harness³)**. Esta infraestructura complementa la orquestación multiagente con un conjunto de mecanismos de software deterministas, ejecutados fuera del contexto del Modelo de Lenguaje (LLM) a través de Bun, hooks nativos del IDE y scripts de observabilidad en tiempo de ejecución.

> 📊 **Diagrama de Arquitectura Interactivo:**  
> La topología visual completa de este arnés se encuentra compilada y disponible como artefacto interactivo standalone en:  
> - `[[DOC_DIAG_Harness_Auto_Mejora.html|.agents/documentation/DOC_DIAG_Harness_Auto_Mejora.html]]`

---

## 🎯 1. Filosofía Central: "Scripts over Prompts" y el Problema de la Entropía

### El Límite de los Prompts Puros
En arquitecturas agénticas tradicionales, se intenta resolver cada problema inyectando más texto e instrucciones en el System Prompt. Este enfoque conduce a tres fallas críticas conocidas como la **Trampa de Entropía Agéntica**:
1. **Prompt Drift & Context Saturation:** A mayor volumen de reglas en el prompt, menor es la fidelidad del modelo hacia las instrucciones sutiles.
2. **Lecturas Secuenciales Ciegas (Blind Sequential Reads):** Los agentes tienden a leer archivo tras archivo con `read_file` buscando pistas, consumiendo miles de tokens sin transformar datos.
3. **Alucinaciones en Bucle (Deadlock Loops):** Ante un error de compilación o test fallido, el modelo aplica "parches a ciegas" repetitivos hasta agotar el límite de turnos.

### El Paradigma Harness² (Scripts over Prompts)
La solución no consiste en más prompts, sino en **armazones de código determinista (Harness)**. Todo aquello que una máquina pueda validar mediante regex, esquemas o algoritmos deterministas en milisegundos se delega a scripts fuera del LLM (**Offloading Mecánico**). El LLM únicamente interviene en la síntesis estratégica de alto nivel.

### 🛡️ Arquitectura Dual de Auto-Mejora Silenciosa (Defensa en Profundidad)
El bucle recursivo opera bajo una **estrategia de dos velocidades complementarias**:
1. **Opción A (Reflejo en Caliente - Hot Reflection en Hooks & Breaker):** Intercepción inmediata por turnos. Si una herramienta falla consecutivamente (≥ 2 fallos) o se bloquea el Circuit Breaker, el hook ejecuta silenciosamente `autoHealFromFailure()`, inyectando la regla preventiva en `learned_heuristics.md` (FIFO 10R/30L) y notificando `[HARNESS AUTO-HEAL]` en caliente para el Turno 2 sin requerir intervención humana.
2. **Opción B (Auditoría Forense en Frío - Cold Auditing en Quality Gate):** Al culminar la sesión, el `Systems-Auditor` ejecuta `distill_session.ts`, consolida la fricción en `friction_report.md` (<25 líneas) y certifica que todas las heurísticas cumplan formalmente con los presupuestos de entropía mediante `validate_artifact.ts --heuristics`.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│             ARQUITECTURA DE AUTO-MEJORA RECURSIVA DEL ARNÉS (HARNESS³ V9)                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   [Sesión Agéntica Turno N]                                                                      │
│         │                                                                                        │
│         ├──► [Orca Pre-Tool Hook] ──► [Circuit Breaker --auto-heal]                              │
│         │                                      │                                                 │
│         ▼                                      ▼ (≥2 fallos o CIRCUIT_BREAKER_BLOCKED)           │
│   [Ejecución Herramienta]               [autoHealFromFailure()]                                  │
│         │                                      │                                                 │
│         ▼                                      ▼ (Harness Defect)                                │
│   [Orca Post-Tool Hook] ───────────────► Inyección FIFO en learned_heuristics.md                 │
│   (--auto-heal + feedback)                     │ (≤10 Reglas / ≤30 Líneas)                       │
│         │                                      ▼                                                 │
│         │                               Notificación [HARNESS AUTO-HEAL] en Caliente             │
│         ▼                                      │                                                 │
│   [Turno N+1: Contexto Enriquecido] ◄──────────┘ (OPCIÓN A: REFLEJO EN CALIENTE <15ms)           │
│         │                                                                                        │
│         ▼                                                                                        │
│   [Cierre de Sesión / PR Gate]                                                                   │
│         │                                                                                        │
│         ▼                                                                                        │
│   [Transcript / SQLite DB] ──► [distill_session.ts] ──► [friction_report.md (<25L)]              │
│                                                               │                                  │
│                                                               ▼                                  │
│   [Systems-Auditor Quality Gate] ◄────────────────────────────┘ (OPCIÓN B: FORENSE EN FRÍO)      │
│         │                                                                                        │
│         ├───► Defecto de Código ──────► Corrección en Slice Feature                              │
│         │                                                                                        │
│         └───► Certificación Arnés ────► validate_artifact.ts --heuristics (PASS)                 │
│                                              │                                                   │
│                                              ▼                                                   │
│                                   chore(harness): ... (Sello Git-Native para Futuras Sesiones)   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. Capa 1: Progressive Disclosure y Esquemas Lazy (`references/schemas/`)

Para evitar que el agente cargue definiciones completas de artefactos en su ventana de contexto inicial, se implementa el patrón **Progressive Disclosure**:
- **Ubicación:** `.agents/skills/artifact-standards/references/schemas/`
- **Catálogo de 11 Esquemas Atómicos:**
  1. `overview.md`: Resumen y visión general del proyecto.
  2. `architecture.md`: Arquitectura técnica y stack.
  3. `abstractions.md`: Contratos de interfaces y tipos canónicos.
  4. `api_spec.md`: Especificación formal de endpoints.
  5. `design_system.md`: Tokens visuales y componentes.
  6. `implementation_plan.md`: Plan atómico del ciclo.
  7. `task.md`: Tareas y asignación de subagentes.
  8. `changelog.md`: Historial versionado de releases.
  9. `audit_report.md`: Reporte de Quality Gate y ODD.
  10. `playbook.md`: Definición operativa de agentes.
  11. `learned_heuristics.md`: Heurísticas aprendidas por skill.

**Beneficio:** Los subagentes consultan quirúrgicamente el esquema del archivo que van a modificar únicamente cuando lo necesitan, reduciendo la carga de contexto inicial en más de un 70%.

---

## ⚙️ 3. Capa 2: Offloading Mecánico y Validador Determinista (`validate_artifact.ts`)

Conforme a la **Regla 9 de AGENTS.md**, cualquier tarea que demande más de 6 operaciones mecánicas idénticas debe ser transferida a un script determinista.

- **Herramienta:** `.agents/skills/artifact-standards/scripts/validate_artifact.ts`
- **Motor:** Bun Runtime (tiempo de ejecución: **< 15 ms** dentro del proceso; cada hook completo tarda 130-180 ms)
- **Validaciones Deterministas:**
  1. **Inicio de Frontmatter:** Debe comenzar estrictamente en la Línea 1 con `---`.
  2. **Delimitador de Cierre:** Cierre estricto con `---`.
  3. **Casing en Frontmatter:** Prohibición absoluta de claves con mayúsculas (`tipo:`, no `Tipo:`).
  4. **Estructura Plana (Obsidian Properties):** Prohíbe objetos YAML anidados. Solo acepta escalares y arreglos planos.
  5. **Baneo de Mermaid:** Detecta y bloquea diagramas Mermaid para exigir diagramas interactivos Archify o ASCII art limpio.
  6. **Prohibición de URIs Locales:** Bloquea enlaces que contengan prefijos absolutos `file:///`.
  7. **Veredicto Estricto:** Valida que el veredicto sea exactamente `PASS` o `FAIL` en mayúsculas.
  8. **Presupuesto de Heurísticas (`--heuristics`):** Audita que `learned_heuristics.md` no sobrepase el límite de 30 líneas ni 10 reglas.

---

## 🛡️ 4. Capa 3: Semantic Circuit Breaker Determinista (`circuit_breaker.ts`)

El Circuit Breaker es el escudo activo que previene desbordamientos de tokens y bucles destructivos en caliente durante la ejecución de cualquier herramienta.

- **Ubicación:** `.agents/scripts/circuit_breaker.ts`
- **Persistencia de Estado:** `_workspace/tool_counters/<conversationId>.json` (escritura atómica, aislado por conversación). `TOOL_COUNTER_FILE` tiene prioridad.
- **Contrato Real de `agy`:** Observado en la versión 1.3.1 y documentado en [[DOC_Auditoria_Harness_V9|Auditoría del Arnés V9]]. Difiere de la documentación oficial en puntos que afectan a este arnés.

### 4.1 Garantía de Salida Inmutable (Zero-Lockout Guarantee)
Las herramientas de comunicación, persistencia y orquestación están en una lista blanca protegida incondicionalmente:
- Comunicación: `send_message`, `ask_question`, `ask_permission`.
- Escritura: `write_to_file`, `replace_file_content`, `write_file`, `edit_file`.
- Orquestación: `manage_task`, `schedule`, `manage_subagents`, `invoke_subagent`, `define_subagent`.
- **Comportamiento:** Estas herramientas **NUNCA** se bloquean. Esto asegura que el agente siempre conserve los canales de comunicación abiertos con el usuario y otros agentes, y mantenga su capacidad de guardar trabajo.
- **Bootstrap a Prueba de Fallos (`src/hook_entry.ts`):** En `agy`, un hook que termina con exit != 0 bloquea la herramienta, incluidas las de esta lista. Por eso los hooks entran por un bootstrap sin imports estáticos: si el arnés no carga, responde en modo seguro y avisa con `[HARNESS DEGRADED]`, de modo que el agente conserva las herramientas para repararlo.

### 4.2 Límite de Lecturas Secuenciales Ciegas (Blind Sequential Reads)
- **Umbral Duro:** Máximo **12 lecturas consecutivas** con la herramienta nativa `view_file` (o el alias `read_file`) sin alternar con herramientas de búsqueda estructurada (`grep_search`, `find_by_name`, `list_dir`) o escritura.
- **Acción al superar el límite:** A la 13ª invocación consecutiva, el proceso finaliza con **Exit Code 1** y devuelve el JSON:
  ```json
  {
    "allowed": false,
    "decision": "block",
    "reason": "CIRCUIT_BREAKER_BLOCKED: Se superó el límite de 12 lecturas secuenciales consecutivas..."
  }
  ```
- **Instrucción al Agente:** Se instruye al agente a abandonar la lectura ciega y ejecutar búsquedas específicas con `grep_search` o forjar un script de escaneo por lotes en `scripts/`.

### 4.3 Detección de Fallos Repetitivos en Herramientas (Anti-Loop Breaker)
- **Umbral Duro:** Máximo **3 fallos consecutivos** en cualquier herramienta o MCP. En `run_command` se cuenta por programa y subcomando (`run_command:git status`).
- **Acción:** Al tercer fallo consecutivo, esa clave queda bloqueada preventivamente, forzando la pausa obligatoria del Protocolo Anti-Loop para auditar el origen real del fallo.
- **Half-Open:** `agy` no dispara `PostToolUse` tras un `deny`, así que un circuito abierto no podría cerrarse solo. Tras 3 denegaciones se deja pasar un intento: si falla se reabre y si funciona se cierra. Un nuevo mensaje del usuario (`invocationNum` 0) también levanta los bloqueos.
- **Bucles de Pruebas:** Un test rojo no es un fallo de herramienta, pero `consecutive_test_failures` lo acumula. A los 3 fallos se notifica `[HARNESS ANTI-LOOP]` y se bloquea reejecutar la suite sin cambios de código.

### 4.4 Normalización y Reseteo
- El breaker normaliza prefijos y espacios de nombres (ej. `default_api:view_file` → `view_file`, `Server__Tool` → `tool`).
- Se resetea mediante invocación explícita con el argumento `--reset`. Cada conversación parte de un estado limpio.

### 4.4.1 Resultado Real de los Comandos
`PostToolUse` recibe `error: ""` y ninguna salida aunque un comando termine con exit != 0. El resultado se resuelve después:
1. `PostToolUse` deja el comando en `pending_outcomes`.
2. `PostInvocation` lee el exit code del transcript (`post_invocation.ts`).
3. Si el comando pasó a segundo plano, el paso queda en `RUNNING` sin exit code y se usa la evidencia de su log.
4. Sin evidencia clara no se afirma éxito ni fallo: tras 6 invocaciones el paso se descarta sin registrarlo.

### 4.5 Auto-Sanación Determinista en Caliente (`--auto-heal` & `autoHealFromFailure()`) [Opción A]
- **Mecanismo Silencioso:** Activado por los hooks del plugin: `PostToolUse` y `PostInvocation` ante fallos, `PreToolUse` ante bloqueos.
- **Condición de Disparo:** Se activa cuando:
  1. Una herramienta acumula **≥ 2 fallos consecutivos**.
  2. Ocurre un bloqueo directo por el Circuit Breaker (`CIRCUIT_BREAKER_BLOCKED`).
- **Flujo de Ejecución:**
  1. Invoca `autoHealFromFailure()` en `scripts/verify_recursive_loop.ts`.
  2. Clasifica determinísticamente la causa raíz mediante `classifyRootCause()`. La evidencia de código (`TypeError`, tests fallidos) prevalece sobre la repetición: un bug repetido sigue siendo un Code Defect y no genera regla.
  3. Si es un **Harness Defect** (ej. bloqueos de lecturas, enforcer TDD, `sqlite_busy`, contract drift, comando inexistente o ruta errónea), infiere la skill activa (`inferSkillFromContext`) y sintetiza una regla preventiva concisa (`synthesizeHeuristicRule`). Si no hay patrón accionable no se inyecta nada: una regla genérica expulsaría reglas reales del FIFO.
  4. Inyecta la regla usando `FIFOHeuristicsManager` en `<workspace>/.agents/skills/<skill>/rules/learned_heuristics.md`, validando antes de escribir y manteniendo el límite duro de **≤10 reglas** y **≤30 líneas**. Una regla que vuelve a dispararse pasa al final de la cola y no se desaloja antes de tiempo.
  5. Encola la notificación `[HARNESS AUTO-HEAL]`, que `PreInvocation` entrega al agente en el turno siguiente: `PostToolUse` no puede devolver contenido.

### 4.6 Medición de Efectividad y Promoción (Cierre del Bucle)
- **Medición:** Cada regla autogenerada queda vinculada a la herramienta que la originó. Si el fallo reaparece con la regla activa, cuenta como fallo de la regla. Si una conversación usa esa herramienta sin que reaparezca, cuenta como éxito.
- **Identidad:** La telemetría usa una clave derivada del contenido (`heuristicKey`), porque los ids `H-NN` se repiten entre skills y workspaces.
- **Promoción:** `Stop` evalúa la promoción al final de cada turno. Exige score ≥ 0.80, ≥ 3 éxitos y evidencia en ≥ 2 workspaces. Una regla promovida que deja de cumplirlo pasa a `demoted`, y una con `status = 'revoked'` no vuelve a promoverse.
- **Destilación Automática:** `Stop` genera `_workspace/friction_report.md` sin intervención del auditor.

---

## 🔌 5. Capa 4: Integración Dual: Hooks de Orca IDE y Wrapper PowerShell

La intercepción opera de forma transparente tanto dentro del entorno IDE como en consolas de terminal puras:

### 5.1 Integración con Orca IDE
- **Pre-Tool Hook:** `.agents/scripts/hooks/pre-tool-use.cmd`  
  Intercepta la intención de llamada a herramienta antes de que se ejecute con `bun run circuit_breaker.ts --auto-heal`. Si el breaker devuelve `{"decision":"block"}`, bloquea la ejecución, dispara auto-sanación si corresponde y devuelve la razón al agente inmediatamente.
- **Post-Tool Hook:** `.agents/scripts/hooks/post-tool-use.cmd`  
  Captura el código de salida y resultado con `bun run circuit_breaker.ts --post-tool --auto-heal`. Si la herramienta falla repetidamente (≥2 fallos), inyecta la heurística preventiva y notifica `[HARNESS AUTO-HEAL]`.
- **Enlace de Sistema:** Conectado mediante hook central en `~/.orca/agent-hooks/antigravity-hook.cmd`.

### 5.2 Wrapper de Consola CLI Pura (`scripts/agy-safe.ps1`)
Para sesiones que se ejecutan directamente en PowerShell (`agy`, `agy -c`), se dispone del wrapper seguro `agy-safe.ps1`:
```powershell
# Iniciar sesión agéntica reseteando contadores del breaker
.\scripts\agy-safe.ps1 -Reset

# Consultar el estado actual del breaker en tiempo real
.\scripts\agy-safe.ps1 -Status

# Solo resetear contadores sin lanzar la sesión
.\scripts\agy-safe.ps1 -ResetOnly
```

---

## 📊 6. Capa 5: Observabilidad Determinista y Destilador de Trazas (`distill_session.ts`)

La observabilidad es el insumo que permite cerrar el ciclo de retroalimentación agéntica sin desperdicio de tokens.

- **Ubicación:** `.agents/scripts/distill_session.ts`
- **Fuentes de Datos:**
  1. Archivo de trazas de sesión: `~/.gemini/antigravity-cli/brain/<UUID>/.system_generated/logs/transcript.jsonl`.
  2. Base de datos SQLite: `~/.gemini/antigravity-cli/conversation_summaries.db`.
- **Rendimiento:** Procesa transcripciones de miles de líneas y consulta SQLite nativo en Bun en **< 100 ms**.
- **Artefacto Generado:** `_workspace/friction_report.md` (límite estricto de **< 25 líneas**).

### Métricas Extraídas por el Destilador:
- Conteo total de turnos (Usuario vs. Modelo).
- Tabla de distribución de herramientas utilizadas.
- Conteo de fallos consecutivos y herramientas bloqueadas.
- Identificación de ráfagas de lecturas consecutivas.
- Detección de bucles repetitivos (≥ 3 llamadas idénticas consecutivas).
- Disparos de bloqueo del Circuit Breaker (`CIRCUIT_BREAKER_BLOCKED`).
- **Preclasificación ODD:** Identificación preliminar de Defecto de Código vs. Defecto de Arnés.

---

## 🔄 7. Capa 6: Diagnóstico de Causa Raíz y Presupuesto de Entropía (Harness² Loop)

En la **Fase 5 (Quality Gate)** y **Fase 6 (Harness² Loop)** del ciclo SDLC, el `Systems-Auditor` toma el control:

### 7.1 Diagnóstico Binario de Causa Raíz en `audit_report.md`
El auditor inspecciona `_workspace/friction_report.md` y clasifica taxativamente el origen de cualquier fricción:
- **Defecto de Código (Code Defect):** Fallo de lógica de negocio, sintaxis, error de base de datos o excepción no controlada en el Vertical Slice.  
  *Acción:* Se corrige directamente en el código de la feature.
- **Defecto de Arnés (Harness Defect):** Especificación ambigua o contradictoria en `api_spec.md`, regla faltante o desactualizada en `SKILL.md`, mock desfasado, linter mal calibrado o comportamiento ineficiente de herramientas.  
  *Acción:* Se activa el **Bucle Harness²**.

### 7.2 Presupuesto de Entropía: Regla FIFO (30 Líneas / 10 Reglas)
Para evitar que las reglas aprendidas se acumulen indefinidamente degradando el contexto (*prompt drift*), se aplica una política estricta de presupuesto de entropía:
- **Archivo de Destino:** `.agents/skills/<skill>/rules/learned_heuristics.md`
- **Límite Duro:** Máximo **30 líneas** y máximo **10 reglas**.
- **Política FIFO (First-In, First-Out):** Al ingresar la 11ª regla aprendida, la regla más antigua se purga automáticamente.
- **Verificación Determinista:**
  ```bash
  bun .agents/skills/artifact-standards/scripts/validate_artifact.ts .agents/skills/<skill>/rules/learned_heuristics.md --heuristics
  ```

### 7.3 Consolidación en Git: Commit Semántico de Arnés
Cualquier perfeccionamiento del arnés se sella formalmente en el repositorio:
```bash
git add .agents/
git commit -m "chore(harness): perfeccionar validacion de esquemas y regla anti-loop"
```
De este modo, el entorno evoluciona de manera recursiva: **cada fallo del sistema deja el arnés más robusto para todas las futuras iteraciones de cualquier agente.**

---

## 🚀 8. Arquitectura de Tercera Dimensión: Plugins Nativos y Harness³ V9

Harness³ expande la auto-mejora bidimensional (Hooks locales + Auditoría en frío) hacia una **topología tridimensional**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA TRIDIMENSIONAL DEL ARNÉS (HARNESS³ V9)                           │
├──────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┤
│ Dimensión 1: En Caliente     │ Dimensión 2: Cero Contaminación │ Dimensión 3: Cross-Workspace    │
│ (In-Flight Overwrite)        │ (Ephemeral PreInvocation)       │ (SQLite Telemetry & Promotion)  │
├──────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ • PreToolUse sanitiza rutas  │ • Inyección dinámica vía        │ • Telemetría persistente SQLite │
│   y comandos con overwrite.  │   ephemeralMessage en           │   en ${PLUGIN_DATA}/telemetry.db. │
│ • Circuit Breaker devuelve   │   PreInvocation.                │ • Promoción empírica de reglas  │
│   decision: "deny" estricto. │ • Cero prompt drift ni bloat    │   locales a catálogo global.    │
│ • PostToolUse auto-cura con  │   en transcript.jsonl.          │ • Stop Guardian Quality Gate    │
│   telemetría inmediata.      │ • Contexto siempre ligero.      │   con guardia anti-bucles.      │
└──────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

---

## 🔗 Referencias y Artefactos Relacionados
- [[DOC_Auditoria_Harness_V9|Auditoría del Bucle de Auto-Mejora Harness³ V9]]
- [[DOC_Arquitectura_Agentes|01. Arquitectura General de Agentes V9 (SDLC Git-Native & Harness³)]]
- [[DOC_Metodologia_Prototipado_Evolutivo|02. Metodología de Prototipado Evolutivo V9]]
- [[DOC_Guia_Inicio_Rapido_y_Portabilidad_V9|03. Guía de Inicio Rápido, Portabilidad e Instalación Multi-Entorno V9]]
- [[DOC_DIAG_Arquitectura_Agentes.html|Diagrama de Orquestación de Agentes (Teamwork)]]
- [[DOC_DIAG_Harness_Auto_Mejora.html|Diagrama Interactivo de Arquitectura Harness³]]
- [[.agents/skills/systems-auditor/SKILL.md|Playbook del Systems-Auditor (QA Gatekeeper)]]
- [[.agents/skills/project-planner/SKILL.md|Playbook del Project-Planner (Harness Director)]]
- [[.agents/models.yaml|SSoT de Tiers y Modelos de IA (.agents/models.yaml)]]
- [[.agents/skills/artifact-standards/SKILL.md|Guía Oficial de Estándares de Artefactos]]


---
