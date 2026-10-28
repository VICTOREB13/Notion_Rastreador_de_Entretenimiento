import { prisma } from "../client";
import type { AiSettings, Prisma } from "@prisma/client";
import type { IAiSettingsRepository } from "../interfaces";

export class AiSettingsRepository implements IAiSettingsRepository {
  async getSettings(): Promise<AiSettings> {
    let settings = await prisma.aiSettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await prisma.aiSettings.create({
        data: {
          id: "default",
          activeProvider: "gemini",
          selectedModel: "gemini-2.5-flash",
          temperature: 0.7,
        },
      });
    }
    return settings;
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
