import json
import time
import requests
import os
import urllib.parse
import re  # Librería para detectar años entre paréntesis (Ej: 2023)

# ================= CONFIGURACIÓN =================
try:
    NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
    TMDB_KEY = os.environ.get("TMDB_KEY", "").strip()
except:
    NOTION_TOKEN = ""
    TMDB_KEY = ""

# ID DE TU BASE DE DATOS (Ahora desde variables de entorno)
DB_ID = os.environ.get("DB_ID_MOVIES", "").strip()

# =================================================

HEADERS_NOTION = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}


# --- UTILIDADES DE PROPIEDADES NOTION ---
def buscar_clave_propiedad(props, opciones):
    """Busca una clave en las propiedades de Notion ignorando mayúsculas/minúsculas."""
    for opt in opciones:
        if opt in props:
            return opt
    props_lower = {k.lower(): k for k in props.keys()}
    for opt in opciones:
        if opt.lower() in props_lower:
            return props_lower[opt.lower()]
    return None


def obtener_titulo_pelicula(props):
    """Extrae el título de la página de forma segura sin romper en páginas vacías."""
    clave = buscar_clave_propiedad(props, ["Título", "Titulo", "Name", "Nombre", "Title", "Película", "Pelicula"])
    if clave and props[clave].get("title"):
        title_list = props[clave]["title"]
        if title_list and len(title_list) > 0:
            return title_list[0]["text"]["content"].strip()
    return None


# --- 1. BUSCADOR TMDB INTELIGENTE (MULTI-INTENTO FALLBACK) ---
def buscar_tmdb(titulo_original):
    if not TMDB_KEY:
        return None, None, None

    # A. LIMPIEZA DE TÍTULO: Detectar si el usuario puso "Titulo (2023)"
    titulo_limpio = titulo_original
    anio_filtro = None

    # Regex: Busca algo entre paréntesis que sean 4 números
    match = re.search(r'(.+?)\s*\((\d{4})\)', titulo_original)
    if match:
        titulo_limpio = match.group(1).strip()  # "Barbie"
        anio_filtro = match.group(2)            # "2023"

    url = "https://api.themoviedb.org/3/search/movie"

    # B. CADENA DE INTENTOS (FALLBACK CHAIN)
    # 1. Título limpio + Año en español
    # 2. Título limpio SIN año en español (por si el año de estreno registrado en TMDB difiere)
    # 3. Título limpio en inglés
    # 4. Título original completo
    estrategias = []

    if anio_filtro:
        estrategias.append({"query": titulo_limpio, "year": anio_filtro, "language": "es-ES"})

    estrategias.append({"query": titulo_limpio, "language": "es-ES"})
    estrategias.append({"query": titulo_limpio, "language": "en-US"})

    if titulo_original != titulo_limpio:
        estrategias.append({"query": titulo_original, "language": "es-ES"})

    m = None
    for params in estrategias:
        params["api_key"] = TMDB_KEY
        try:
            r = requests.get(url, params=params, timeout=5)
            if r.status_code == 200:
                data = r.json()
                if data.get("results"):
                    m = data["results"][0]
                    break
        except Exception as e:
            print(f"   ⚠️ Error de conexión con TMDB: {e}")

    if not m:
        return None, None, None

    # 1. Imagen
    poster_path = m.get("poster_path")
    img_url = f"https://image.tmdb.org/t/p/original{poster_path}" if poster_path else None

    # 2. Sinopsis (Lógica de Fallback)
    sinopsis = m.get("overview", "")
    if not sinopsis:
        # Si no hay sinopsis en español, intentamos bajarla en inglés
        try:
            url_detail = f"https://api.themoviedb.org/3/movie/{m['id']}"
            r_en = requests.get(url_detail, params={"api_key": TMDB_KEY, "language": "en-US"}, timeout=5)
            if r_en.status_code == 200:
                data_en = r_en.json()
                sinopsis = data_en.get("overview", "")
        except:
            pass

    # 3. Género
    genero_map = {
        28: "Acción", 12: "Aventura", 16: "Animación", 35: "Comedia",
        80: "Crimen", 99: "Documental", 18: "Drama", 10751: "Familia",
        14: "Fantasía", 36: "Historia", 27: "Terror", 10402: "Música",
        9648: "Misterio", 10749: "Romance", 878: "Ciencia ficción",
        10770: "Película de TV", 53: "Suspense", 10752: "Bélica", 37: "Western"
    }
    gen_ids = m.get("genre_ids", [])
    gen_id = gen_ids[0] if gen_ids else None
    genero = genero_map.get(gen_id, "Otro")

    return img_url, sinopsis, genero


# --- 2. BUSCADOR WIKIPEDIA SABUESO ---
def buscar_wikipedia(titulo):
    titulo_simple = re.sub(r'\s*\(\d{4}\)', '', titulo).strip()

    queries = [
        {"lang": "es", "q": f"{titulo} (película)"},
        {"lang": "es", "q": f"{titulo} (film)"},
        {"lang": "es", "q": titulo},
        {"lang": "en", "q": f"{titulo} (film)"}  # Fallback inglés
    ]

    if titulo_simple != titulo:
        queries.insert(1, {"lang": "es", "q": f"{titulo_simple} (película)"})

    session = requests.Session()
    headers = {"User-Agent": "NotionMovieBot/2.0"}

    for item in queries:
        try:
            url = f"https://{item['lang']}.wikipedia.org/w/api.php"
            params = {"action": "opensearch", "search": item['q'], "limit": 1, "format": "json"}
            r = session.get(url, params=params, headers=headers, timeout=3)
            res = r.json()
            if len(res) > 3 and res[3]:
                return res[3][0]
        except:
            pass
    return None


