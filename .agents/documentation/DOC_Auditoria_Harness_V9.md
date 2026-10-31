---
tipo: documentacion
titulo: "Auditoría del Bucle de Auto-Mejora Harness³ V9"
descripcion: "Puntos de falla encontrados, contrato real de agy observado y correcciones aplicadas"
fecha: 2026-10-30
estado: activo
tags:
  - harness3
  - auditoria
  - automejora-recursiva
---

# Auditoría del Bucle de Auto-Mejora Harness³ V9

## 1. Conclusión

El bucle de auto-mejora no se cerraba en producción, aunque todos los tests pasaban. Los tests llamaban a las funciones directamente, con `cwd` en la raíz del repositorio y payloads inventados. `agy` real se comporta de otra forma.

Tras esta auditoría el bucle se cierra con `agy` 1.3.1: un fallo real se detecta, genera una regla en el workspace correcto, y el agente la recibe en el turno siguiente.

## 2. Método

1. Lectura del plugin, el breaker, el bucle y la documentación.
2. Extracción de la documentación de hooks incrustada en el binario de `agy`.
3. Sondas reales: un plugin de prueba en un workspace temporal registró los payloads de cada evento, con ejecuciones de `agy` de bajo riesgo y sin autoaprobación.
4. Análisis de esquema de 11 sesiones reales del usuario, solo de claves y marcadores de error.
5. Corrección con tests, incluido un E2E que ejecuta los hooks como procesos reales.
6. Verificación final con el plugin corriendo dentro de `agy`.

## 3. Contrato Real de `agy` 1.3.1

Conviene revalidar esta tabla con cada actualización de `agy`.

| Aspecto | Documentación oficial | Comportamiento observado |
| :--- | :--- | :--- |
| `cwd` del hook | Carpeta de `hooks.json` | Confirmado: es la carpeta del plugin, no el workspace |
| `SessionStart` | No figura | Se dispara |
| `PostToolUse` | Solo `stepIdx` y `error` | También trae `toolCall` |
| `terminationReason` | `model_stop` | `NO_TOOL_CALL` |
| `transcriptPath` | `transcript.jsonl` | `transcript_full.jsonl` |
| Comando con exit != 0 | Sugiere `error: "exit status 1"` | `error: ""` y sin salida; `status=DONE` en 37 de 37 casos reales |
| Momento del resultado | No figura | Se escribe en el transcript después de `PostToolUse` y antes de `PostInvocation` |
| Comando largo | No figura | Pasa a segundo plano: paso `RUNNING` sin exit code, salida en un log aparte |
| Tras un `deny` | No figura | No se dispara `PostToolUse` |
| Hook con exit != 0 | No figura | La herramienta falla, incluidas las de la lista blanca |
| `PLUGIN_DATA` / `PLUGIN_ROOT` | No figura | No llegaron al entorno del hook |
| `invocationNum` | No figura | Cuenta desde 0 en cada ejecución; `PreInvocation` corre antes de cada llamada al modelo |

## 4. Hallazgos Corregidos

### Críticos: el bucle no funcionaba

| # | Falla | Efecto | Corrección |
| :--- | :--- | :--- | :--- |
| C1 | Estado y heurísticas se resolvían contra `process.cwd()`, que es la carpeta del plugin | Las reglas se escribían en una ruta que `PreInvocation` no lee, y `Stop` no veía el contador | `resolveWorkspaceRoot()` a partir de `workspacePaths` |
| C2 | Un `run_command` fallido llega con `error: ""` | Los fallos de comandos contaban como éxito: anti-loop, auto-heal y telemetría no los veían | Reconciliación en `PostInvocation` leyendo el transcript |
| C3 | Un hook que crashea bloquea toda herramienta | Un error de sintaxis en el arnés dejaba al agente sin herramientas para repararlo, justo el escenario de auto-corrección | `hook_entry.ts` sin imports estáticos, modo seguro y aviso `[HARNESS DEGRADED]` |
| C4 | Sin `PostToolUse` tras un `deny`, y el estado persistía entre sesiones | Un bloqueo podía ser permanente, incluso en sesiones nuevas | Half-open, estado por conversación y desbloqueo en turno humano |
| C5 | `recordHeuristicUsage` y `evaluateAndPromote` nunca se llamaban fuera de los tests | La Dimensión 3 estaba muerta: no se medía si una regla servía ni se promovía nada | Medición en `PostToolUse` y `Stop`, y promoción al final de cada turno |
| C6 | La notificación `[HARNESS AUTO-HEAL]` se descartaba | `PostToolUse` no puede devolver contenido, así que el agente nunca la recibía | Cola de avisos que entrega `PreInvocation` |

### Altos: el aprendizaje era de mala calidad

