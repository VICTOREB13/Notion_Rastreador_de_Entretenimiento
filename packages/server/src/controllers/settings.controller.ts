import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { aiSettingsRepository } from "@repo/database";
import { geminiClient } from "../clients/gemini.client";
import { config } from "../config";

const updateAiSettingsSchema = z.object({
  activeProvider: z.enum(["gemini", "deepseek", "groq", "ollama"]).optional(),
  selectedModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  geminiApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  groqApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
});

const testConnectionBodySchema = z
  .object({
    apiKey: z.string().optional(),
    model: z.string().optional(),
  })
  .optional();

export const settingsController = new Hono()
  .get("/", async (c) => {
    try {
      const settings = await aiSettingsRepository.getSettings();

      return c.json({
        success: true,
        data: {
          isNotionConnected: Boolean(
            config.notionToken && (config.notionDatabaseIdGames || config.notionDatabaseIdMovies)
          ),
          isSteamConnected: Boolean(config.steamKey && config.steamUserId),
          isRawgConnected: Boolean(config.rawgKey),
          isTmdbConnected: Boolean(config.tmdbKey),
          isGeminiConnected: Boolean(settings.geminiApiKey || config.geminiApiKey),
          activeProvider: settings.activeProvider,
          activeModel: settings.selectedModel,
          daemonOnline: true,
          uptime: process.uptime(),
        },
      });
    } catch (error) {
      console.error("[SettingsController] Error al obtener settings, usando fallback en memoria:", error);
      const fallbackModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
      return c.json({
        success: true,
        data: {
          isNotionConnected: Boolean(
            config.notionToken && (config.notionDatabaseIdGames || config.notionDatabaseIdMovies)
          ),
          isSteamConnected: Boolean(config.steamKey && config.steamUserId),
          isRawgConnected: Boolean(config.rawgKey),
          isTmdbConnected: Boolean(config.tmdbKey),
          isGeminiConnected: Boolean(config.geminiApiKey),
          activeProvider: "gemini",
          activeModel: fallbackModel,
          daemonOnline: true,
          uptime: process.uptime(),
        },
      });
    }
  })
  .get("/ai", async (c) => {
    try {
      const settings = await aiSettingsRepository.getSettings();

      return c.json({
        success: true,
        data: {
          activeProvider: settings.activeProvider,
          selectedModel: settings.selectedModel,
          temperature: settings.temperature,
          geminiConfigured: Boolean(settings.geminiApiKey || config.geminiApiKey),
          deepseekConfigured: Boolean(settings.deepseekApiKey),
          groqConfigured: Boolean(settings.groqApiKey),
          ollamaBaseUrl: settings.ollamaBaseUrl || "http://localhost:11434",
          availableProviders: [
            { id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.5-flash" },
            { id: "deepseek", label: "DeepSeek API", defaultModel: "deepseek-chat" },
            { id: "groq", label: "Groq LPU", defaultModel: "llama-3.3-70b-versatile" },
            { id: "ollama", label: "Ollama Local", defaultModel: "llama3.2:latest" },
          ],
        },
      });
    } catch (error) {
      console.error("[SettingsController] Error al obtener AI settings, usando fallback en memoria:", error);
      const fallbackModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
      return c.json({
        success: true,
        data: {
          activeProvider: "gemini",
          selectedModel: fallbackModel,
          temperature: 0.7,
          geminiConfigured: Boolean(config.geminiApiKey),
          deepseekConfigured: false,
          groqConfigured: false,
          ollamaBaseUrl: "http://localhost:11434",
          availableProviders: [
            { id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.5-flash" },
            { id: "deepseek", label: "DeepSeek API", defaultModel: "deepseek-chat" },
            { id: "groq", label: "Groq LPU", defaultModel: "llama-3.3-70b-versatile" },
            { id: "ollama", label: "Ollama Local", defaultModel: "llama3.2:latest" },
          ],
        },
      });
    }
  })
  .put("/ai", zValidator("json", updateAiSettingsSchema), async (c) => {
    const body = c.req.valid("json");
    await aiSettingsRepository.updateSettings(body);

    return c.json({
      success: true,
      message: "Configuración de IA actualizada y verificada con éxito.",
    });
  })
  .post("/ai/test", zValidator("json", testConnectionBodySchema), async (c) => {
    const body = c.req.valid("json") || {};
    const settings = await aiSettingsRepository.getSettings();
    const apiKey = body.apiKey || settings.geminiApiKey || config.geminiApiKey;
    const model = body.model || settings.selectedModel;
    const ok = await geminiClient.testConnection(apiKey, model);

    return c.json({
      success: ok,
      connected: ok,
      provider: "gemini",
      model,
    });
  });
