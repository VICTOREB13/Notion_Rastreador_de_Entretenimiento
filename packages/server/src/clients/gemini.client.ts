import { GoogleGenAI, Type } from "@google/genai";
import type { IAiProvider, AiPromptPayload, AiEnrichmentResult } from "@repo/database";
import { config } from "../config";

export const EntertainmentEnrichmentSchema = {
  type: Type.OBJECT,
  properties: {
    vibeTags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "3 a 4 etiquetas concisas de ambientación, estado de ánimo o momento idóneo (ej: 'Lluvia & Café', 'Adrenalina Pura', 'Cerebral', 'Nostalgia')",
    },
    personalizedPitch: {
      type: Type.STRING,
      description:
        "2 frases concisas y persuasivas explicando por qué Victor debería jugar o ver este título hoy según sus puntos fuertes.",
    },
    thematicTropes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "3 a 5 tropos narrativos, mecánicas o estéticas destacadas (ej: 'Time-Loop', 'Cyberpunk Noir', 'Pixel Art Atmosférico')",
    },
    completionEstimateWeeks: {
      type: Type.NUMBER,
      description:
        "Semanas estimadas para completarlo a un ritmo personal estándar de 5 a 7 horas semanales. Opcional o null si no aplica.",
    },
  },
  required: ["vibeTags", "personalizedPitch", "thematicTropes"],
  propertyOrdering: ["vibeTags", "personalizedPitch", "thematicTropes", "completionEstimateWeeks"],
};

export interface GenAiClientLike {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        temperature?: number;
        responseMimeType?: string;
        responseJsonSchema?: unknown;
      };
    }): Promise<{ text?: string | null }>;
  };
}

export class GeminiClient implements IAiProvider {
  readonly id = "gemini" as const;
  readonly defaultModel = "gemini-2.5-flash";

  private clientInstance?: GenAiClientLike;

  constructor(
    private apiKey?: string,
    private customClient?: GenAiClientLike
  ) {
    if (customClient) {
      this.clientInstance = customClient;
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    this.clientInstance = undefined;
  }

  setCustomClient(client?: GenAiClientLike): void {
    this.clientInstance = client;
  }

  getClient(apiKeyOverride?: string): GenAiClientLike {
    if (this.clientInstance) {
      return this.clientInstance;
    }
    const key = apiKeyOverride || this.apiKey || config.geminiApiKey;
    if (!key) {
      throw new Error(
        "GEMINI_API_KEY no configurada. Configure la clave en .env o en /api/settings/ai"
      );
    }
    return new GoogleGenAI({ apiKey: key });
  }

  buildPrompt(payload: AiPromptPayload): string {
    const isGame = payload.type === "GAME";
    return `Eres el curador personal de entretenimiento de Victor. Tu labor es analizar este ${
      isGame ? "videojuego" : "largometraje / película"
    } y generar un enriquecimiento contextual y psicológico fascinante para su biblioteca personal de Notion.

Título: ${payload.title}
Tipo: ${payload.type}
Géneros: ${payload.genres.join(", ") || "No especificados"}
${payload.overview ? `Sinopsis / Descripción: ${payload.overview.length > 2000 ? payload.overview.slice(0, 2000) + "..." : payload.overview}` : ""}
${payload.playtimeOrDuration ? `Detalles de duración / HLTB: ${payload.playtimeOrDuration}` : ""}
${payload.userContext ? `Contexto del usuario: ${payload.userContext}` : ""}

Instrucciones clave:
1. vibeTags: 3 a 4 etiquetas concisas de ambientación, estado de ánimo o momento idóneo en español (ej: "Lluvia & Café", "Adrenalina Pura", "Cerebral", "Nostalgia").
2. personalizedPitch: 2 frases directas, elegantes y apasionadas explicando por qué Victor debería ${
      isGame ? "jugarlo" : "verla"
    } hoy, resaltando sus puntos fuertes distintivos.
3. thematicTropes: 3 a 5 tropos narrativos, mecánicas o estéticas destacadas (ej: "Time-Loop", "Cyberpunk Noir", "Pixel Art Atmosférico").
4. completionEstimateWeeks: Semanas estimadas para completarlo a un ritmo personal de 5-7 horas semanales. ${
      isGame ? "Calculado en base a su duración." : "Para películas, debe ser null o 0."
    }`;
  }

  async generateEnrichment(
    payload: AiPromptPayload,
    modelOverride?: string,
    apiKeyOverride?: string,
    temperature?: number
  ): Promise<AiEnrichmentResult> {
    const client = this.getClient(apiKeyOverride);
    const model = modelOverride || this.defaultModel;
    const prompt = this.buildPrompt(payload);

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: typeof temperature === "number" ? temperature : 0.7,
        responseMimeType: "application/json",
        responseJsonSchema: EntertainmentEnrichmentSchema,
      },
    });

    const rawText = (response.text || "{}").trim();
    let parsed: any;
    try {
      let cleaned = rawText;
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      }
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: extraer subcadena entre primer '{' y último '}'
      const start = rawText.indexOf("{");
      const end = rawText.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        try {
          parsed = JSON.parse(rawText.substring(start, end + 1));
        } catch {
          throw new Error(`Respuesta inválida de Gemini: no es un JSON válido. Contenido: ${rawText}`);
        }
      } else {
        throw new Error(`Respuesta inválida de Gemini: no es un JSON válido. Contenido: ${rawText}`);
      }
    }

    let vibeTags: string[] = [];
    if (Array.isArray(parsed.vibeTags)) {
      vibeTags = parsed.vibeTags.map(String).map((s: string) => s.trim()).filter(Boolean);
    } else if (typeof parsed.vibeTags === "string") {
      vibeTags = parsed.vibeTags.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    const personalizedPitch =
      typeof parsed.personalizedPitch === "string" ? parsed.personalizedPitch.trim() : "";

    let thematicTropes: string[] = [];
    if (Array.isArray(parsed.thematicTropes)) {
      thematicTropes = parsed.thematicTropes.map(String).map((s: string) => s.trim()).filter(Boolean);
    } else if (typeof parsed.thematicTropes === "string") {
      thematicTropes = parsed.thematicTropes.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    let completionEstimateWeeks: number | undefined;
    if (typeof parsed.completionEstimateWeeks === "number" && !isNaN(parsed.completionEstimateWeeks)) {
      completionEstimateWeeks = parsed.completionEstimateWeeks;
    } else if (
      typeof parsed.completionEstimateWeeks === "string" &&
      !isNaN(parseFloat(parsed.completionEstimateWeeks))
    ) {
      completionEstimateWeeks = parseFloat(parsed.completionEstimateWeeks);
    }

    return {
      vibeTags,
      personalizedPitch,
      thematicTropes,
      completionEstimateWeeks,
      rawResponse: rawText,
    };
  }

  async testConnection(apiKeyOverride?: string, modelOverride?: string): Promise<boolean> {
    try {
      const client = this.getClient(apiKeyOverride);
      const model = modelOverride || this.defaultModel;
      const res = await client.models.generateContent({
        model,
        contents: "Responde únicamente con la palabra OK.",
      });
      return Boolean(res.text && res.text.length > 0);
    } catch {
      return false;
    }
  }
}

export const geminiClient = new GeminiClient();
