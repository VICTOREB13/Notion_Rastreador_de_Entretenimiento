---
tipo: rfc
proyecto: Notion_Rastreador_de_Entretenimiento
titulo: RFC - Arquitectura Multi-Proveedor de Inteligencia Artificial (Gemini, DeepSeek, Groq, Ollama)
estado: propuesto / rfc
fecha: 2026-11-01
autores: [Antigravity Architecture Team]
tags: [rfc, ai, multi-provider, ollama, groq, deepseek, gemini, local-first]
---

# 📑 RFC: Arquitectura Multi-Proveedor de Inteligencia Artificial Soberana

> **Estado:** Propuesto (Roadmap Futuro)  
> **Ámbito:** Backend Daemon Hono RPC (`packages/server`), Base de Datos Embebida SQLite (`packages/database`), Frontend Next.js 16 (`apps/web`).  
> **Objetivo:** Permitir al usuario alternar sin fricción entre Google Gemini (proveedor de referencia por defecto), proveedores ultra-rápidos en la nube (Groq, DeepSeek) y modelos locales de código abierto ejecutándose en su propia máquina vía Ollama (`http://localhost:11434`), garantizando cero dependencia de internet y total soberanía de datos.

---

## 1. Contexto y Motivación

Actualmente, el sistema utiliza **Google Gemini** (`gemini-2.5-flash`) como motor de inferencia único para enriquecer el catálogo de videojuegos y cinefilia con:
- `vibeTags`: Etiquetas de ambiente y atmósfera (`["Cyberpunk Distópico", "Nostalgia 90s"]`).
- `personalizedPitch`: Gancho narrativo personalizado en 1-2 oraciones.
- `thematicTropes`: Tropos de narrativa y diseño.
- `completionEstimateWeeks`: Estimación de semanas según tiempo disponible.

Si bien Gemini ofrece un tier gratuito generoso y alta calidad en razonamiento en español, existen casos de uso clave que demandan una arquitectura multi-proveedor:
1. **Privacidad & Modo Offline Completo (Local-First):** Poder correr inferencia con **Ollama** (`llama3.2`, `qwen2.5:7b`, `mistral`, `deepseek-r1:8b`) sin enviar datos fuera de la red local.
2. **Ultra-Baja Latencia (LPU Inference):** Utilizar **Groq** (`llama-3.3-70b-versatile`) con tasas de >300 tokens/segundo para enriquecimientos masivos instantáneos.
3. **Optimización de Costos y Razonamiento Económico:** Soportar **DeepSeek V3** (`deepseek-chat`) para tareas de análisis temático profundo a costos ultra-bajos.
4. **Resiliencia ante Caídas (Automatic Fallback):** Si una clave de Gemini agota su cuota por segundo o el proveedor experimenta indisponibilidad, conmutar transparentemente al siguiente proveedor configurado.

---

## 2. Estado Actual de la Base de Datos y Modelo `AiSettings`

El esquema relacional de SQLite (`packages/database/prisma/schema.prisma`) ya fue preparado anticipadamente para soportar esta transición:

```prisma
model AiSettings {
  id             String   @id @default("default")
  activeProvider String   @default("gemini") // "gemini" | "deepseek" | "groq" | "ollama"
  geminiApiKey   String?
  deepseekApiKey String?
  groqApiKey     String?
  ollamaBaseUrl  String?  @default("http://localhost:11434")
  selectedModel  String   @default("gemini-2.5-flash")
  temperature    Float    @default(0.35)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("ai_settings")
}
```

Asimismo, el modelo `AiEnrichment` persiste qué proveedor y modelo específico generó cada ficha:
```prisma
model AiEnrichment {
  ...
  provider    String   @default("gemini")
  modelUsed   String
  rawResponse String?
  ...
}
```

---

## 3. Arquitectura de Software Propuesta (Patrón Adapter & Factory)

### 3.1. Interfaz Común del Proveedor (`IAiProviderClient`)

Se define una abstracción estricta e independiente del SDK vendor en `packages/server/src/clients/ai-provider.interface.ts`:

```typescript
export interface AiPromptPayload {
  title: string;
  type: "GAME" | "MOVIE";
  overview?: string;
  genres: string[];
  playtimeOrDuration?: string;
  userContext?: string;
}

export interface AiEnrichmentResult {
  vibeTags: string[];
  personalizedPitch: string;
  thematicTropes: string[];
  completionEstimateWeeks?: number;
  rawResponse?: string;
}

export interface IAiProviderClient {
  readonly providerId: "gemini" | "deepseek" | "groq" | "ollama";
  generateEnrichment(
    payload: AiPromptPayload,
    model: string,
    apiKey?: string,
    temperature?: number,
    baseUrl?: string
  ): Promise<AiEnrichmentResult>;
  testConnection(
    apiKey?: string,
    model?: string,
    baseUrl?: string
  ): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
}
```

