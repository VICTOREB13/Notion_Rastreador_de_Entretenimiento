"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLiveStatus,
  fetchAnalytics,
  fetchGames,
  fetchMovies,
  fetchGameDetail,
  fetchMovieDetail,
  enrichGame,
  enrichMovie,
  fetchSystemSettings,
  triggerManualSync,
  triggerBatchEnrich,
} from "./api";

export function useLiveStatusQuery() {
  return useQuery({
    queryKey: ["liveStatus"],
    queryFn: fetchLiveStatus,
    refetchInterval: 60000, // Reducido gracias a eventos SSE en tiempo real
    staleTime: 30000,
  });
}

export function useAnalyticsQuery(days = 30) {
  return useQuery({
    queryKey: ["analytics", days],
    queryFn: () => fetchAnalytics(days),
    staleTime: 120000,
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
    staleTime: 120000,
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
    staleTime: 120000,
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


function createEnrichMutation(entity: "game" | "movie", fn: (id: string, opt?: any) => Promise<any>) {
  return () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, options }: { id: string; options?: { force?: boolean; model?: string } }) => fn(id, options),
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: [entity === "game" ? "games" : "movies"] });
        queryClient.invalidateQueries({ queryKey: [entity, variables.id] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      },
    });
  };
}

export const useEnrichGameMutation = createEnrichMutation("game", enrichGame);
export const useEnrichMovieMutation = createEnrichMutation("movie", enrichMovie);

export function useSystemSettingsQuery() {
  return useQuery({
    queryKey: ["systemSettings"],
    queryFn: fetchSystemSettings,
    refetchInterval: 120000,
    staleTime: 60000,
  });
}

export function useTriggerSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerManualSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["liveStatus"] });
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    },
  });
}

export function useBatchEnrichMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options?: {
      limit?: number;
      delayMs?: number;
      targetType?: "ALL" | "GAME" | "MOVIE";
      force?: boolean;
      model?: string;
    }) => triggerBatchEnrich(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["movies"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    },
  });
}

export function useServerEvents() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/events");

        eventSource.addEventListener("connected", () => {
          setIsConnected(true);
          setLastEvent("connected");
        });

        eventSource.addEventListener("ping", () => {
          setIsConnected(true);
        });

        eventSource.addEventListener("catalog_updated", () => {
          setLastEvent("catalog_updated");
          queryClient.invalidateQueries({ queryKey: ["games"] });
          queryClient.invalidateQueries({ queryKey: ["movies"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          queryClient.invalidateQueries({ queryKey: ["liveStatus"] });
          queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
        });

        eventSource.addEventListener("live_status_updated", () => {
          setLastEvent("live_status_updated");
          queryClient.invalidateQueries({ queryKey: ["liveStatus"] });
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) eventSource.close();
    };
  }, [queryClient]);

  return { isConnected, lastEvent };
}

