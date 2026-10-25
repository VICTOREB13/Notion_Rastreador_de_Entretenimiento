---
tipo: api_spec
proyecto: Notion_Rastreador_de_Entretenimiento
estado: activo
tags: [proyecto, api, backend, contratos, living-doc]
---

# 📡 Especificación de API y Modelos de Datos

> **Artefacto Vivo (Perpetuo / Zero-Touch):** Define el contrato vigente de datos y endpoints del sistema. No lleva versión volátil en el frontmatter. Únicamente se actualiza de forma incremental cuando se añade o modifica un endpoint o modelo de base de datos.
> **Sinergia con Vertical Slice (VSA):** Este archivo actúa como el índice maestro de contratos y esquemas de datos consumidos por los módulos de automatización.
> **Complemento Arquitectónico:** Consulta las funciones de mapeo y data seams en [[PRJ_Notion_Rastreador_de_Entretenimiento_abstractions|Abstracciones y Data Seams]].

---

## 🗄️ Modelos de Base de Datos (Esquema Notion)

### 1. Base de Datos: Videojuegos (`DB_ID_GAMES`)
Esquema de propiedades requerido en la base de datos de Notion para juegos:

| Propiedad Notion | Tipo Notion | Propósito / Formato |
| :--- | :--- | :--- |
| `Título` | `title` | Nombre principal del videojuego (Texto plano) |
| `Steam ID` | `number` | AppID numérico de Steam (ej: `1091500`) |
| `Horas Jugadas` | `number` | Horas totales registradas con 1 decimal (ej: `45.2`) |
| `HLTB Principal` | `number` | Horas estimadas para la historia principal (HowLongToBeat) |
| `HLTB Completista` | `number` | Horas estimadas para completar al 100% |
| `Portada` | `files` | URL de la imagen de portada/banner del juego |
| `Géneros` | `multi_select` | Lista de géneros (ej: `Acción`, `RPG`, `Aventura`) |
| `Link` | `url` | Enlace a la página de Wikipedia o tienda Steam |
| `Plataforma` | `select` | Plataforma de juego (`PC`, `Console`, etc.) |
| `Estado` | `status` / `select` | `Por Jugar`, `Jugando`, `Jugado` |
| `Fecha de Inicio` | `date` | Fecha en formato ISO `YYYY-MM-DD` del primer registro |

### 2. Base de Datos: Películas (`DB_ID_MOVIES`)
Esquema de propiedades requerido en la base de datos de Notion para películas:

| Propiedad Notion | Tipo Notion | Propósito / Formato |
| :--- | :--- | :--- |
| `Título` | `title` | Nombre de la película, opcionalmente con año `Título (YYYY)` |
| `Portada` | `files` | URL pública del poster oficial en TMDB (`image.tmdb.org`) |
| `Resumen` | `rich_text` | Sinopsis oficial en español (truncada a límites seguros de Notion) |
| `Géneros` | `select` / `multi_select` | Género cinematográfico principal o etiquetas |
| `Link` | `url` | URL directa al artículo de la película en Wikipedia en español |

---

## 📡 Contratos de Integración de APIs Externas

### 1. Notion REST API (`https://api.notion.com/v1`)
- **Autenticación:** `Authorization: Bearer {NOTION_TOKEN}`
- **Versión:** `Notion-Version: 2022-06-28`

#### `POST /v1/databases/{database_id}/query`
- **Descripción:** Recupera las páginas y propiedades de la base de datos con soporte de paginación (`start_cursor`, `page_size`).
- **Respuesta:**
```json
{
  "object": "list",
  "results": [
    {
      "id": "uuid-page",
      "properties": {
        "Título": { "title": [{ "text": { "content": "The Witcher 3" } }] }
      }
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

#### `POST /v1/pages`
- **Descripción:** Crea una nueva página en la base de datos indicada en `parent.database_id`.
- **Payload:**
```json
{
  "parent": { "database_id": "uuid" },
  "properties": {
    "Título": { "title": [{ "text": { "content": "Cyberpunk 2077" } }] },
    "Steam ID": { "number": 1091500 }
  }
}
```

#### `PATCH /v1/pages/{page_id}`
- **Descripción:** Actualiza incrementalmente solo las propiedades enviadas en el cuerpo sin alterar las restantes.

---

### 2. Steam Web API (`http://api.steampowered.com`)

#### `GET /IPlayerService/GetOwnedGames/v0001/`
- **Parámetros:** `key={STEAM_KEY}`, `steamid={STEAM_USER_ID}`, `include_appinfo=1`, `format=json`.
- **Respuesta:**
```json
{
  "response": {
    "game_count": 120,
    "games": [
      {
        "appid": 1091500,
        "name": "Cyberpunk 2077",
        "playtime_forever": 3450,
        "img_icon_url": "hash"
      }
    ]
  }
}
```

#### `GET https://store.steampowered.com/api/appdetails?appids={appid}&l=spanish`
- **Descripción:** Extrae portada de alta definición (`header_image`), capturas de pantalla y lista de géneros.

---

### 3. The Movie Database (TMDB v3 API)

#### `GET https://api.themoviedb.org/3/search/movie`
- **Parámetros:** `api_key={TMDB_KEY}`, `query={titulo}`, `year={año}`, `language=es-ES`.
- **Respuesta:**
```json
{
  "page": 1,
  "results": [
    {
      "id": 872585,
      "title": "Oppenheimer",
      "overview": "Historia del físico teórico estadounidense J. Robert Oppenheimer...",
      "poster_path": "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
      "genre_ids": [18, 36]
    }
  ]
}
```

---

### 4. Wikipedia OpenSearch API

#### `GET https://es.wikipedia.org/w/api.php`
- **Parámetros:** `action=opensearch`, `search={titulo}`, `limit=1`, `namespace=0`, `format=json`.
- **Respuesta:**
```json
[
  "Oppenheimer",
  ["Oppenheimer (película)"],
  [""],
  ["https://es.wikipedia.org/wiki/Oppenheimer_(pel%C3%ADcula)"]
]
```
