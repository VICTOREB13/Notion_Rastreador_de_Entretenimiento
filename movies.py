import json
import time
import requests
import os
import urllib.parse
import re # Librería para detectar años entre paréntesis (Ej: 2023)

# ================= CONFIGURACIÓN =================
try:
    NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
    TMDB_KEY = os.environ.get("TMDB_KEY", "").strip()
except:
    NOTION_TOKEN = ""
    TMDB_KEY = ""

# IDs (Los que ya confirmamos que funcionan)
DB_ID = "2c794bde-8dc7-8165-830e-fe4a2703c68b"

# =================================================


HEADERS_NOTION = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

# --- 1. BUSCADOR TMDB INTELIGENTE ---
def buscar_tmdb(titulo_original):
    if not TMDB_KEY: return None, None, None

    # A. LIMPIEZA DE TÍTULO: Detectar si el usuario puso "Titulo (2023)"
    # Esto mejora la búsqueda un 200%
    titulo_limpio = titulo_original
    anio_filtro = None
    
    # Regex: Busca algo entre paréntesis que sean 4 números al final
    match = re.search(r'(.+?)\s*\((\d{4})\)', titulo_original)
    if match:
        titulo_limpio = match.group(1).strip() # "Barbie"
        anio_filtro = match.group(2)           # "2023"

    url = "https://api.themoviedb.org/3/search/movie"
    
    # B. INTENTO 1: BÚSQUEDA EN ESPAÑOL
    params = {
        "api_key": TMDB_KEY, 
        "query": titulo_limpio, 
        "language": "es-ES"
    }
    # Si detectamos año, lo añadimos al filtro para ser exactos
    if anio_filtro:
        params["year"] = anio_filtro

    try:
        r = requests.get(url, params=params, timeout=5)
        data = r.json()
        
        if data.get("results"):
            m = data["results"][0]
            
            # 1. Imagen
            poster_path = m.get("poster_path")
            img_url = f"https://image.tmdb.org/t/p/original{poster_path}" if poster_path else None
            
            # 2. Sinopsis (Lógica de Fallback)
            sinopsis = m.get("overview", "")
            if not sinopsis:
                # Si no hay sinopsis en español, intentamos bajarla en Inglés
                # para no dejar el campo vacío.
                print(f"   (Sinopsis vacía en ES, buscando EN para {titulo_limpio})...")
                url_detail = f"https://api.themoviedb.org/3/movie/{m['id']}"
                r_en = requests.get(url_detail, params={"api_key": TMDB_KEY, "language": "en-US"})
                data_en = r_en.json()
                sinopsis = data_en.get("overview", "")

            # 3. Género
            genero_map = {
                28: "Acción", 12: "Aventura", 16: "Animación", 35: "Comedia",
                80: "Crimen", 99: "Documental", 18: "Drama", 10751: "Familia",
                14: "Fantasía", 36: "Historia", 27: "Terror", 10402: "Música",
                9648: "Misterio", 10749: "Romance", 878: "Ciencia ficción",
                10770: "Película de TV", 53: "Suspense", 10752: "Bélica", 37: "Western"
            }
            gen_id = m["genre_ids"][0] if m["genre_ids"] else None
            genero = genero_map.get(gen_id, "Otro")
            
            return img_url, sinopsis, genero
            
    except Exception as e:
        print(f"Error TMDB: {e}")
        
    return None, None, None

# --- 2. BUSCADOR WIKIPEDIA SABUESO ---
def buscar_wikipedia(titulo):
    # Probamos múltiples variaciones
    # 1. Título exacto + (película)
    # 2. Título exacto
    # 3. Título limpio (sin año) + (película)
    
    # Limpiar año si existe para la búsqueda
    titulo_simple = re.sub(r'\s*\(\d{4}\)', '', titulo).strip()

    queries = [
        {"lang": "es", "q": f"{titulo} (película)"},
        {"lang": "es", "q": f"{titulo} (film)"},
        {"lang": "es", "q": titulo},
        {"lang": "en", "q": f"{titulo} (film)"} # Fallback inglés
    ]
    
    # Si el título tenía año (ej: "Barbie (2023)"), añadimos búsqueda del título simple
    if titulo_simple != titulo:
        queries.insert(1, {"lang": "es", "q": f"{titulo_simple} (película)"})

    session = requests.Session()
    headers = {"User-Agent": "NotionMovieBot/2.0"}

    for item in queries:
        try:
            url = f"https://{item['lang']}.wikipedia.org/w/api.php"
            params = {"action": "opensearch", "search": item['q'], "limit": 1, "format": "json"}
            r = session.get(url, params=params, headers=headers, timeout=3)
            if r.json()[3]: return r.json()[3][0]
        except: pass
    return None