### 3.2. Clientes Adaptadores por Proveedor

1. **`GeminiClient` (`packages/server/src/clients/gemini.client.ts`):**
   - Implementa `IAiProviderClient` usando la API REST v1beta de Google Generative AI (`generateContent` con `responseSchema` JSON estricto).
2. **`GroqClient` (`packages/server/src/clients/groq.client.ts`):**
   - Consume el endpoint compatible OpenAI `https://api.groq.com/openai/v1/chat/completions` con `response_format: { type: "json_object" }`.
3. **`DeepSeekClient` (`packages/server/src/clients/deepseek.client.ts`):**
   - Consume `https://api.deepseek.com/chat/completions` con `response_format: { type: "json_object" }`.
4. **`OllamaClient` (`packages/server/src/clients/ollama.client.ts`):**
   - Consume `POST {ollamaBaseUrl}/api/generate` con formato `"format": "json"` y streaming deshabilitado (`"stream": false`).

### 3.3. Fábrica y Resolución Dinámica en `GeminiEnricherService`

`GeminiEnricherService` evoluciona hacia `MultiAiEnricherService` delegando a una fábrica:

```typescript
export class AiProviderFactory {
  static getProvider(providerId: string): IAiProviderClient {
    switch (providerId) {
      case "groq":
        return groqClient;
      case "deepseek":
        return deepseekClient;
      case "ollama":
        return ollamaClient;
      case "gemini":
      default:
        return geminiClient;
    }
  }
}
```

---

## 4. Contratos de API Existentes y Compatibilidad

Los contratos vigentes en `artifacts/architecture/api_spec.md` ya contemplan los campos necesarios:

- `GET /api/settings/ai`: Retorna el proveedor activo, el modelo, la temperatura y qué proveedores tienen credenciales configuradas (valores booleanos enmascarados).
- `PUT /api/settings/ai`:
  ```json
  {
    "activeProvider": "ollama",
    "selectedModel": "llama3.2:latest",
    "ollamaBaseUrl": "http://localhost:11434",
    "temperature": 0.3
  }
  ```
- `POST /api/settings/ai/test`: Valida conectividad y latencia contra el proveedor especificado antes de activarlo en caliente.

---

## 5. Estrategia de Fallback y Resiliencia

```text
┌────────────────────────────────────────────────────────┐
│             Solicitud de Enriquecimiento IA            │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────▼───────────┐
               │    Proveedor Activo    │
               │ (ej: Ollama / Groq)   │
               └────────────┬───────────┘
                            │
              ¿Éxito? ──────┴─────► [Guardar en SQLite]
                │ No (Timeout / 429)
                ▼
       ┌────────────────────────┐
       │   Fallback Secundario   │
       │    (Google Gemini)     │
       └────────────┬───────────┘
                    │
                    ▼
            [Guardar en SQLite]
```

Si el proveedor activo (ej. Ollama local) no está encendido o responde con error de conexión `ECONNREFUSED`, el servicio puede intentar el fallback secundario configurado (Gemini) sin interrumpir el flujo del usuario ni dejar registros huérfanos.

---

## 6. Plan de Implementación por Fases (Futuro PR)

1. **Fase 1: Implementación de Adaptadores**
   - Crear `GroqClient` y `OllamaClient` respetando la interfaz `IAiProviderClient`.
   - Incorporar prompts con schema JSON determinista para modelos que no soportan `responseSchema` nativo de Gemini.
2. **Fase 2: Conexión en `settings.controller.ts`**
   - Conectar las opciones del switch en `PUT /api/settings/ai` y la prueba en `POST /api/settings/ai/test`.
3. **Fase 3: Selector en UI Web (`TelemetryModal.tsx`)**
   - Permitir al usuario cambiar de proveedor desde un dropdown amigable, con test de ping en tiempo real antes de guardar.
4. **Fase 4: Suite de Pruebas Unitarias y Mocks**
   - Tests con mocks de respuestas HTTP para Groq, DeepSeek y Ollama garantizando paridad total con la especificación.

---

## 7. Conclusión y Recomendación

Mantener **Google Gemini como proveedor único por defecto** en la versión actual (v2.4.0) preserva la estabilidad, simplicidad de despliegue y minimiza el consumo de memoria en máquinas locales. Este RFC queda formalmente registrado como la guía canónica para cuando el usuario decida abrir el PR de soporte multi-proveedor.
