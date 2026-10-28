---
tipo: documentacion
titulo: "Automejora Continua y Control de Ejecuciones Largas en Antigravity CLI"
descripcion: "Diseño conceptual de circuit breakers semánticos, mitigación de attention decay y destilación de sesiones para planes largos"
fecha: 2026-10-26
estado: congelado
version: V8.0-historico
tags:
  - antigravity-cli
  - harness2
  - self-improving-agents
  - circuit-breaker
  - token-optimization
  - anti-loop
  - legacy
---

> **⚠️ NOTA HISTÓRICA & DISCLAIMER ARQUITECTÓNICO:**  
> Este documento expone el diseño conceptual precursor del semantic circuit breaker y el bucle de automejora.  
> En la arquitectura vigente **V9 (Harness³)**, estos mecanismos están automatizados mediante el plugin nativo `antigravity-harness-core`, con hooks in-flight (`PreToolUse`, `PostToolUse`, `PreInvocation`, `Stop`), telemetría SQLite y defensas deterministas sin intervención manual.  
> Consulta la documentación normativa en [`AGENTS.md`](../../../AGENTS.md), [`DOC_Harness_Auto_Mejora_Recursiva.md`](../DOC_Harness_Auto_Mejora_Recursiva.md) y [`DOC_Arquitectura_Agentes.md`](../DOC_Arquitectura_Agentes.md).

# Guía Avanzada: Automejora Continua y "Circuit Breakers" para Planes Largos en Antigravity CLI

## 1. El Problema de las Tareas de 1 Hora: Por qué el Prompt no Basta

Cuando un agente ejecuta un plan durante 30 o 60 minutos, ocurren tres fenómenos inevitables:

1. **Ceguera de Conteo (Attention Decay):** Si escribes en `SKILL.md` *"No uses esta herramienta más de 10 veces"*, a los 25 minutos de trabajo el modelo ya no recuerda si la usó 6 o 18 veces porque esa regla quedó enterrada bajo 60,000 tokens de logs.
2. **Inercia de Bucle (Sinkhole Loop):** Si una herramienta funciona pero es lenta (ej. leer o editar elemento por elemento en lugar de por lotes), el modelo seguirá usándola 50 veces porque para un LLM es "más fácil" repetir el patrón inmediato que detenerse a pensar uno nuevo.
3. **Imposibilidad de Auditoría Humana:** Nadie puede leer una traza de 1,500 turnos al final de una hora para descubrir en qué minuto el agente desperdició 40,000 tokens.

Para que el agente **se automodifique en caliente** y **aprenda al finalizar sin intervención humana**, necesitamos combinar **Restricciones Deterministas (Castigos por Hook)** con **Destilación de Trazas**.

---

## 2. Solución 1: El "Castigo" Determinista (Semantic Circuit Breaker)

En lugar de pedirle por favor al modelo que cuente sus llamadas, usamos un **Hook `PreToolUse`** nativo de Antigravity CLI. Este micro-script lleva la cuenta exacta en un archivo temporal. Si el agente supera el límite (ej. 10 llamadas a la misma herramienta o 3 fallos seguidos), el Hook **bloquea la ejecución** y le inyecta un mensaje de alerta directo en el último turno del contexto.

### Prototipo Conceptual en Python (`.agents/scripts/circuit_breaker.py`)

```python
#!/usr/bin/env python3
import sys, json, os

# Archivo temporal donde llevamos la cuenta de la sesión actual
STATE_FILE = "_workspace/tool_counter.json"
MAX_CALLS_PER_TOOL = 10  # Umbral de "castigo"

def main():
    # Antigravity pasa los datos de la llamada por stdin en formato JSON
    payload = json.loads(sys.stdin.read())
    tool_name = payload.get("tool_name", "unknown")

    # Ignorar herramientas de creación de scripts o lectura de reglas (necesarias para recuperarse)
    if tool_name in ["write_file", "run_command"]:
        print(json.dumps({"decision": "allow"}))
        return

    os.makedirs("_workspace", exist_ok=True)
    counts = {}
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            counts = json.load(f)

    counts[tool_name] = counts.get(tool_name, 0) + 1

    with open(STATE_FILE, "w") as f:
        json.dump(counts, f)

    # Si supera el límite, aplicamos el CASTIGO y reseteamos el contador para no bloquearlo eternamente
    if counts[tool_name] > MAX_CALLS_PER_TOOL:
        counts[tool_name] = 0
        with open(STATE_FILE, "w") as f:
            json.dump(counts, f)
            
        print(json.dumps({
            "decision": "deny",
            "reason": (
                f"🛑 CASTIGO DEL HARNESS (Circuit Breaker): Has ejecutado '{tool_name}' más de "
                f"{MAX_CALLS_PER_TOOL} veces en esta sesión. Estás operando de forma ineficiente. "
                "TIENES PROHIBIDO seguir llamando a esta herramienta individualmente. "
                "DETENTE AHORA MISMO y aplica el protocolo de Automejora: "
                "1) Crea un script por lotes (batch) en la carpeta scripts/ de tu skill, o "
                "2) Cambia a una herramienta masiva, y "
                "3) Documenta este cambio en tu SKILL.md antes de continuar."
            )
        }))
    else:
        print(json.dumps({"decision": "allow"}))

if __name__ == "__main__":
    main()
```

