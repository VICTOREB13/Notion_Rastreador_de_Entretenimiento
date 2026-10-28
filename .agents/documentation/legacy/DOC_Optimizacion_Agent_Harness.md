---
tipo: documentacion
titulo: "Arquitectura y Optimización de Agent Harness en Antigravity CLI"
descripcion: "Guía conceptual sobre optimización de arneses de agentes, progressive disclosure, tool pruning y aislamiento de subagentes inspirada en Harness²"
fecha: 2026-10-26
estado: congelado
version: V8.0-historico
tags:
  - antigravity-cli
  - harness2
  - ai-agents
  - mcp
  - token-optimization
  - subagentes
  - legacy
---

> **⚠️ NOTA HISTÓRICA & DISCLAIMER ARQUITECTÓNICO:**  
> Este documento expone los fundamentos conceptuales de la metodología Harness² y la anatomía de los 8 componentes de optimización.  
> La especificación normativa y vigente para todo desarrollo en esta plantilla es **V9 SDLC Git-Native & Harness³ Plugin Ecosystem** (hooks nativos en `antigravity-harness-core`, contratos SDD/TDD/ODD, VSA y pirámide de testing escalonada).  
> Consulta la documentación normativa en [`AGENTS.md`](../../../AGENTS.md), [`DOC_Arquitectura_Agentes.md`](../DOC_Arquitectura_Agentes.md), [`DOC_Harness_Auto_Mejora_Recursiva.md`](../DOC_Harness_Auto_Mejora_Recursiva.md) y [`DOC_Guia_Inicio_Rapido_y_Portabilidad_V9.md`](../DOC_Guia_Inicio_Rapido_y_Portabilidad_V9.md).

# Guía Maestra: Cómo Potenciar tus Skills en Antigravity CLI usando la Metodología Harness²

## 1. Fundamentos: ¿Qué es realmente un "Agent Harness"?

Existe el mito de que construir un *Agent Harness* (arnés de agente) requiere programación avanzada en bajo nivel. En la práctica moderna de ingeniería de agentes —respaldada por la investigación de **Harness²** de Google Research—, un *harness* **no modifica los pesos del modelo** (cero *pre-training* o *fine-tuning*). 

Un **Harness es la infraestructura de archivos de texto (Markdown, JSON) y pequeños scripts locales** que rodean al modelo para gobernar:
1. Qué contexto lee y en qué momento (*Progressive Disclosure*).
2. Qué herramientas tiene permitidas en cada fase (*Tool Guidance & Pruning*).
3. Cómo delega subtareas para no contaminar su memoria principal (*Subagent Isolation*).
4. Cómo aprende de sus propios errores tras una ejecución (*Contrastive Reflection*).

---

## 2. Ecosistema de Repositorios de Referencia

Para construir un sistema profesional sin programar desde cero ni gastar millones de tokens en pruebas automatizadas, nos apoyamos en la combinación de **cuatro recursos clave**:

