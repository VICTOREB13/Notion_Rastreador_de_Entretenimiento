import { prisma } from "../client";
import type { AiSettings, Prisma } from "@prisma/client";
import type { IAiSettingsRepository } from "../interfaces";

export class AiSettingsRepository implements IAiSettingsRepository {
  async getSettings(): Promise<AiSettings> {
    const envModel = process.env.GEMINI_MODEL?.trim();
    const defaultModel = envModel || "gemini-2.5-flash";
    return await prisma.aiSettings.upsert({
      where: { id: "default" },
      update: envModel ? { selectedModel: envModel } : {},
      create: {
        id: "default",
        activeProvider: "gemini",
        selectedModel: defaultModel,
        temperature: 0.7,
      },
    });
  }

  async updateSettings(data: Prisma.AiSettingsUpdateInput): Promise<AiSettings> {
    return prisma.aiSettings.upsert({
      where: { id: "default" },
      update: data,
      create: {
        id: "default",
        activeProvider: (data.activeProvider as string) ?? "gemini",
        selectedModel: (data.selectedModel as string) ?? "gemini-2.5-flash",
        temperature: (data.temperature as number) ?? 0.7,
        geminiApiKey: data.geminiApiKey as string | undefined,
        deepseekApiKey: data.deepseekApiKey as string | undefined,
        groqApiKey: data.groqApiKey as string | undefined,
        ollamaBaseUrl: data.ollamaBaseUrl as string | undefined,
      },
    });
  }
}

export const aiSettingsRepository = new AiSettingsRepository();
