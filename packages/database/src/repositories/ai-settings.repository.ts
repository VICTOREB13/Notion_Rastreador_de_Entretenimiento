import { prisma } from "../client";
import type { AiSettings, Prisma } from "@prisma/client";
import type { IAiSettingsRepository } from "../interfaces";
import { cleanAiModelName } from "../utils/normalizer";

export class AiSettingsRepository implements IAiSettingsRepository {
  async getSettings(): Promise<AiSettings> {
    const rawEnv = process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL;
    const envModel = cleanAiModelName(rawEnv);
    const defaultModel = envModel || "gemini-2.5-flash";
    return await prisma.aiSettings.upsert({
      where: { id: "default" },
      update: envModel ? { selectedModel: envModel } : {},
      create: {
        id: "default",
        activeProvider: "gemini",
        selectedModel: defaultModel,
        temperature: 0.35,
      },
    });
  }

  async updateSettings(data: Prisma.AiSettingsUpdateInput): Promise<AiSettings> {
    const selectedModel =
      typeof data.selectedModel === "string"
        ? cleanAiModelName(data.selectedModel)
        : undefined;
    const updatedData = selectedModel ? { ...data, selectedModel } : data;

    return prisma.aiSettings.upsert({
      where: { id: "default" },
      update: updatedData,
      create: {
        id: "default",
        activeProvider: (data.activeProvider as string) ?? "gemini",
        selectedModel: selectedModel ?? "gemini-2.5-flash",
        temperature: (data.temperature as number) ?? 0.35,
        geminiApiKey: data.geminiApiKey as string | undefined,
        deepseekApiKey: data.deepseekApiKey as string | undefined,
        groqApiKey: data.groqApiKey as string | undefined,
        ollamaBaseUrl: data.ollamaBaseUrl as string | undefined,
      },
    });
  }
}

export const aiSettingsRepository = new AiSettingsRepository();