| Recurso / Repositorio | Propósito Principal | Qué tomamos de él | Qué descartamos (y por qué) |
| :--- | :--- | :--- | :--- |
| **[google-research/harness2](https://github.com/google-research/harness2)** | Framework de investigación para optimizar *harnesses* mediante el bucle *Propose–Probe–Compose*. | **Su arquitectura de 8 componentes** y sus principios de ahorro de contexto (pasar lógica a scripts, poda de herramientas y reflexión post-ejecución). | **Su motor de ejecución en paralelo.** Correr 3-4 candidatos por tarea multiplica por 5 el gasto de tokens. Aplicaremos su lógica de forma asistida ("Single-Shot Reflection"). |
| **[Kyeong1024/antigravity-cli-harness](https://github.com/Kyeong1024/antigravity-cli-harness)** | Meta-skill para `agy` que diseña y genera arquitecturas de subagentes y skills automáticamente. | **Su generador de estructuras (`.agents/plugins/`)**, su sistema de aislamiento por `_workspace/` y su fase de auditoría (`Evolution`). | Nada; es el motor base ideal para estructurar tus *skills* actuales sin escribir JSON complejos a mano. |
| **[harness/harness-antigravity](https://github.com/harness/harness-antigravity)** | Colección empresarial de 71 skills de CI/CD y servidor MCP oficial de la plataforma Harness. | **La anatomía de sus archivos `SKILL.md` y reglas de negocio.** Son un ejemplo perfecto de cómo redactar instrucciones modulares y concisas. | El servidor MCP de Harness.io (a menos que uses su plataforma comercial de CI/CD). |
| **[Google Antigravity SDK](https://antigravity.google/blog/introducing-google-antigravity-sdk/)** | Herramientas oficiales para interceptar llamadas (`PreToolUse` / `PostToolUse`) y controlar el runtime en Python. | **Los Hooks nativos de la CLI (`settings.json`)** para bloquear comandos peligrosos o truncar errores sin gastar tokens del modelo. | El SDK completo en Python (solo necesario si decides empaquetar tus agentes fuera de la terminal en una app web/backend). |

---

## 3. Los 8 Componentes de Harness² Mapeados a Antigravity CLI

El paper de **Harness²** demuestra que el rendimiento de un agente con pesos congelados depende de **8 superficies editables**. Así es como cada una se traduce directamente a tus carpetas dentro de `agy`:

1. **System Prompt (Identidad Global):**
   * *Dónde vive en `agy`:* Tu archivo raíz `AGENTS.md` o `.antigravity/rules.md`.
   * *Regla de optimización:* Manténlo por debajo de 100 líneas. Solo debe ser un **índice de enrutamiento** (quién es el orquestador y cuándo llamar a cada skill/subagente).
2. **Skills (Conocimiento Modular):**
   * *Dónde vive en `agy`:* Archivos `SKILL.md` dentro de `.agents/plugins/{dominio}/skills/{nombre-skill}/`.
   * *Regla de optimización:* Usa **Revelación Progresiva (Progressive Disclosure)**. El `SKILL.md` principal solo contiene el flujo paso a paso; los manuales largos o casos borde van en una subcarpeta `references/` o `rules/` que el agente solo lee si lo necesita.
3. **Subagents (Aislamiento de Contexto):**
   * *Dónde vive en `agy`:* Archivos `agent.json` en `.agents/plugins/{dominio}/`.
   * *Regla de optimización:* Cada subagente nace con el historial limpio, hace su trabajo específico y muere, dejando solo el resultado final en disco.
4. **Tool Guidance (Guía y Poda de Herramientas):**
   * *Dónde vive en `agy`:* Configuración de herramientas permitidas por subagente y descripciones en `SKILL.md`.
   * *Regla de optimización:* **Nunca le des todos tus MCPs a un solo agente.** Si un agente solo redacta o audita texto, quítale las herramientas de red o ejecución de consola.
5. **Scripts (Offloading Mecánico):**
   * *Dónde vive en `agy`:* Carpeta `scripts/` dentro de cada skill.
   * *Regla de optimización:* Todo lo que sea repetitivo, determinista o requiera filtrar datos masivos debe ser un script local (`.sh`, `.py`, `.ts`) invocado por el agente, jamás razonado token por token.
6. **Memory (Estado Persistente y Handoff):**
   * *Dónde vive en `agy`:* Carpeta temporal `_workspace/` para comunicación entre agentes y tu vault/documentación para memoria a largo plazo.
   * *Regla de optimización:* Los agentes no se pasan el historial de chat completo; el Agente A escribe `_workspace/01_extraccion.json` y el Agente B lee únicamente ese archivo limpio.
7. **Guardrails (Barreras de Seguridad):**
   * *Dónde vive en `agy`:* `hooks.json` / `settings.json` y scripts en `PreToolUse`.
   * *Regla de optimización:* Bloquea acciones destructivas o llamadas con parámetros mal formados **antes** de que se ejecuten.
8. **Plugins / Middleware (Intercepción de Ciclo de Vida):**
   * *Dónde vive en `agy`:* Hooks `PostToolUse` y lectura de trazas en `.antigravity/sessions/*.jsonl`.

---

## 4. Guía Paso a Paso: Cómo Migrar y Unir tus Skills Actuales

Si ya tienes *skills* creadas pero sientes que gastan muchos tokens o fallan en tareas largas, sigue este flujo para integrarlas bajo el estándar de **Kyeong1024 + Harness²**:

### Paso 1: Instalar el Meta-Generador (`antigravity-cli-harness`)
En la raíz de tu espacio de trabajo donde sueles abrir `agy`, clona el repositorio como un plugin nativo:

```bash
mkdir -p .agents/plugins
git clone https://github.com/Kyeong1024/antigravity-cli-harness .agents/plugins/harness-plugin
```

### Paso 2: Convertir tus Skills sueltas en una Arquitectura con Aislamiento
En lugar de diseñar el JSON o la arquitectura a mano, abre `agy` y pídele al meta-generador que envuelva tus skills actuales:

> "Usa la skill harness para auditar mis skills actuales en [ruta de tus skills]. Quiero que diseñes un harness modular que las integre bajo un patrón Pipeline o Fan-out/Fan-in, asegurando que cada subagente tenga solo las herramientas MCP estrictamente necesarias y se comuniquen vía `_workspace/`."

Esto generará automáticamente una estructura limpia similar a esta:

```text
tu-proyecto/
├── AGENTS.md                         # Orquestador ligero (bajo consumo de tokens)
├── _workspace/                       # Memoria intermedia limpia entre subagentes
└── .agents/
    └── plugins/
        └── mi-flujo-optimizado/
            ├── plugin.json           # Manifiesto del dominio
            ├── agente-extractor.json # Solo tiene permisos de lectura / MCP A
            ├── agente-ejecutor.json  # Solo tiene permisos de escritura / MCP B
            └── skills/
                └── tu-skill-actual/
                    ├── SKILL.md      # Instrucciones nucleares (< 150 líneas)
                    ├── rules/        # Reglas detalladas (leídas solo bajo demanda)
                    └── scripts/      # Scripts en bash/python para ahorrar tokens
```

---

## 5. Las 4 Técnicas de Harness² para Ahorro Extremo de Tokens

Una vez tengas tu estructura, aplica estas cuatro técnicas extraídas de Harness² sobre tus archivos actuales:

### Técnica A: "Scripts over Prompts" (Empujar lógica del LLM a Scripts)
* **El problema:** El modelo gasta miles de tokens leyendo archivos grandes, buscando errores de formato en YAML/JSON o haciendo llamadas secuenciales a un MCP.
* **La solución Harness²:** Cuando veas que una skill siempre hace 4 o 5 pasos mecánicos de lectura o validación, abre una sesión de `agy` y pídele que forje un script determinista que devuelva solo las líneas con error en formato compacto.

**Cómo conectarlo en tu `SKILL.md`:**

```markdown
## Paso 1: Pre-procesamiento (Obligatorio)
PROHIBIDO leer los archivos crudos directamente. Ejecuta primero:
`python3 .agents/plugins/mi-flujo/skills/mi-skill/scripts/pre_check.py <ruta>`
Analiza únicamente el resumen JSON que emita ese script.
```

### Técnica B: "Tool Pruning" y Guía Negativa de Herramientas
* **El problema:** Cada herramienta MCP activa inyecta su esquema JSON en todos los turnos de conversación. Además, si el modelo duda entre dos herramientas parecidas, prueba una, falla, lee el error y prueba la otra (doble gasto de tokens).
* **La solución Harness²:** En el `.json` de cada subagente, declara explícitamente la lista blanca de herramientas. En el `SKILL.md`, añade una sección de Tool Guidance (cuándo NO usar una herramienta):

```markdown
## Guía de Herramientas (Tool Guidance)
- Usa `mcp_server__batch_update` SIEMPRE que vayas a modificar más de 2 archivos.
- PROHIBIDO usar `mcp_server__single_read` dentro de un bucle.
- Si la herramienta devuelve `Error 422`, NO reintentes con los mismos parámetros; ejecuta el script de limpieza primero.
```

### Técnica C: Guardrails de Costo Cero con `PreToolUse`
* **El problema:** El agente ejecuta un comando mal formado o intenta leer una carpeta gigante (como `node_modules` o `.git`), llenando la ventana de contexto con 50,000 tokens de basura.
* **La solución:** Configura un Hook nativo en `settings.json` o `hooks.json` para bloquear errores clásicos antes de gastar tokens:

```json
{
  "permissions": {
    "deny": [
      "read_file(**/.git/**)",
      "read_file(**/node_modules/**)"
    ]
  }
}
```

### Técnica D: "Single-Shot Contrastive Reflection" (El bucle de Harness² sin gastar x5)
* **El problema:** En el repositorio original de `google-research/harness2`, el optimizador corre la tarea varias veces para comparar trazas exitosas contra fallidas y editar el harness. Eso multiplica el gasto de tokens para uso diario.
* **La solución adaptada:** Usa tu trabajo diario como la prueba ("Probe"). Cuando termines una tarea en `agy` donde notaste que el agente dio vueltas innecesarias, ejecuta este prompt antes de salir:

> "Actúa como el Harness Editor de Harness². Revisa nuestra sesión actual e identifica en qué turnos gastamos tokens innecesarios, qué llamadas a herramientas fallaron o dónde tuve que corregirte. Con base en eso, aplica la fase 'Evolution' del arnés: edita directamente el archivo `SKILL.md` o `rules/learned_heuristics.md` añadiendo una restricción concisa o un ejemplo concreto para que en la próxima sesión acertemos al primer intento."

---

## 6. Checklist Rápido para Auditar cualquier Skill en tu Sistema

Cada vez que crees o actualices una de tus skills actuales, verifica estos 5 puntos:

- [ ] **Longitud controlada:** ¿Mi `SKILL.md` principal mide menos de 150 líneas? (Si mide más, mueve plantillas a `references/`).
- [ ] **Offloading mecánico:** ¿Hay algún paso donde el agente filtre texto o valide formatos "a ojo"? (Reemplázalo por un script local en `scripts/`).
- [ ] **Guía negativa:** ¿Especifico explícitamente qué herramientas NO debe usar en esta skill?
- [ ] **Aislamiento:** ¿La tarea requiere más de 3 fases distintas? (Pártela en subagentes que se comuniquen vía `_workspace/`).
- [ ] **Aprendizaje capturado:** ¿Capturé el aprendizaje de la sesión? (Si corregiste al agente manualmente, consolida la heurística en `learned_heuristics.md` bajo presupuesto FIFO).
