import { prisma } from "../client";
import type { GameSession, Game } from "@prisma/client";
import type { ISessionRepository } from "../interfaces";

export class SessionRepository implements ISessionRepository {
  async findActiveSession(): Promise<(GameSession & { game: Game }) | null> {
    return prisma.gameSession.findFirst({
      where: { isLive: true },
      include: { game: true },
      orderBy: { startedAt: "desc" },
    });
  }

  async startSession(gameId: string, steamAppId?: number, startedAt: Date = new Date()): Promise<GameSession> {
    // Cerrar cualquier sesión huérfana activa previa calculando su duración real
    const activeSessions = await prisma.gameSession.findMany({
      where: { isLive: true },
    });

    for (const orphan of activeSessions) {
      const durationMinutes = Math.max(
        1,
        Math.round((startedAt.getTime() - orphan.startedAt.getTime()) / (1000 * 60))
      );
      await prisma.gameSession.update({
        where: { id: orphan.id },
        data: {
          isLive: false,
          endedAt: startedAt,
          durationMinutes,
        },
      });
    }

    return prisma.gameSession.create({
      data: {
        gameId,
        steamAppId,
        startedAt,
        isLive: true,
      },
    });
  }

  async closeSession(sessionId: string, endedAt: Date = new Date(), durationMinutes?: number): Promise<GameSession> {
    const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new Error(`Sesión ${sessionId} no encontrada`);
    }

    const calculatedMinutes =
      durationMinutes ?? Math.max(1, Math.round((endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60)));

    return prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        endedAt,
        durationMinutes: calculatedMinutes,
        isLive: false,
      },
    });
  }

  async getRecentSessions(limit: number = 10): Promise<(GameSession & { game: Game })[]> {
    return prisma.gameSession.findMany({
      take: limit,
      orderBy: { startedAt: "desc" },
      include: { game: true },
    });
  }

  async touchSession(sessionId: string): Promise<void> {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  }

  async delete(id: string): Promise<GameSession> {
    return prisma.gameSession.delete({ where: { id } });
  }
}

export const sessionRepository = new SessionRepository();
