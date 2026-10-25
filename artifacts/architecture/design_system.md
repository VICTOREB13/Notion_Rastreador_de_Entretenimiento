---
tipo: design_system
proyecto: Notion_Rastreador_de_Entretenimiento
estado: activo
fecha: 2026-10-25
tags: [proyecto, design-system, ui-ux, design-tokens, living-doc]
---

# 🎨 Especificación de Diseño: Notion Rastreador de Entretenimiento

> **Artefacto Vivo (SSoT Visual):** Documento maestro de interfaz de usuario (UI), experiencia de usuario (UX), sistema de tokens visuales, tipografía, arquitectura de componentes y microinteracciones para las vistas de Notion, galerías Bento y tableros interactivos (Streamlit / Web UI) de entretenimiento.

---

## 🏛️ 1. Filosofía de Diseño y Principios Rectores

1. **Estética de Ocio & Curaduría de Entretenimiento:** Fusión equilibrada entre el minimalismo estructurado de Notion y la inmersión visual de plataformas como Steam y TMDB. Superficies oscuras profundas (*Obsidian Zinc*) con acentos dinámicos de alta energía para carátulas y posters.
2. **Arquitectura Zero-Slop & Máximo Rendimiento:** Rechazo a componentes inflados o genéricos. Presupuesto estricto de nodos DOM (**< 800 recomendado, < 1400 límite de error**) en cualquier renderizado de frontend (Streamlit o web embebida) y paginación determinista para galerías de medios.
3. **Psicología Cognitiva y Diseño Humano (`design-everyday-things`):**
   - **Signifiers:** Badges de estado inequívocos para distinguir inmediatamente títulos completados (`Jugado`), activos (`Jugando`) y pendientes (`Por Jugar`).
   - **Affordances:** Indicadores de carátula interactiva con enlace directo al juego en Steam o artículo de Wikipedia.
   - **Constraints & Error Prevention:** Protección explícita de campos manuales mediante "candados" funcionales.
   - **Feedback Inmediato:** Transiciones fluidas (< 150ms) en tarjetas interactivas y visualizadores de progreso.
4. **Descomposición Modular Estricta (< 300 LoC):** Cada widget de visualización, tarjeta de galería o componente de analítica se aísla en módulos independientes.

---

## 🎨 2. Sistema de Tokens y Fundamentos Visuales

### 2.1. Paleta de Colores y Tokens Semánticos

#### Modo Oscuro — Obsidian Zinc & Entertainment Dark (Predeterminado)
* **Background Primario:** `#09090B` (Zinc 950 ultraprofundo / Fondo de lienzo principal)
* **Superficie / Tarjetas (Card Surface):** `#111113` (Zinc 900 elevado / Paneles de carátulas)
* **Superficie Secundaria / Inputs:** `#18181B` (Zinc 900 interactivo / Filtros y chips inactivos)
* **Bordes y Delimitadores:** `rgba(255, 255, 255, 0.08)` (Borde sutil de 1px anti-fatiga)
* **Texto Primario:** `#FAFAFA` (Zinc 50 / Contraste máximo para títulos de obras)
* **Texto Secundario:** `#A1A1AA` (Zinc 400 / Metadatos: HLTB, desarrollador, director)
* **Texto Atenuado (Muted):** `#71717A` (Zinc 500 / Etiquetas de plataforma)

#### Tokens de Identidad Temática y Estados
* **Acento Primario (Victor Engineer Red):** `#EF4444` (Acento institucional / Focus rings y alertas)
* **Acento Steam (Cyan / Electric Blue):** `#66C0F4` / Fondo `#1B2838` (Identificador de plataforma PC / Steam)
* **Acento TMDB (Cinema Teal):** `#01B4E4` / Fondo `#0D253F` (Metadatos cinematográficos oficiales)
* **Estado "Por Jugar":** `#F59E0B` (Ámbar 500 / Badge de espera)
* **Estado "Jugando":** `#3B82F6` (Azul 500 / Badge de actividad en curso)
* **Estado "Jugado" (Completado):** `#10B981` (Esmeralda 500 / Badge de éxito)

#### Modo Claro — Crisp Zinc
* **Background Primario:** `#FAFAFA`
* **Superficie / Tarjetas:** `#FFFFFF`
* **Bordes:** `#E4E4E7`
* **Texto Primario:** `#09090B`
* **Texto Secundario:** `#71717A`
* **Acento Primario:** `#EF4444`

---

### 2.2. Tipografía y Jerarquía de Texto

* **Marca & Identidad (`Satoshi`):**
  - Tipografía geométrica sans-serif moderna para cabeceras y wordmark "Victor Engineer".
  - Pesos: Bold (700) y Black (900).
* **Display, Métricas & Horas (`Outfit`):**
  - Títulos principales (H1/H2) y contadores de horas jugadas / HLTB con cifras tabulares.
  - Pesos: Bold (700) y SemiBold (600).
* **Cuerpo de Texto & Sinopsis (`Inter` / `Geist`):**
  - Sinopsis de películas y metadatos de videojuegos.
  - Pesos: Regular (400) para párrafos (line-height 1.6) y Medium (500) para chips y controles.

---

### 2.3. Radios, Espaciado y Elevaciones

* **Radio Base de Chips / Píldoras:** `9999px` (`rounded-full`) para géneros cinematográficos y estados.
* **Radio de Tarjetas Bento:** `16px` (`rounded-2xl`) con recorte de póster (`overflow-hidden`).
* **Relación de Aspecto de Carátulas:**
  - Videojuegos (Header Image / Banner): `16:9` o `460x215` (Steam standard).
  - Películas (Poster Vertical): `2:3` o `500x750` (TMDB standard).
* **Elevación & Hover:**
  - Micro-elevación suave en hover: `transform: translateY(-3px) scale(1.01)`.
  - Sombra difusa: `box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.5)`.

---

## 🧩 3. Arquitectura de Componentes Bento (< 300 LoC)

1. **Tarjeta de Videojuego (Game Bento Card):**
   - Header con carátula oficial de Steam.
   - Píldora de estado ("Jugado" / "Jugando" / "Por Jugar").
   - Medidor horizontal de horas jugadas vs. HLTB Main Story.
   - Lista horizontal de chips de género con scroll horizontal táctil.
2. **Tarjeta de Película (Movie Bento Card):**
   - Poster vertical TMDB con badge de puntuación.
   - Título y año de estreno.
   - Sinopsis colapsable (máximo 3 líneas con degradado inferior).
   - Acceso directo a Wikipedia en español.
3. **Barra de Métricas y Progreso:**
   - Total de juegos registrados, horas acumuladas en Steam y ratio de finalización.

---

## ⚡ 4. Coreografía de Microinteracciones y Motion

1. **Respuesta Táctil:** Reducción elástica al pulsar (`active:scale-98`) con retorno a 150ms.
2. **Transición de Portadas:** Desenfoque progresivo de baja resolución a alta definición (*blur-up placeholder*).
3. **Feedback de Sincronización:** Animación de pulso sutil cuando el script de GitHub Actions finaliza la actualización.

---

## 📋 5. Presupuesto DOM y Checklist de Quality Gate

- [ ] **Presupuesto DOM:** < 800 nodos en vista de tablero principal; < 1400 límite fatal en vistas densas.
- [ ] **Cero AI Slop:** Sin degradados morados genéricos ni tarjetas homogéneas repetitivas.
- [ ] **Accesibilidad (WCAG AA):** Ratios de contraste $\ge 4.5:1$ en todos los estados de texto y badges.
- [ ] **Modularidad:** Todos los componentes aislados en archivos `< 300 LoC`.
