import type { ISteamClient, SteamOwnedGame, SteamPlayerSummary, SteamStoreDetails } from "@repo/database";
import { config } from "../config";

export class SteamClient implements ISteamClient {
  private apiKey: string;
  private baseUrl = "https://api.steampowered.com";
  private storeUrl = "https://store.steampowered.com/api";

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? config.steamKey;
  }

  async getPlayerSummary(steamId: string): Promise<SteamPlayerSummary> {
    if (!this.apiKey || !steamId) {
      return {
        steamId: steamId || "",
        personaName: "Offline",
        isPlaying: false,
      };
    }

    try {
      const url = `${this.baseUrl}/ISteamUser/GetPlayerSummaries/v0002/?key=${this.apiKey}&steamids=${steamId}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Steam GetPlayerSummaries returned status ${res.status}`);
      }

      const data = (await res.json()) as {
        response?: {
          players?: Array<{
            steamid: string;
            personaname: string;
            gameid?: string;
            gameextrainfo?: string;
          }>;
        };
      };

      const player = data.response?.players?.[0];
      if (!player) {
        return {
          steamId,
          personaName: "Unknown",
          isPlaying: false,
        };
      }

      const gameId = player.gameid ? Number(player.gameid) : undefined;

      return {
        steamId: player.steamid,
        personaName: player.personaname,
        isPlaying: Boolean(gameId),
        gameId,
        gameExtraInfo: player.gameextrainfo,
      };
    } catch (error) {
      console.warn(`[SteamClient] getPlayerSummary error:`, error);
      return {
        steamId,
        personaName: "Error",
        isPlaying: false,
        isError: true,
      };
    }
  }

  async getOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
    if (!this.apiKey || !steamId) {
      return [];
    }

    try {
      const url = `${this.baseUrl}/IPlayerService/GetOwnedGames/v0001/?key=${this.apiKey}&steamid=${steamId}&include_appinfo=1&format=json`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Steam GetOwnedGames returned status ${res.status}`);
      }

      const data = (await res.json()) as {
        response?: {
          games?: Array<{
            appid: number;
            name: string;
            playtime_forever: number;
            img_icon_url?: string;
          }>;
        };
      };

      const games = data.response?.games || [];
      return games.map((g) => ({
        appId: g.appid,
        name: g.name,
        playtimeMinutes: g.playtime_forever,
        imgIconUrl: g.img_icon_url,
      }));
    } catch (error) {
      console.warn(`[SteamClient] getOwnedGames error:`, error);
      return [];
    }
  }

  async getAppDetails(appId: number): Promise<SteamStoreDetails | null> {
    try {
      const url = `${this.storeUrl}/appdetails?appids=${appId}&l=spanish`;
      const res = await fetch(url);
      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as Record<string, {
        success?: boolean;
        data?: {
          name?: string;
          header_image?: string;
          genres?: Array<{ description: string }>;
          short_description?: string;
        };
      }>;

      const appData = data[String(appId)];
      if (!appData || !appData.success || !appData.data) {
        return null;
      }

      const details = appData.data;
      return {
        appId,
        name: details.name || `App ${appId}`,
        headerImage: details.header_image || "",
        genres: (details.genres || []).map((g) => g.description),
        shortDescription: details.short_description,
      };
    } catch (error) {
      console.warn(`[SteamClient] getAppDetails error for appId ${appId}:`, error);
      return null;
    }
  }
}

export const steamClient = new SteamClient();
