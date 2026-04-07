import json
import time
import requests
import os
import urllib.parse
from difflib import SequenceMatcher
from howlongtobeatpy import HowLongToBeat

# ==================== CONFIGURACIÓN ====================
# Leemos secretos (Con .strip() para evitar errores de cabeceras en GitHub Actions)
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
RAWG_KEY = os.environ.get("RAWG_KEY", "").strip()
STEAM_KEY = os.environ.get("STEAM_KEY", "").strip()
STEAM_USER_ID = os.environ.get("STEAM_USER_ID", "").strip()

# ID DE TU BASE DE DATOS
DB_ID = "29094bde8dc781519c47cd00ce3e7e46"

HEADERS_NOTION = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}
# =======================================================

# --- UTILIDADES ---
def limpiar_nombre(n):
    """Borra símbolos de marca y puntuación para una comparación justa"""
    if not n: return ""
    # Símbolos que suelen causar duplicados si no coinciden
    for char in ['™', '®', '©', ':', '.', ',', '!', '?', '-', '_', '(', ')']:
        n = n.replace(char, ' ')
    # Normalización: minúsculas, espacios extra fuera y orden de palabras limpio
    return " ".join(n.lower().split()).strip()

def similar(a, b):
    """Calcula qué tan parecidos son dos nombres (0 a 1)"""
    return SequenceMatcher(None, limpiar_nombre(a), limpiar_nombre(b)).ratio()

# --- 1. NOTION: LECTURA Y ESCRITURA ---
def obtener_todos_juegos_notion():
    url = f"https://api.notion.com/v1/databases/{DB_ID}/query"
    juegos = {}
    has_more = True
    cursor = None
    
    print("📂 Leyendo Notion...")
    while has_more:
        payload = {}
        if cursor: payload["start_cursor"] = cursor
        
        try:
            r = requests.post(url, headers=HEADERS_NOTION, json=payload)
            data = r.json()
            results = data.get("results", [])
            
            for page in results:
                props = page["properties"]
                # Intentamos sacar el nombre desde 'Título' o 'Name'
                nombre = ""
                if "Título" in props and props["Título"]["title"]:
                    nombre = props["Título"]["title"][0]["text"]["content"]
                elif "Name" in props and props["Name"]["title"]:
                    nombre = props["Name"]["title"][0]["text"]["content"]
                
                if nombre:
                    juegos[nombre] = page
            
            has_more = data.get("has_more", False)
            cursor = data.get("next_cursor")
        except Exception as e:
            print(f"Error leyendo Notion: {e}")
            break
            
    return juegos

def crear_juego_notion(nombre, steam_appid, horas):
    url = "https://api.notion.com/v1/pages"
    
    payload = {
        "parent": {"database_id": DB_ID},
        "properties": {
            "Título": {"title": [{"text": {"content": nombre}}]},
            "Steam ID": {"number": steam_appid},
            "Horas Jugadas": {"number": round(horas, 1)},
            "Plataforma": {"select": {"name": "PC"}},
            "Estado": {"status": {"name": "Jugado" if horas > 1 else "Por Jugar"}}
        }
    }
    requests.post(url, headers=HEADERS_NOTION, json=payload)
    print(f"✨ CREADO en Notion: {nombre}")

def actualizar_horas_notion(page_id, horas, steam_id=None):
    props = {}
    props["Horas Jugadas"] = {"number": round(horas, 1)}
    if steam_id:
        props["Steam ID"] = {"number": steam_id}
        
    requests.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=HEADERS_NOTION, json={"properties": props})
    print(f"⏳ Horas actualizadas: {round(horas, 1)}h")

# --- 2. STEAM ---
def sincronizar_steam(juegos_notion):
    if not STEAM_KEY or not STEAM_USER_ID:
        print("⚠️ Saltando Steam: Falta API Key o User ID en Secrets.")
        return

    print("🚀 Conectando con Steam...")
    url = f"http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={STEAM_KEY}&steamid={STEAM_USER_ID}&format=json&include_appinfo=true"
    
    try:
        r = requests.get(url)
        data = r.json()
        games = data["response"].get("games", [])
        
        print(f"   Steam reporta {len(games)} juegos en tu cuenta.")
        
        # Diccionario auxiliar con nombres limpios de Notion para búsqueda rápida
        juegos_notion_limpios = {limpiar_nombre(n): p for n, p in juegos_notion.items()}

        for g in games:
            nombre_steam = g["name"]
            appid = g["appid"]
            horas = g["playtime_forever"] / 60
            
            # FILTRO: Solo importamos juegos con más de 30 minutos
            if horas < 0.5:
                continue

            # Buscamos si ya existe en Notion
            encontrado = False
            nombre_steam_limpio = limpiar_nombre(nombre_steam)

            # Intento 1: Búsqueda exacta (limpia)
            if nombre_steam_limpio in juegos_notion_limpios:
                page = juegos_notion_limpios[nombre_steam_limpio]
                actualizar_horas_notion(page["id"], horas, appid)
                encontrado = True
            else:
                # Intento 2: Búsqueda por similitud (Fuzzy matching)
                for nombre_notion_limpio, page in juegos_notion_limpios.items():
                    if SequenceMatcher(None, nombre_steam_limpio, nombre_notion_limpio).ratio() > 0.9:
                        actualizar_horas_notion(page["id"], horas, appid)
                        encontrado = True
                        break
            
            # Si no existe -> LO CREAMOS
            if not encontrado:
                crear_juego_notion(nombre_steam, appid, horas)
                
    except Exception as e:
        print(f"❌ Error Steam: {e}")

