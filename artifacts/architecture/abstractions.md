---
tipo: abstracciones
proyecto: Notion_Rastreador_de_Entretenimiento
estado: activo
tags: [proyecto, arquitectura, abstracciones, backend, living-doc]
---

# 🏛️ Abstracciones del Sistema y Arquitectura de Código

> **Artefacto Vivo (Perpetuo / Zero-Touch):** Este documento es el plano arquitectónico permanente del código fuente. No lleva versión ni fecha volátil en el frontmatter. Documenta las clases maestras, interfaces de dominio, servicios de negocio y fronteras lógicas. Solo se modifica cuando se introduce una nueva interfaz transversal o se altera un servicio nuclear del dominio.

---

## 🏛️ Filosofía de Diseño y Paradigmas de Código

- **Patrón Arquitectónico Actual:** Scripting modular orientado a tareas batch (Pipeline ETL: Extract, Transform, Load).
- **Meta Arquitectónica V8:** Migración hacia **Vertical Slice Architecture (VSA)** dividiendo el dominio en:
  - `features/games/` (Sincronización, normalización y deduplicación de juegos).
  - `features/movies/` (Búsqueda TMDB, fallback y enriquecimiento de películas).
  - `core/clients/` (Clientes HTTP desacoplados para Notion, Steam, TMDB, Wikipedia).
- **Principios Rectores:**
  - **Idempotencia:** Las ejecuciones sucesivas del pipeline no deben duplicar entradas en Notion ni corromper metadatos existentes.
  - **Zero-Overwrite (Protección de Candados):** Los campos rellenados manualmente o con estados terminales (`Jugado`) quedan sellados ante sobreescrituras automáticas.
  - **Fuzzy Deduplication:** Uso de distancias de similitud de cadenas (`SequenceMatcher`) para unificar discrepancias ortográficas, subtítulos y puntuaciones.

---

## 🧩 Módulos y Costuras Lógicas del Sistema

### 1. Módulo de Videojuegos (`games.py`)
Encargado de la ingesta de títulos desde la cuenta de Steam del usuario, la consulta de datos de juego y horas de duración, y la persistencia en Notion.

- **`obtener_todos_juegos_notion()`**:
  - Consulta paginada (`/v1/databases/{id}/query`) para volcar en memoria el índice actual de juegos registrados.
- **`crear_juego_notion(nombre, steam_appid, horas)`**:
  - Instancia una nueva página en Notion con valores por defecto (Plataforma PC, estado según horas jugadas).
- **`actualizar_juego_notion(page_id, horas, ...)`**:
  - Aplica parches incrementales (`PATCH /v1/pages/{id}`) únicamente en atributos modificados.
- **`obtener_hltb(nombre)`**:
  - Invoca `howlongtobeatpy` para extraer estimaciones de horas de campaña principal y 100% completista.
- **`buscar_steam_detalles(appid)`**:
  - Extrae portadas, capturas y lista de géneros desde la Store API de Steam.

### 2. Módulo de Películas (`movies.py`)
Encargado de inspeccionar entradas pendientes en la base de datos de películas de Notion y enriquecerlas con metadatos cinematográficos oficiales.

- **`buscar_clave_propiedad(props, opciones)`**:
  - Normalizador de esquemas Notion tolerante a variaciones tipográficas (`Título`, `Titulo`, `Name`, `Title`).
- **`obtener_titulo_pelicula(props)`**:
  - Extractor defensivo de texto enriquecido Notion que previene excepciones `KeyError` o `IndexError` en registros vacíos.
- **`buscar_tmdb(titulo_original)`**:
  - Algoritmo de resolución heurística en cascada:
    1. Título saneado + Año entre paréntesis en español.
    2. Título saneado sin año en español.
    3. Título saneado en inglés (`en-US`).
    4. Título original en español.
- **`buscar_wikipedia_pelicula(titulo)`**:
  - Consulta a la OpenSearch API de Wikipedia para vincular el artículo más relevante.
- **`actualizar_pelicula_notion(page_id, poster_url, sinopsis, generos, wiki_url, ...)`**:
  - Aplica la actualización en Notion protegiendo las propiedades preexistentes no vacías.

---

## 🛠️ Funciones Críticas y Lógica Pura

### `limpiar_nombre(n: str) -> str`
- **Ubicación:** `games.py` (Línea 32)
- **Entrada:** Cadena de texto arbitraria con título del juego.
- **Salida:** Cadena normalizada en minúsculas, sin símbolos de registro (`™`, `®`, `©`), caracteres de puntuación ni espacios redundantes.
- **Invariante:** `limpiar_nombre("DOOM®: Eternal (2020)") == "doom eternal 2020"`.

### `similar(a: str, b: str) -> float`
- **Ubicación:** `games.py` (Línea 41)
- **Entrada:** Dos cadenas de texto.
- **Salida:** Ratio flotante entre 0.0 y 1.0 computado vía `SequenceMatcher`.
- **Regla de Negocio:** Un ratio $\ge 0.85$ califica dos títulos como el mismo juego para evitar registros duplicados.

---

## 🌐 Variables de Estado, Constantes Globales y Configuración

### 1. Variables de Entorno Requeridas (`.env` / GitHub Secrets)
- `NOTION_TOKEN`: Token Bearer de la integración oficial de Notion. Obligatorio.
- `DB_ID_GAMES`: Identificador UUID de la base de datos de videojuegos en Notion. Obligatorio para `games.py`.
- `DB_ID_MOVIES`: Identificador UUID de la base de datos de películas en Notion. Obligatorio para `movies.py`.
- `STEAM_KEY`: Clave de acceso a la Steam Web API. Obligatorio para sincronización de Steam.
- `STEAM_USER_ID`: ID numérico de 64 bits del perfil de Steam. Obligatorio.
- `TMDB_KEY`: API Key v3 de The Movie Database. Obligatorio para `movies.py`.
- `RAWG_KEY`: API Key de RAWG. Opcional (fallback).

### 2. Constantes de Dominio
- `ESTADOS_FINALES = ["Jugado"]`: Conjunto inmutable de estados terminales que impiden la mutación de estado por tiempo de juego.
- `HEADERS_NOTION`: Cabeceras con versión fija `"Notion-Version": "2022-06-28"`.

---

## 🔄 Costuras de Flujo de Datos (Data Seams)

1. **Flujo de Videojuegos:**
   `GitHub Actions Cron` -> `games.py:obtener_juegos_steam` -> `games.py:obtener_todos_juegos_notion` -> `Fuzzy Matching` -> `crear_juego_notion` | `actualizar_juego_notion` -> `Notion API`.
2. **Flujo de Películas:**
   `GitHub Actions Cron` -> `movies.py:obtener_peliculas_notion` -> `movies.py:buscar_tmdb` -> `movies.py:buscar_wikipedia_pelicula` -> `actualizar_pelicula_notion` -> `Notion API`.
