import { prisma } from "../client";
import type { DailyPlaytime } from "@prisma/client";
import type { IDailyPlaytimeRepository } from "../interfaces";
import { formatLocalDate } from "../utils/normalizer";

export class DailyPlaytimeRepository implements IDailyPlaytimeRepository {
  async recordPlaytime(date: string, gameId: string, additionalMinutes: number): Promise<DailyPlaytime> {
    const normalizedDate = date.slice(0, 10);

    return prisma.dailyPlaytime.upsert({
      where: {
        date_gameId: {
          date: normalizedDate,
          gameId,
        },
      },
      update: {
        minutes: { increment: additionalMinutes },
      },
      create: {
        date: normalizedDate,
        gameId,
        minutes: additionalMinutes,
      },
    });
  }

  async getTimeSeries(days: number = 30): Promise<{ date: string; hours: number }[]> {
    const validDays = Math.max(1, days);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - validDays);
    const cutoffStr = formatLocalDate(cutoffDate);

    const records = await prisma.dailyPlaytime.findMany({
      where: {
        date: { gte: cutoffStr },
      },
      orderBy: { date: "asc" },
    });

    // Agrupar por fecha preservando orden
    const byDate = new Map<string, number>();
    for (const r of records) {
      const current = byDate.get(r.date) ?? 0;
      byDate.set(r.date, current + r.minutes);
    }

    const result: { date: string; hours: number }[] = [];
    for (const [date, minutes] of byDate.entries()) {
      result.push({
        date,
        hours: Number((minutes / 60).toFixed(2)),
      });
    }

    return result;
  }
}

export const dailyPlaytimeRepository = new DailyPlaytimeRepository();
