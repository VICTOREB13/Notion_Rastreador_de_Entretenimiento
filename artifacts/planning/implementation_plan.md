---
tipo: implementation_plan
proyecto: Notion_Rastreador_de_Entretenimiento
iteracion: 3
fecha: 2026-10-31
estado: activo
tags: [plan, refactorizacion, brand-components, telemetry, dark-mode, light-mode, error-handling]
---

# Plan de Implementacion Integral: Resolucion de Errores en Produccion, Telemetria Soberana y Diseno Canónico

Objetivo: Resolver de raiz los 6 fallos criticos reportados en produccion (Dokploy / Docker):
1. Error 500 en Backend por colision de clave primaria en `prisma.aiSettings.create()`.
2. Error de streaming y conexion cerrada en Next.js App Router (`failed to pipe response` / `UND_ERR_SOCKET`).
3. Diseno roto y falta de consistencia en Modo Oscuro y Modo Claro (eliminando la mezcla de fondos blancos con tarjetas oscuras hardcodeadas y reparando el logotipo en Docker).
4. Eliminacion total de inputs de API Keys, selectores de modelos y sliders de temperatura en el modal web (la configuracion de IA es 100% soberana desde variables de entorno .env en el servidor).
5. Incorporacion del slider animado con fisicas de resorte (`SpringSegmentedControl`) en la grafica de series de tiempo (7D, 30D, 90D).
6. Sincronizacion inicial automatica (Bootstrap Sync) al levantar el contenedor para que el catalogo no empiece vacio en 0.

---

## Indice de Fases

1. Fase 1: Blindaje Atomico de Backend y Prevencion de Carrera en SQLite
2. Fase 2: Robustecimiento del Proxy en Runtime Next.js y Reparacion de Assets en Docker
3. Fase 3: Purificacion del Modal de Telemetria (Showcase Publico de Solo Lectura)
4. Fase 4: Reconstruccion del Sistema de Diseno Dual (Dark & Light Mode) y Slider Animado
5. Fase 5: Sincronizacion Bootstrap en el Daemon y Diagnostico Activo de Credenciales

---

## Fase 1: Blindaje Atomico de Backend y Prevencion de Carrera en SQLite

### Diagnostico Forense
Al consultar concurrentemente `/api/settings` y `/api/settings/ai` desde el cliente web en el primer arranque, dos hilos asincronos verificaron que no existia el registro con id "default". Ambos intentaron ejecutar `prisma.aiSettings.create()`, detonando `Unique constraint failed on the fields: (id)` y generando un error 500 no controlado. Ademas, el modelo se almacenaba estaticamente en SQLite, sobreescribiendo e ignorando el modelo configurado en el `.env` del servidor.

### Acciones Especificas:
1. **Atomicidad en Repositorio de Ajustes:**
   - En el repositorio de ajustes, sustituir la logica de busqueda y creacion condicional por `prisma.aiSettings.upsert`.
   - Garantizar que el modelo activo siempre refleje el valor de `process.env.GEMINI_MODEL` (o su valor predeterminado).
2. **Defensa contra Caidas en el Controlador:**
   - Envolver el controlador de settings en un bloque defensivo `try/catch` con fallback seguro a la configuracion en memoria, garantizando que el endpoint responda HTTP 200 en cualquier circunstancia.
3. **Prueba de Concurrencia Automatizada:**
   - Incorporar una prueba unitaria que ejecute peticiones concurrentes simultaneas sobre una base de datos vacia para verificar la ausencia total de errores 500.

---

## Fase 2: Robustecimiento del Proxy en Runtime Next.js y Reparacion de Assets en Docker

### Diagnostico Forense
1. En `route.ts` del proxy dinamico de Next.js, las respuestas HTTP regulares se reenviaban como streaming puro sin bufferizar. Si el backend cerraba el socket o abortaba la conexion, la canalizacion interna de Next.js detonaba `failed to pipe response` con `UND_ERR_SOCKET`.
2. En `apps/web/Dockerfile`, el contenedor de produccion creaba el directorio `public` pero nunca copiaba los archivos desde la etapa de compilacion, provocando un error 404 al solicitar los logotipos vectoriales oficiales.

### Acciones Especificas:
1. **Bufferizacion de Respuestas en el Proxy:**
   - Modificar el handler catch-all de la API web para leer el cuerpo de la respuesta con `arrayBuffer()` en peticiones no-SSE, devolviendo una respuesta limpia que no dependa de streams abiertos.
   - En conexiones SSE, asociar un manejador de aborto al socket para cerrar limpiamente el flujo cuando el cliente se desconecte.
