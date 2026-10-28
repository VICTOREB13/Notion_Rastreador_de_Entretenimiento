# Esquema Canónico: `artifacts/architecture/abstractions.md`

**Rol:** Abstracciones de alto nivel, interfaces de dominio, servicios de negocio, funciones puras y costuras de flujo de datos (data seams).
**Tipo de Artefacto:** Artefacto Vivo (Living Artifact - Zero-Touch).
**Agente Responsable:** `Backend-Architect`.

---

```markdown
---
tipo: abstracciones
proyecto: Nombre_Del_Proyecto
estado: activo
tags: [proyecto, arquitectura, abstracciones, backend, living-doc]
---

# 🏛️ Abstracciones del Sistema y Arquitectura de Código

> **Instrucción para Backend-Architect:** Documenta aquí las clases maestras, interfaces de dominio, servicios de negocio, funciones utilitarias nucleares y variables globales o de configuración. Actúa como el complemento conceptual de `api_spec.md`.
> **Política Zero-Touch:** No lleva versión ni fecha volátil en el frontmatter. Solo se modifica si se introduce una nueva interfaz transversal o servicio nuclear del dominio.

## 🏛️ Filosofía de Diseño y Paradigmas de Código
- **Patrón Arquitectónico:** [Clean Architecture / DDD / Modular Monolith / MVC]
- **Principios Rectores:** [IoC/DI, Single Responsibility, Inmutabilidad, Manejo determinista de errores]

---

## 🧩 Módulos y Capas del Sistema
- **Dominio / Entidades:** [Reglas de negocio puras, Value Objects e invariantes]
- **Aplicación / Servicios:** [Casos de uso y orquestación de operaciones]
- **Infraestructura / Repositorios:** [Persistencia concreta, clientes HTTP externos y brokers]
- **Presentación / Controladores:** [Rutas, DTOs y serialización]

---

## 📐 Interfaces y Contratos de Dominio
### `I[NombreContrato]`
- **Propósito:** [Frontera de abstracción de servicio o repositorio]
- **Firmas:** `metodo(param: Tipo): Promise<Resultado>`

---

## ⚙️ Clases Núcleo y Servicios de Negocio
### Clase: `[NombreServicio]`
- **Responsabilidad:** [Propósito único / SRP]
- **Dependencias Inyectadas:** `[IDependenciaA, IDependenciaB]`
- **Métodos Clave:**
  - `ejecutarAccion(entrada: DTO): SalidaDTO`: Qué computa, efectos secundarios y excepciones controladas.

---

## 🛠️ Funciones Críticas y Lógica Pura
### `[nombreFuncion(param1, param2)]`
- **Módulo:** `utils/` o `domain/rules/`
- **Entrada / Salida:** Tipos y transformaciones deterministas sin efectos secundarios.

---

## 🌐 Variables de Estado, Constantes Globales y Configuración
- **Variables de Entorno (.env):** `VAR_NAME` (propósito, tipo, obligatoriedad y fallback seguro).
- **Enums y Constantes:** Estados de máquina, límites de concurrencia y flags de configuración.

---

## 🔄 Costuras de Flujo de Datos (Data Seams)
- **Lifecycle Request-to-Persistence:** Controller -> Service -> Repository -> Domain Event -> Response.
- **Eventos y Observers:** Eventos disparados y manejadores suscritos.
```
