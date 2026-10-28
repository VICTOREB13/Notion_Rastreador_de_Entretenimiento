"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLiveStatus,
  fetchAnalytics,
  fetchGames,
  fetchMovies,
  fetchGameDetail,
  fetchMovieDetail,
  fetchAiSettings,
  updateAiSettings,
  testAiConnection,
  enrichGame,
  enrichMovie,
} from "./api";

export function useLiveStatusQuery() {
  return useQuery({
    queryKey: ["liveStatus"],
    queryFn: fetchLiveStatus,
    refetchInterval: 15000, // Refrescar estado en vivo cada 15s
  });
}

export function useAnalyticsQuery(days = 30) {
  return useQuery({
    queryKey: ["analytics", days],
    queryFn: () => fetchAnalytics(days),
    staleTime: 60000,
  });
}

export function useGamesQuery(params: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: ["games", params],
    queryFn: () => fetchGames(params),
    staleTime: 30000,
  });
}

export function useMoviesQuery(params: {
  status?: string;
  search?: string;
  year?: number;
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: ["movies", params],
    queryFn: () => fetchMovies(params),
    staleTime: 30000,
  });
}

export function useGameDetailQuery(id: string | null) {
  return useQuery({
    queryKey: ["game", id],
    queryFn: () => (id ? fetchGameDetail(id) : null),
    enabled: Boolean(id),
  });
}

export function useMovieDetailQuery(id: string | null) {
  return useQuery({
    queryKey: ["movie", id],
    queryFn: () => (id ? fetchMovieDetail(id) : null),
    enabled: Boolean(id),
  });
}

export function useAiSettingsQuery() {
  return useQuery({
    queryKey: ["aiSettings"],
    queryFn: fetchAiSettings,
  });
}

export function useUpdateAiSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAiSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiSettings"] });
    },
  });
}

export function useTestAiConnectionMutation() {
  return useMutation({
    mutationFn: testAiConnection,
  });
}

export function useEnrichGameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, options }: { id: string; options?: { force?: boolean; model?: string } }) =>
      enrichGame(id, options),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["game", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useEnrichMovieMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, options }: { id: string; options?: { force?: boolean; model?: string } }) =>
      enrichMovie(id, options),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["movie", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