# --- 3. LEER NOTION ---
def obtener_peliculas_activas():
    # Solo traemos lo necesario, filtramos en el código para mayor control
    url = f"https://api.notion.com/v1/databases/{DB_ID}/query"
    peliculas = []
    has_more = True
    cursor = None
    
    print("🔍 Escaneando biblioteca de películas...")
    
    while has_more:
        payload = {}
        if cursor: payload["start_cursor"] = cursor
        
        r = requests.post(url, headers=HEADERS_NOTION, json=payload)
        if r.status_code != 200:
            print(f"🔴 Error Notion ({r.status_code}): {r.text}")
            break
            
        data = r.json()
        peliculas.extend(data.get("results", []))
        has_more = data.get("has_more", False)
        cursor = data.get("next_cursor")
    return peliculas

# --- 4. ACTUALIZAR (CON PROTECCIÓN) ---
def rellenar_pelicula(page):
    props = page["properties"]
    
    # Obtener Título
    try:
        if "Título" in props: titulo = props["Título"]["title"][0]["text"]["content"]
        else: titulo = props["Name"]["title"][0]["text"]["content"]
    except: return

    # --- CHEQUEO DE PROTECCIÓN (El "Candado") ---
    # Solo marcamos como "falta" si está completamente vacío.
    # Si tiene ALGO, asumimos que es correcto y no lo tocamos.
    
    falta_foto = True
    if "Portada" in props and props["Portada"]["files"]: falta_foto = False
    
    falta_link = True
    if "Link" in props and props["Link"]["url"]: falta_link = False
    
    falta_resumen = True
    if "Resumen" in props and props["Resumen"]["rich_text"]: falta_resumen = False
    
    # IMPORTANTE: Protección de Género
    # Si ya tiene un género (select), NO BUSCAMOS OTRO.
    falta_genero = True
    if "Géneros" in props and props["Géneros"]["select"]: falta_genero = False

    # Si no falta nada, terminamos aquí. Ahorramos tiempo y recursos.
    if not (falta_foto or falta_link or falta_resumen or falta_genero):
        return

    print(f"🎬 Analizando: {titulo}...")

    # --- BÚSQUEDAS (Solo de lo que falta) ---
    img, sinopsis, genero_nuevo = None, None, None
    link_wiki = None

    # Solo llamamos a TMDB si falta foto, resumen o género
    if falta_foto or falta_resumen or falta_genero:
        img, sinopsis, genero_nuevo = buscar_tmdb(titulo)

    # Solo llamamos a Wiki si falta el link
    if falta_link:
        link_wiki = buscar_wikipedia(titulo)

    # --- PREPARAR ACTUALIZACIÓN ---
    payload = {"properties": {}}
    hay_cambios = False

    # Aplicar cambios SOLO si el campo estaba vacío y encontramos dato nuevo
    
    if falta_foto and img:
        payload["properties"]["Portada"] = {"files": [{"type": "external", "name": "Poster", "external": {"url": img}}]}
        payload["cover"] = {"type": "external", "external": {"url": img}}
        payload["icon"] = {"type": "external", "external": {"url": img}}
        hay_cambios = True
    
    if falta_resumen and sinopsis:
        payload["properties"]["Resumen"] = {"rich_text": [{"text": {"content": sinopsis[:1900]}}]}
        hay_cambios = True
        
    if falta_genero and genero_nuevo:
        payload["properties"]["Géneros"] = {"select": {"name": genero_nuevo}}
        hay_cambios = True

    if falta_link and link_wiki:
        payload["properties"]["Link"] = {"url": link_wiki}
        hay_cambios = True

    # --- ENVIAR ---
    if hay_cambios:
        requests.patch(f"https://api.notion.com/v1/pages/{page['id']}", headers=HEADERS_NOTION, json=payload)
        print(f"   ✅ Actualizada (Solo campos vacíos)")
    else:
        print(f"   ⚠️ No se encontraron datos mejores.")
    
    time.sleep(0.5)

# --- MAIN ---
if __name__ == "__main__":
    lista = obtener_peliculas_activas()
    print(f"📂 Biblioteca escaneada: {len(lista)} películas.")
    for p in lista:
        rellenar_pelicula(p)
    print("✨ Fin del proceso.")
