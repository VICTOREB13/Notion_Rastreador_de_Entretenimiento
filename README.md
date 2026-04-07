# 🎬 Notion Entertainment Tracker 🎮

¡Bienvenido a tu centro de control de entretenimiento definitivo! Esta herramienta automatiza la sincronización y el enriquecimiento de tus bibliotecas de **Videojuegos** y **Películas** directamente en **Notion**, utilizando **GitHub Actions** para que tú no tengas que mover un dedo.

---

## 👀 Vista Previa (Live Demo)

Puedes ver cómo quedan mis bases de datos personales utilizando esta herramienta:
- 🎮 [**Rastreador de Videojuegos**](https://wave-sheep-2ac.notion.site/Rastreador-de-Videojuegos-29094bde8dc780989bcde4c10d572e1b?source=copy_link)
- 🎬 [**Rastreador de Películas**](https://wave-sheep-2ac.notion.site/Rastreador-de-Peliculas-2c794bde8dc780dd941fce278b0b399f?source=copy_link)

---

## ✨ Características Principales

### 🎮 Módulo de Videojuegos (`games.py`)
- **Sincronización con Steam**: Importa automáticamente tus juegos de Steam con más de 30 minutos de juego.
- **Metadatos Inteligentes**: Extrae portadas, géneros y enlaces de Wikipedia.
- **HLTB Integration**: Obtiene automáticamente las horas estimadas para completar el juego (Main Story & Completionist) desde *HowLongToBeat*.
- **Fuzzy Matching**: Evita duplicados comparando títulos de forma inteligente (ej: resuelve diferencias de puntuación o símbolos).

### 🎬 Módulo de Películas (`movies.py`)
- **Enriquecimiento TMDB**: Al añadir el título de una película, el script busca automáticamente el póster, la sinopsis en español y el género en *The Movie Database*.
- **Buscador de Wikipedia**: Añade un enlace directo a la entrada de Wikipedia de la película.
- **Protección de Datos**: No sobreescribe información que ya hayas editado manualmente (respeta tus "candados").

---

## 🛠️ Configuración (Setup)

Para que la automatización funcione, necesitas configurar algunos "Secrets" en tu repositorio de GitHub.

### 1. Claves Necesarias (Variables de Entorno)

| Variable | Descripción | ¿Dónde obtenerla? |
| :--- | :--- | :--- |
| `NOTION_TOKEN` | Token de Integración de Notion | [Notion Developers](https://www.notion.so/my-integrations) |
| `DB_ID_GAMES` | ID de tu base de datos de Juegos | URL de tu base de datos en Notion |
| `DB_ID_MOVIES` | ID de tu base de datos de Películas | URL de tu base de datos en Notion |
| `STEAM_KEY` | API Key de Steam | [Steam Community](https://steamcommunity.com/dev/apikey) |
| `STEAM_USER_ID` | Tu ID de usuario de Steam (64 bits) | Tu perfil de Steam |
| `TMDB_KEY` | API Key de The Movie Database | [TMDB API Settings](https://www.themoviedb.org/settings/api) |
| `RAWG_KEY` | API Key de RAWG (Opcional) | [RAWG.io API](https://rawg.io/apidocs) |

### 2. Estructura de Notion

Asegúrate de que tus bases de datos tengan las siguientes propiedades (nombres exactos):

**Juegos:**
- `Título` (Title)
- `Steam ID` (Number)
- `Horas Jugadas` (Number)
- `HLTB Principal` (Number)
- `HLTB Completista` (Number)
- `Portada` (Files & Media)
- `Géneros` (Multi-select o Select)
- `Link` (URL)

**Películas:**
- `Título` (Title)
- `Portada` (Files & Media)
- `Resumen` (Text)
- `Géneros` (Select)
- `Link` (URL)

---

## 🤖 Automatización

El sistema utiliza **GitHub Actions** para ejecutarse de forma periódica:
- **Juegos**: Se sincronizan cada **6 horas**.
- **Películas**: Se actualizan una vez al día (**cada 24 horas**).

*Puedes forzar una ejecución manual desde la pestaña "Actions" en GitHub seleccionando el workflow y haciendo clic en "Run workflow".*

---

## 🙏 Créditos

Este proyecto se basa en la excelente estructura de este [Template Original de Notion](https://www.notion.com/templates/video-games-tracker).

---

## 📄 Licencia

Este proyecto está bajo la licencia **MIT**. Siéntete libre de usarlo, modificarlo y compartirlo.

---

Creado por [Victor Esparragoza](https://github.com/VICTOREB13) con ❤️ para organizar el ocio de forma inteligente.
