export interface AIEnrichmentData {
  vibeTags: string[];
  personalizedPitch: string;
  thematicTropes: string[];
  completionEstimateWeeks?: number;
  rawResponse?: string;
}

export interface GameItem {
  id: string;
  notionPageId: string;
  title: string;
  cleanTitle: string;
  steamAppId: number | null;
  playtimeForever: number;
  playtimeNotion: number;
  hltbMain: number | null;
  hltbCompletionist: number | null;
  coverUrl: string | null;
  genres: string[];
  link: string | null;
  platform: string;
  status: string;
  startDate: string | null;
  lastPlayedAt?: string | null;
  completedAt?: string | null;
  completionDate?: string | null;
  rating?: number | null;
  userNotes?: string | null;
  personalSummary?: string | null;
  summary?: string | null;
  notionGenres?: string[];
  lastSyncAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  aiEnrichment?: AIEnrichmentData | null;
}

export interface MovieItem {
  id: string;
  notionPageId: string;
  title: string;
  cleanTitle: string;
  tmdbId: number | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
  wikiUrl: string | null;
  status: string;
  year: number | null;
  lastPlayedAt?: string | null;
  completedAt?: string | null;
  completionDate?: string | null;
  rating?: number | null;
  summary?: string | null;
  lastSyncAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  aiEnrichment?: AIEnrichmentData | null;
}

export interface LiveStatusGame {
  id: string;
  title: string;
  steamAppId: number;
  coverUrl: string | null;
  sessionStartedAt: string;
  sessionMinutes: number;
}

export interface LiveDebounceStatus {
  inGracePeriod: boolean;
  gracePeriodRemainingSeconds: number;
}

export interface LiveSteamStatus {
  isPlaying: boolean;
  game: LiveStatusGame | null;
  debounceStatus: LiveDebounceStatus;
}

export interface DailyPlaytimePoint {
  date: string;
  hours: number;
}

export interface AnalyticsSummary {
  totalGames: number;
  totalPlaytimeHours: number;
  completedGames: number;
  completionRate: number;
  totalMovies: number;
  watchedMovies: number;
  estimatedWatchTimeHours?: number;
  movieCompletionRate?: number;
  currentStreakDays: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  recentSessions: Array<{
    id: string;
    gameTitle: string;
    coverUrl: string | null;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number;
    isLive: boolean;
  }>;
  timeSeries: DailyPlaytimePoint[];
  topGames: Array<{
    id: string;
    title: string;
    hours: number;
    coverUrl: string | null;
  }>;
  genreDistribution: Array<{
    genre: string;
    count: number;
  }>;
}