| # | Falla | Corrección |
| :--- | :--- | :--- |
| A1 | Dos fallos seguidos eran siempre Harness Defect, aunque fueran un bug de código | La evidencia de código prevalece sobre la repetición |
| A2 | Regla genérica por defecto, que expulsaba reglas reales del FIFO | Sin patrón accionable no se inyecta nada; nuevas reglas concretas para comando inexistente, ruta errónea y bloqueos de archivo |
| A3 | Un test en rojo reiniciaba todo: el bucle de pruebas fallidas no se detectaba nunca | Contador propio, aviso y bloqueo de reejecución sin cambios |
| A4 | Stop Guardian no sabía si los tests pasaban y frenaba también al responder preguntas | Exige suite verde solo si se editó código y registra cuándo se salta el gate |
| A5 | Tope de 8 reglas en orden alfabético: las reglas nuevas nunca llegaban al agente | Las más recientes primero, alternando entre skills |
| A6 | Ids `H-NN` repetidos: colisionaban entre skills y tras desalojar | Id secuencial sin colisiones y clave por contenido para telemetría |
| A7 | Promoción "cross-workspace" con un solo workspace, sin degradación | Exige 2 workspaces; degrada reglas que dejan de cumplir y respeta `revoked` |
| A8 | Se escribía en disco antes de validar | Validación previa y escritura atómica con lock |
| A9 | El TDD Enforcer bloqueaba sesiones de solo lectura y al Planner, que además perdía `invoke_subagent` | Solo aplica con código editado; orquestación en lista blanca |
| A10 | Tres fallos de cualquier comando bloqueaban todo `run_command` | Contador por programa y subcomando |
| A11 | Los tests contaminaban las heurísticas reales del proyecto | Tests herméticos, verificados comparando contra una copia previa |

### Medios: robustez y datos

| # | Falla | Corrección |
| :--- | :--- | :--- |
| M1 | El destilador no veía los bloqueos reales ni el campo `error` | Adaptado al formato real del transcript |
| M2 | Prosa del usuario o del modelo contaba como resultado de herramienta | Filtrado por tipo de paso |
| M3 | Sin coincidencia de workspace, auditaba la sesión de otro proyecto | Devuelve `null` y falla con un error claro |
| M4 | El sanitizer reescribía parámetros MCP como `profile` o `pathname`, además de URLs, rutas UNC y `~` | Coincidencia exacta de claves y casos específicos |
| M5 | `echo bun test` reseteaba el TDD y `bun run test:harness` no contaba | Detección en posición de comando y más runners |
| M6 | Escritura no atómica, pese a que la doc decía lo contrario | Escritura atómica real |
| M7 | Stdin truncado acababa como nombre de herramienta, y sin herramienta se bloqueaba todo | Parseo defensivo y respuesta `allow` |
| M8 | Secretos y rutas en telemetría global, sin retención | Redacción, truncado y poda a 90 días |
| M9 | `busy_timeout` después de cambiar a WAL | Orden corregido y timeout corto |
| M10 | Fallo de SQLite perdía el contador y el auto-heal | Breaker y auto-heal van antes que la telemetría |

## 5. Puntos Abiertos

1. **El plugin no es portable.** Importa código fuera de su carpeta (`.agents/scripts/`, `scripts/`). Funciona como plugin de workspace, pero una copia en `~/.gemini/config/plugins/` no cargaría el arnés: operaría en modo seguro, sin protección. Resolverlo exige mover ese código dentro del plugin.
2. **La auto-corrección todavía es solo de texto.** El arnés aprende reglas para el agente, pero no modifica sus herramientas. Las reglas son consejos: nada obliga a seguirlas. El siguiente paso natural es que un patrón repetido genere una corrección determinista, por ejemplo una entrada en el sanitizer, pasando por tests antes de activarse.
3. **Modo seguro significa sin protección.** Es una decisión deliberada para no bloquear al agente: si el arnés se rompe, el breaker deja de actuar hasta que se repare. El aviso `[HARNESS DEGRADED]` lo hace visible.
4. **El agente puede tocar su propio arnés.** Puede editar `circuit_breaker.ts`, ejecutar `--reset` o borrar su estado. Ninguna de estas acciones pasa por un gate.
5. **Rutas relativas en MCP.** `Arguments.path` se sigue convirtiendo a absoluta porque un test lo fija para el MCP de sistema de archivos. Puede afectar a MCP remotos, como uno de GitHub.
6. **Comandos en segundo plano.** Sin exit code solo se detectan fallos con evidencia textual. Un comando que falla en silencio queda sin registrar.
7. **Patrones en español e inglés.** La clasificación depende del idioma de los mensajes de error.
8. **Hooks `.cmd` heredados.** Devuelven `decision: "block"`, que no está en el contrato de `agy`. Si se conectan junto al plugin, cada llamada contaría doble.
9. **`agy-safe.ps1` comparte estado.** Define `TOOL_COUNTER_FILE`, que desactiva el aislamiento por conversación.
10. **`verify_recursive_loop.ts` sigue siendo una simulación.** Su éxito solo comprueba que el texto de la regla existe. La evidencia real es `tests/e2e_loop.test.ts`.

## 6. Verificación

- `bun run test`: 197 pasan, 1 omitido y 0 fallan en una copia con `git init`. Sin repositorio git hay 1 fallo esperado, `worktree list`.
- `bun run validate`: 9 artefactos, 6 heurísticas y contratos SDD en verde.
- `agy plugin validate --strict --json`: sin hallazgos.
- Ejecución real en `agy` 1.3.1: un comando inexistente lanzado dos veces en segundo plano generó la regla en el workspace y sin archivos extraños en la carpeta del plugin.
- Latencia medida por hook: 130 a 180 ms, no los "<15 ms" citados en otros documentos.