> [!TIP]
> **Ventaja clave:** Este script gasta 0 tokens mientras todo va bien, y solo inyecta instrucciones cuando el agente realmente cae en un patrón ineficiente, colocando la advertencia al final del contexto donde la atención del LLM es del 100%.

---

## 3. Solución 2: Protocolo "Tool Forging" (Automodificación en Caliente)

El castigo por sí solo detiene la hemorragia de tokens, pero el agente necesita saber cómo evolucionar cuando recibe ese bloqueo. En `AGENTS.md` o en los `SKILL.md`, se formaliza la siguiente cláusula de automodificación:

```markdown
## Protocolo de Automodificación en Caliente (Tool Forging)
Si recibes un bloqueo `CASTIGO DEL HARNESS` o notas que una tarea te va a tomar más de 10 llamadas repetitivas:
1. **Pausa el plan principal.** No intentes rodear el bloqueo llamando a la misma herramienta con otro nombre.
2. **Forja una herramienta local:** Escribe un script reutilizable en Python, Bash o TypeScript dentro de `.agents/plugins/<dominio>/skills/<tu-skill>/scripts/` que resuelva el lote completo de una sola vez.
3. **Actualiza tu propio ADN:** Abre tu archivo `SKILL.md` y añade en la sección `## Herramientas Forjadas` el comando exacto para usar ese nuevo script.
4. **Retoma el plan** ejecutando tu nuevo script en 1 solo turno.
```

Con esto logras que una tarea que requería 80 llamadas pase a tomar 10 llamadas + 1 creación de script + 1 ejecución final.

---

## 4. Solución 3: El "Destilador de Trazas" (Auditar 1 hora gastando 300 tokens)

El mayor obstáculo para que el agente aprenda de una sesión extensa es que la transcripción completa (`transcript.jsonl`) pesa megabytes. Si le pides a un agente que lea ese log para automejorarse, quemarás 100,000 tokens solo leyendo el historial.

La solución basada en Harness² es usar un **Destilador de Fricción**: un pequeño script determinista que lee el archivo JSONL al terminar la tarea y extrae únicamente las estadísticas de dolor (herramientas más repetidas, errores devueltos y tiempos muertos).

### El Reporte de Fricción (`_workspace/friction_report.md`)

Estructura condensada de máximo 25 líneas:

```markdown
# Reporte de Fricción de la Sesión (Generado Automáticamente)
- Duración total: 54 min | Total de turnos: 68
- Top 3 Herramientas más llamadas:
  1. `mcp_notion__update_page` (24 veces) -> ⚠️ ALERTA DE BUCLE SECUENCIAL
  2. `read_file` (19 veces) -> ⚠️ ALERTA DE LECTURA EXCESIVA
  3. `run_command` (8 veces)
- Errores repetidos detectados:
  - `mcp_notion__update_page` falló 4 veces con error `"validation_error: property Status not found"`.
```

### El Subagente "Harness Editor" (Cierre Automático)

Al final de planes largos, el pipeline invoca a un subagente ligero que solo lee esas 25 líneas de `_workspace/friction_report.md` y el `SKILL.md` involucrado:

> "Lee únicamente `_workspace/friction_report.md` y el archivo `SKILL.md` que se usó hoy. Tienes prohibido leer la conversación completa. Por cada ⚠️ ALERTA o error repetido en el reporte, edita `rules/learned_heuristics.md` dentro de la skill para prevenir que vuelva a ocurrir en la próxima ejecución."

**Resultado:** Auditas una hora entera de trabajo complejo y actualizas tus skills gastando menos de 500 tokens.

---

## 5. Solución 4: Regla de "Presupuesto de Entropía" (Evitar que el Agente ensucie tus Skills)

Existe un peligro clásico cuando dejas que un agente modifique sus propios archivos `SKILL.md` después de cada sesión: en dos semanas, el archivo tendrá 800 líneas de notas desordenadas, reglas contradictorias y parches viejos, volviendo a disparar el gasto de tokens.

Para que la automejora sea limpia y sostenible a largo plazo, se aplica la **Regla de Compresión de Memoria de Harness²**:

### A. Separación de Capas
1. El agente **NUNCA** edita las instrucciones principales de `SKILL.md` sin supervisión.
2. El agente solo tiene permiso de escritura libre sobre un archivo anexo llamado `rules/learned_heuristics.md` y la carpeta `scripts/`.

### B. El Límite de las 30 Líneas (FIFO / Compresión)
En las instrucciones del agente auditor, se impone esta restricción estricta:

> "El archivo `rules/learned_heuristics.md` jamás puede superar las 30 líneas ni contener más de 10 reglas. Si ya está lleno y necesitas añadir un aprendizaje nuevo, debes fusionar dos reglas parecidas o eliminar la más obsoleta para mantener el archivo ultracompacto (política FIFO)."

Con este esquema tienes lo mejor de ambos mundos: un "policía" determinista en tiempo real que no gasta tokens ni pierde la cuenta, y un auditor post-mortem que comprime los logs antes de pasárselos al modelo para que actualice sus reglas.