# --- 3. LEER NOTION ---
def obtener_peliculas_activas():
    url = f"https://api.notion.com/v1/databases/{DB_ID}/query"
    peliculas = []
    has_more = True
    cursor = None

    print("🔍 Escaneando biblioteca de películas...")

    while has_more:
        payload = {}
        if cursor:
            payload["start_cursor"] = cursor

        r = requests.post(url, headers=HEADERS_NOTION, json=payload)
        if r.status_code != 200:
            print(f"🔴 Error Notion ({r.status_code}): {r.text}")
            break

        data = r.json()
        peliculas.extend(data.get("results", []))
        has_more = data.get("has_more", False)
        cursor = data.get("next_cursor")
    return peliculas


# --- 4. ACTUALIZAR (CON PROTECCIÓN Y RECONOCIMIENTO DINÁMICO) ---
def rellenar_pelicula(page):
    props = page["properties"]

    # Obtener Título de forma segura
    titulo = obtener_titulo_pelicula(props)
    if not titulo:
        print("⚠️ Película ignorada: Fila vacía o sin título en Notion.")
        return

    # Mapeo dinámico de nombres de columnas en Notion
    clave_portada = buscar_clave_propiedad(props, ["Portada", "Cover", "Imagen", "Poster", "Póster"])
    clave_link = buscar_clave_propiedad(props, ["Link", "URL", "Wikipedia", "Enlace"])
    clave_resumen = buscar_clave_propiedad(props, ["Resumen", "Sinopsis", "Overview", "Descripción", "Descripcion"])
    clave_generos = buscar_clave_propiedad(props, ["Géneros", "Género", "Generos", "Genero", "Genres", "Genre"])

    # --- CHEQUEO DE PROTECCIÓN ("Candado") ---
    falta_foto = True
    if clave_portada and props[clave_portada].get("files"):
        falta_foto = False

    falta_link = True
    if clave_link and props[clave_link].get("url"):
        falta_link = False

    falta_resumen = True
    if clave_resumen and props[clave_resumen].get("rich_text"):
        falta_resumen = False

    falta_genero = True
    if clave_generos:
        g_prop = props[clave_generos]
        if g_prop.get("select") or g_prop.get("multi_select"):
            falta_genero = False

    # Si no falta nada, omitimos para ahorrar llamadas API
    if not (falta_foto or falta_link or falta_resumen or falta_genero):
        return

    print(f"🎬 Analizando: {titulo}...")

    # --- BÚSQUEDAS (Solo de lo que falta) ---
    img, sinopsis, genero_nuevo = None, None, None
    link_wiki = None

    if falta_foto or falta_resumen or falta_genero:
        img, sinopsis, genero_nuevo = buscar_tmdb(titulo)

    if falta_link:
        link_wiki = buscar_wikipedia(titulo)

    # --- PREPARAR ACTUALIZACIÓN ---
    payload = {"properties": {}}
    hay_cambios = False

    if falta_foto and img:
        target_portada = clave_portada or "Portada"
        payload["properties"][target_portada] = {"files": [{"type": "external", "name": "Poster", "external": {"url": img}}]}
        payload["cover"] = {"type": "external", "external": {"url": img}}
        payload["icon"] = {"type": "external", "external": {"url": img}}
        hay_cambios = True

    if falta_resumen and sinopsis:
        target_resumen = clave_resumen or "Resumen"
        payload["properties"][target_resumen] = {"rich_text": [{"text": {"content": sinopsis[:1900]}}]}
        hay_cambios = True

    if falta_genero and genero_nuevo:
        target_generos = clave_generos or "Géneros"
        # Soporte dinámico para select y multi_select en Notion
        if clave_generos and "multi_select" in props[clave_generos]:
            payload["properties"][target_generos] = {"multi_select": [{"name": genero_nuevo}]}
        else:
            payload["properties"][target_generos] = {"select": {"name": genero_nuevo}}
        hay_cambios = True

    if falta_link and link_wiki:
        target_link = clave_link or "Link"
        payload["properties"][target_link] = {"url": link_wiki}
        hay_cambios = True

    # --- ENVIAR Y VERIFICAR ---
    if hay_cambios:
        r = requests.patch(f"https://api.notion.com/v1/pages/{page['id']}", headers=HEADERS_NOTION, json=payload)
        if r.status_code == 200:
            print("   ✅ Actualizada correctamente en Notion.")
        else:
            print(f"   ❌ Error Notion ({r.status_code}): {r.text}")
    else:
        print("   ⚠️ No se encontraron datos mejores.")

    time.sleep(0.5)


# --- MAIN ---
if __name__ == "__main__":
    lista = obtener_peliculas_activas()
    print(f"📂 Biblioteca escaneada: {len(lista)} películas.")
    for p in lista:
        rellenar_pelicula(p)
    print("✨ Fin del proceso.")
