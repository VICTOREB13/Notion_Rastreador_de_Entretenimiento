# Esquema Canónico: `artifacts/architecture/design_system.md`

**Rol:** Sistema de diseño vivo, tokens visuales, escala tipográfica, arquitectura de componentes Bento (< 300 LoC), microinteracciones y presupuestos de DOM.
**Tipo de Artefacto:** Artefacto Vivo (Living Artifact - Zero-Touch).
**Agente Responsable:** `Frontend-UI`.

---

```markdown
---
tipo: design_system
proyecto: Nombre_Del_Proyecto
estado: activo
tags: [proyecto, design-system, ui-ux, design-tokens, living-doc]
---

# 🎨 Especificación de Diseño: [Nombre del Proyecto]

> **Instrucción para Frontend-UI:** Documenta y mantén aquí la paleta semántica, escala tipográfica, arquitectura de componentes Bento y reglas de microinteracción. Actúa como SSoT visual living para evitar inconsistencias de diseño y deuda técnica.
> **Política Zero-Touch:** No lleva versiones efímeras; evoluciona incrementalmente cuando se agregan nuevos tokens, componentes o temas.

## 🏛️ 1. Filosofía de Diseño y Principios Rectores
- **Estética Visual:** High-End Tech, estética editorial o boutique (anti-slop).
- **Psicología Cognitiva (`design-everyday-things`):** Signifiers claros, affordances perceptibles, constraints y feedback < 100ms.
- **Límites de Rendimiento:** 60/120 FPS y presupuesto de DOM estricto (< 800 warning, < 1400 fatal).

---

## 🎨 2. Sistema de Tokens y Fundamentos Visuales
### 2.1 Paleta Semántica
- **Modo Oscuro (Obsidian Zinc):** Background `#09090B`, Cards `#111113`, Bordes `rgba(255,255,255,0.1)`, Texto `#FAFAFA`, Acento Primario `#EF4444`.
- **Modo Claro (Crisp Zinc):** Background `#FAFAFA`, Cards `#FFFFFF`, Bordes `#E4E4E7`, Texto `#09090B`, Acento Primario `#EF4444`.

### 2.2 Tipografía y Jerarquía
- **Marca e Imagotipo:** `Satoshi` (Bold 700 / Black 900).
- **Display, Hero y Métricas:** `Outfit` (Bold 700 / SemiBold 600 con números tabulares).
- **Cuerpo y Controles:** `Inter` o `Geist` (Regular 400 / Medium 500).

### 2.3 Radios, Espaciado y Elevación
- **Radio Base:** `12px` (controles), `16-24px` (tarjetas), `9999px` (pills y badges).
- **Elevación:** Hover sutil `translateY(-2px)` con resplandor difuso del color de acento.

---

## 🧩 3. Arquitectura de Componentes & Layout (< 300 LoC)
- **Navegación / AppBars:** Dock flotante o barra superior con estado activo claro.
- **Bento Grids & Cards:** Módulos asimétricos autocontenidos.
- **Formularios & Modales:** Inputs con focus ring de 1.5px y modales con backdrop blur.

---

## ⚡ 4. Coreografía de Microinteracciones y Motion
- **Active Touch Feedback:** Micro-escala elástica (`scale: 0.97`) en clic/tap.
- **Transiciones:** 150-200ms cúbicas suaves.

---

## 📋 5. Checklist de Validación Visual
- [ ] Presupuesto de DOM validado (< 800 recomendado, < 1400 fatal).
- [ ] Ratios de contraste WCAG AA verificados.
- [ ] Cero componentes con más de 300 LoC.
```