2. **Copia de Assets Estaticos en Docker:**
   - Actualizar el Dockerfile de la web para copiar la carpeta `public` hacia la imagen final de produccion tanto en `apps/web/public` como en `./public`.

---

## Fase 3: Purificacion del Modal de Telemetria (Showcase Publico de Solo Lectura)

### Diagnostico Forense
El modal de telemetria incluyo formularios de entrada para API Keys, selectores de modelos y sliders de temperatura. En un Showcase publico donde terceros pueden visualizar el sistema, estos controles representan un riesgo de seguridad y violan la directiva de configuracion soberana desde el entorno.

### Acciones Especificas:
1. **Eliminacion de Formularios Sensibles:**
   - Eliminar los campos de texto de clave de API Gemini, el selector de modelos y el slider de temperatura.
2. **Transformacion a Panel de Telemetria Pura:**
   - Redisenar la seccion de Inteligencia Artificial para mostrar exclusivamente informacion de estado del servidor: Modelo Activo configurado en .env, Proveedor oficial y Temperatura asignada.
   - Mantener el boton de accion "Sincronizar Steam hacia Notion" con microinteraccion cinetica.
   - Mantener el selector tripartito de tema (Oscuro / Claro / Sistema).
   - Reemplazar los botones de guardar cambios por un boton limpio de cierre.

---

## Fase 4: Reconstruccion del Sistema de Diseno Dual (Dark & Light Mode) y Slider Animado

### Diagnostico Forense
1. Tailwind CSS v4 requeria la directiva `@custom-variant dark (&:where(.dark, .dark *));`. Sin ella, los estilos oscuros solo se activaban si el sistema operativo estaba en modo oscuro, ignorando la clase `.dark` manual.
2. Multiples componentes tenian clases oscuras fijas (`bg-[#111113]`) sobre un fondo general blanco, generando una mezcla incoherente y antiestetica.
3. La grafica de series de tiempo utilizaba botones HTML rigidos sin transiciones de resorte.

### Acciones Especificas:
1. **Habilitacion de Variante Oscura en CSS:**
   - Incorporar la directiva de variante oscura en los estilos globales de la aplicacion web.
2. **Tokens Adaptativos en Componentes de Marca:**
   - Adaptar las tarjetas del dashboard, la barra metrica, el dock flotante y el estado vacio del catalogo para responder dinamicamente a `dark:` y `light:` utilizando la paleta Obsidian Zinc & Crimson Crisp.
3. **Slider Animado en Grafica de Series de Tiempo:**
   - Integrar el componente `SpringSegmentedControl` en la tarjeta de series de tiempo para alternar entre 7D, 30D y 90D con animacion elastica y fisica de resortes.

---

## Fase 5: Sincronizacion Bootstrap en el Daemon y Diagnostico Activo de Credenciales

### Diagnostico Forense
Al iniciar el contenedor, el demonio esperaba 120 segundos para su primer ciclo de sincronizacion con Notion, mostrando inicialmente un catalogo vacio con 0 titulos. Ademas, el estado de los servicios se evaluaba de forma pasiva segun la presencia de cadenas de texto.

### Acciones Especificas:
1. **Sincronizacion Inicial al Arrancar (Bootstrap Sync):**
   - Incorporar una tarea de arranque diferida (a los 3 segundos de iniciado el servidor) para consultar inmediatamente Notion e hidratar la base de datos local SQLite.
2. **Verificacion Activa de Salud:**
   - Proporcionar retroalimentacion visual clara en la telemetria si las credenciales de Notion o Steam faltan en el entorno del servidor o si la conexion fue exitosa.

---

## Matriz de Validacion y Quality Gate

| Fase | Verificacion Determinista | Herramienta | Resultado Requerido |
| :--- | :--- | :--- | :--- |
| Fase 1 | Prueba de concurrencia en endpoint de settings | `bun test` | 0 errores 500 en llamadas simultaneas |
| Fase 2 | Compilacion de Dockerfile y bufferizacion proxy | `bun run web:build` | Build exitoso con assets publicos incluidos |
| Fase 3 | Inspeccion visual de telemetria | Revision de UI | Cero inputs de credenciales o sliders |
| Fase 4 | Auditoria de contraste Dark/Light y slider | Revision de DOM | Transicion fluida y estilos consistentes |
| Fase 5 | Hidratacion de base de datos en arranque | Logs de Daemon | Sincronizacion inicial ejecutada en bootstrap |

---

## Referencias de Artefactos Vivos
- [[PRJ_Notion_Rastreador_de_Entretenimiento_architecture|Arquitectura del Sistema]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Contratos]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_api_spec|Especificacion de API]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_design_system|Sistema de Diseno]]
- [[PRJ_Notion_Rastreador_de_Entretenimiento_task|Lista de Tareas]]
