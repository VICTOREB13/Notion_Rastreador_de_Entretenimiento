# Esquema Canónico: `artifacts/architecture/api_spec.md`

**Rol:** Catálogo maestro de endpoints, modelos de datos y contratos de comunicación.
**Tipo de Artefacto:** Artefacto Vivo (Living Artifact - Zero-Touch).
**Agente Responsable:** `Backend-Architect`.

---

````markdown
---
tipo: api_spec
proyecto: Nombre_Del_Proyecto
estado: activo
tags: [proyecto, api, backend, contratos, living-doc]
---

# 📡 Especificación de API y Modelos de Datos

> **Instrucción para Backend-Architect:** Diseña aquí los modelos de base de datos y los endpoints antes de escribir código. Frontend-UI consumirá exclusivamente este contrato.
> **Sinergia Vertical Slice (VSA):** Este archivo actúa como catálogo maestro de endpoints. La validación granular de esquemas de datos vive co-localizada en cada slice (`*.schema.ts`).
> **Política Zero-Touch:** No lleva versión volátil en el frontmatter. Se actualiza únicamente de forma incremental cuando se añade o modifica un endpoint o modelo.

## 🗄️ Modelos de Base de Datos

### Modelo: `[NombreModelo]`
- **Tabla:** `[nombre_tabla_plural]`
- **Campos:**
  - `id`: UUID / BigInteger (Primary Key)
  - `tenant_id`: UUID (Indexed leftmost prefix para multi-tenancy si aplica)
  - `created_at` / `updated_at`: Timestamps
- **Índices Compuestos:** `[tenant_id, campo_frecuente]`

---

## 📡 Endpoints de la API

### `[METODO] /api/[ruta]`
- **Descripción:** [Propósito del endpoint]
- **Autenticación / RBAC:** [Público / Bearer Token / Role required]
- **Request Body (JSON):**
```json
{
  "campo": "valor"
}
```
- **Respuestas:**
  - `200 OK` / `201 Created`:
```json
{
  "success": true,
  "data": {}
}
```
  - `400 Bad Request` / `404 Not Found` / `500 Server Error`
````
