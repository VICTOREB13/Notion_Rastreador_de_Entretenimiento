import type {
  GameSession,
  Game,
  ISessionRepository,
  IDailyPlaytimeRepository,
  IGameRepository,
} from "@repo/database";
import {
  sessionRepository,
  dailyPlaytimeRepository,
  gameRepository,
  formatLocalDate,
} from "@repo/database";

export class PlaytimeTrackerService {
  constructor(
    private sessionRepo: ISessionRepository = sessionRepository,
    private dailyRepo: IDailyPlaytimeRepository = dailyPlaytimeRepository,
    private gameRepo: IGameRepository = gameRepository
  ) {}

  /**
   * Cierra una sesión de juego activa, calcula su duración real en minutos,
   * actualiza las horas acumuladas del juego y agrega los minutos en DailyPlaytime
   * normalizado a la zona horaria local.
   */
  async closeActiveSession(
    session: GameSession & { game?: Game },
    endedAt: Date = new Date()
  ): Promise<GameSession> {
    const safeEndedAt = endedAt.getTime() >= session.startedAt.getTime() ? endedAt : session.startedAt;
    const durationMinutes = Math.max(
      1,
      Math.round((safeEndedAt.getTime() - session.startedAt.getTime()) / (1000 * 60))
    );

    const closed = await this.sessionRepo.closeSession(session.id, safeEndedAt, durationMinutes);

    // Actualizar horas totales en el juego
    const game = session.game ?? (await this.gameRepo.findById(session.gameId));
    if (game) {
      const addedHours = durationMinutes / 60;
      const updatedTotalHours = Number((game.playtimeForever + addedHours).toFixed(2));
      await this.gameRepo.updatePlaytime(game.id, updatedTotalHours);

      // Si el juego estaba en "Por Jugar", promoverlo a "Jugando"
      if (game.status === "Por Jugar") {
        await this.gameRepo.updateStatus(game.id, "Jugando");
      }
    }

    // Registrar en serie de tiempo diaria normalizada a la zona horaria local
    const dateStr = formatLocalDate(safeEndedAt);
    await this.dailyRepo.recordPlaytime(dateStr, session.gameId, durationMinutes);

    return closed;
  }

  /**
   * Calcula la racha actual de días consecutivos con tiempo de juego registrado
   * evaluando los días calendario locales.
   */
  calculateStreak(timeSeries: { date: string; hours: number }[]): number {
    if (!timeSeries.length) return 0;

    // Fechas únicas con tiempo de juego > 0
    const activeDates = new Set(
      timeSeries.filter((d) => d.hours > 0).map((d) => d.date)
    );

    if (activeDates.size === 0) return 0;

    let streak = 0;
    const checkDate = new Date();

    // Comprobar hoy en fecha local
    let dateStr = formatLocalDate(checkDate);
    if (!activeDates.has(dateStr)) {
      // Si hoy no se ha jugado aún, comprobar si ayer se jugó
      checkDate.setDate(checkDate.getDate() - 1);
      dateStr = formatLocalDate(checkDate);
      if (!activeDates.has(dateStr)) {
        return 0;
      }
    }

    // Contar días consecutivos hacia atrás
    while (activeDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      dateStr = formatLocalDate(checkDate);
    }

    return streak;
  }
}

export const playtimeTrackerService = new PlaytimeTrackerService();
