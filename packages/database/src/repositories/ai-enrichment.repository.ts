import { prisma } from "../client";
import type { AiEnrichment, Prisma } from "@prisma/client";
import type { IAiEnrichmentRepository, AiEnrichmentResult } from "../interfaces";

export class AiEnrichmentRepository implements IAiEnrichmentRepository {
  async findByTarget(targetType: string, targetId: string): Promise<AiEnrichment | null> {
    return prisma.aiEnrichment.findUnique({
      where: {
        targetType_targetId: {
          targetType,
          targetId,
        },
      },
    });
  }

  async findManyByTargets(
    targetType: string,
    targetIds: string[]
  ): Promise<Map<string, AiEnrichmentResult>> {
    if (!targetIds || targetIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.aiEnrichment.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
      },
    });

    const resultMap = new Map<string, AiEnrichmentResult>();
    for (const raw of rows) {
      let vibeTags: string[] = [];
      let thematicTropes: string[] = [];
      try {
        vibeTags = JSON.parse(raw.vibeTags || "[]");
      } catch {
        vibeTags = [];
      }
      try {
        thematicTropes = JSON.parse(raw.thematicTropes || "[]");
      } catch {
        thematicTropes = [];
      }

      resultMap.set(raw.targetId, {
        vibeTags,
        personalizedPitch: raw.personalizedPitch,
        thematicTropes,
        completionEstimateWeeks: raw.completionEstimateWeeks ?? undefined,
        rawResponse: raw.rawResponse ?? undefined,
      });
    }

    return resultMap;
  }

  async getParsedEnrichment(targetType: string, targetId: string): Promise<AiEnrichmentResult | null> {
    const raw = await this.findByTarget(targetType, targetId);
    if (!raw) return null;

    let vibeTags: string[] = [];
    let thematicTropes: string[] = [];
    try {
      vibeTags = JSON.parse(raw.vibeTags);
    } catch {
      vibeTags = [];
    }
    try {
      thematicTropes = JSON.parse(raw.thematicTropes);
    } catch {
      thematicTropes = [];
    }

    return {
      vibeTags,
      personalizedPitch: raw.personalizedPitch,
      thematicTropes,
      completionEstimateWeeks: raw.completionEstimateWeeks ?? undefined,
      rawResponse: raw.rawResponse ?? undefined,
    };
  }

  async upsert(data: Prisma.AiEnrichmentCreateInput): Promise<AiEnrichment> {
    return prisma.aiEnrichment.upsert({
      where: {
        targetType_targetId: {
          targetType: data.targetType,
          targetId: data.targetId,
        },
      },
      update: {
        vibeTags: data.vibeTags,
        personalizedPitch: data.personalizedPitch,
        thematicTropes: data.thematicTropes,
        completionEstimateWeeks: data.completionEstimateWeeks,
        provider: data.provider,
        modelUsed: data.modelUsed,
        rawResponse: data.rawResponse,
      },
      create: data,
    });
  }
}

export const aiEnrichmentRepository = new AiEnrichmentRepository();