# --- 3. PROVEEDORES DE DATOS (HLTB, Wiki, RAWG) ---

def buscar_hltb(juego):
    try:
        results = HowLongToBeat().search(juego)
        if results and len(results) > 0:
            best = results[0]
            return best.main_story, best.completionist
    except: pass
    return None, None

def buscar_wikipedia(juego):
    busquedas = [{"lang": "es", "q": f"{juego} videojuego"}, {"lang": "en", "q": f"{juego} video game"}]
    headers = {"User-Agent": "NotionBot/1.0"}
    for item in busquedas:
        try:
            r = requests.get(f"https://{item['lang']}.wikipedia.org/w/api.php", 
                           params={"action": "query", "list": "search", "srsearch": item['q'], "format": "json", "srlimit": 1},
                           headers=headers, timeout=3)
            data = r.json()
            if data["query"]["search"]:
                t = data["query"]["search"][0]["title"].replace(" ", "_")
                return f"https://{item['lang']}.wikipedia.org/wiki/{t}"
        except: pass
    return None

def buscar_rawg(juego):
    try:
        r = requests.get("https://api.rawg.io/api/games", params={"key": RAWG_KEY, "search": juego, "page_size": 1}, timeout=5)
        d = r.json()
        if d["results"]:
            g = d["results"][0]
            gen = g["genres"][0]["name"] if g.get("genres") else None
            return g.get("background_image"), gen
    except: pass
    return None, None

# --- 4. RELLENADOR DE METADATOS ---
def rellenar_metadata(juegos_notion):
    print("\n🔍 Revisando metadatos faltantes (HLTB, Fotos, Wiki)...")
    
    for nombre, page in juegos_notion.items():
        props = page["properties"]
        payload = {"properties": {}}
        needs_update = False
        
        # 1. HLTB
        if "HLTB Principal" in props and props["HLTB Principal"]["number"] is None:
            main_h, comp_h = buscar_hltb(nombre)
            if main_h:
                payload["properties"]["HLTB Principal"] = {"number": main_h}
                needs_update = True
            if comp_h:
                payload["properties"]["HLTB Completista"] = {"number": comp_h}
                needs_update = True

        # 2. RAWG (Foto/Género)
        falta_foto = not (props.get("Portada", {}).get("files"))
        falta_genero = not (props.get("Géneros", {}).get("multi_select") or props.get("Géneros", {}).get("select"))
        
        if falta_foto or falta_genero:
            img, gen = buscar_rawg(nombre)
            if falta_foto and img:
                payload["properties"]["Portada"] = {"files": [{"type": "external", "name": "Cover", "external": {"url": img}}]}
                payload["cover"] = {"type": "external", "external": {"url": img}}
                payload["icon"] = {"type": "external", "external": {"url": img}}
                needs_update = True
            if falta_genero and gen:
                # Intento de mapeo inteligente a select o multi_select
                if "select" in props["Géneros"]:
                    payload["properties"]["Géneros"] = {"select": {"name": gen}}
                else:
                    payload["properties"]["Géneros"] = {"multi_select": [{"name": gen}]}
                needs_update = True

        # 3. Wikipedia
        if "Link" in props and not props["Link"]["url"]:
            wiki = buscar_wikipedia(nombre)
            if wiki:
                payload["properties"]["Link"] = {"url": wiki}
                needs_update = True

        if needs_update:
            requests.patch(f"https://api.notion.com/v1/pages/{page['id']}", headers=HEADERS_NOTION, json=payload)
            print(f"   ✅ Datos actualizados: {nombre}")
            time.sleep(0.5)

# --- MAIN ---
if __name__ == "__main__":
    current_juegos = obtener_todos_juegos_notion()
    sincronizar_steam(current_juegos)
    current_juegos = obtener_todos_juegos_notion() # Refrescar
    rellenar_metadata(current_juegos)
    print("\n🏁 Sincronización completa.")
