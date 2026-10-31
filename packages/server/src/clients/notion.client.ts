import type { INotionSyncClient, NotionPageDelta } from "@repo/database";
import { cleanNotionDatabaseId, cleanNotionToken } from "@repo/database";
import { config } from "../config";

export class NotionClient implements INotionSyncClient {
  private token: string;
  private baseUrl = "https://api.notion.com/v1";

  constructor(token?: string) {
    this.token = cleanNotionToken(token ?? config.notionToken);
  }

  setToken(token: string): void {
    this.token = cleanNotionToken(token);
  }

  private get headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };
  }

  /**
   * Ejecuta peticiones HTTP a Notion con control de timeout (15s), reintentos automáticos
   * ante 429 (Rate Limit) o caídas de socket transitorias (UND_ERR_SOCKET).
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 2
  ): Promise<Response> {
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeoutSignal = AbortSignal.timeout(15000);
        const combinedSignal =
          options.signal && typeof (AbortSignal as any).any === "function"
            ? (AbortSignal as any).any([options.signal, timeoutSignal])
            : timeoutSignal;

        const res = await fetch(url, {
          ...options,
          signal: combinedSignal,
        });

        if (res.status === 429 && attempt < retries) {
          const retryAfterSec = Number(res.headers.get("Retry-After")) || 1;
          await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
          continue;
        }

        return res;
      } catch (err: any) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  async fetchModifiedPages(databaseId: string, lastEditedAfter: Date): Promise<NotionPageDelta[]> {
    return this.queryDatabase(databaseId, {
      timestamp: "last_edited_time",
      last_edited_time: {
        after: lastEditedAfter.toISOString(),
      },
    });
  }

  async fetchAllPages(databaseId: string): Promise<NotionPageDelta[]> {
    return this.queryDatabase(databaseId);
  }

  async queryDatabase(databaseId: string, filter?: Record<string, unknown>): Promise<NotionPageDelta[]> {
    const cleanId = cleanNotionDatabaseId(databaseId);
    if (!this.token) {
      console.warn("[NotionClient] NOTION_TOKEN is not configured. Returning empty array.");
      return [];
    }
    if (!cleanId) {
      console.warn("[NotionClient] Database ID is empty or invalid. Returning empty array.");
      return [];
    }

    const url = `${this.baseUrl}/databases/${cleanId}/query`;
    const results: NotionPageDelta[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const payload: Record<string, unknown> = {
        page_size: 100,
      };

      if (filter) {
        payload.filter = filter;
      }

      if (startCursor) {
        payload.start_cursor = startCursor;
      }

      const res = await this.fetchWithRetry(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 401) {
          throw new Error(
            `Notion API error (401 Unauthorized): NOTION_TOKEN inválido o no reconocido por Notion. Verifique la clave secreta.`
          );
        }
        if (res.status === 404) {
          throw new Error(
            `Notion API error (404 Not Found): Base de datos '${cleanId}' no encontrada. Asegúrese de haber compartido la base de datos con la integración (Menú '...' > Conexiones > Agregar conexión).`
          );
        }
        throw new Error(`Notion API query error (${res.status}): ${errorText}`);
      }

      const data = (await res.json()) as {
        results?: Array<{
          id: string;
          last_edited_time: string;
          properties: Record<string, unknown>;
          archived?: boolean;
          in_trash?: boolean;
          cover?: unknown;
          icon?: unknown;
        }>;
        has_more?: boolean;
        next_cursor?: string | null;
      };

      for (const page of data.results || []) {
        results.push({
          id: page.id,
          lastEditedTime: page.last_edited_time,
          properties: page.properties,
          archived: page.archived === true || page.in_trash === true,
          cover: page.cover,
          icon: page.icon,
        });
      }

      hasMore = Boolean(data.has_more && data.next_cursor);
      startCursor = data.next_cursor || undefined;
    }

    return results;
  }

  async createPage(
    databaseId: string,
    properties: Record<string, unknown>,
    cover?: unknown,
    icon?: unknown
  ): Promise<string> {
    const cleanId = cleanNotionDatabaseId(databaseId);
    if (!this.token) {
      throw new Error("NOTION_TOKEN is required to create Notion pages");
    }

    const payload: Record<string, unknown> = {
      parent: { database_id: cleanId },
      properties,
    };
    if (cover) payload.cover = cover;
    if (icon) payload.icon = icon;

    const res = await this.fetchWithRetry(`${this.baseUrl}/pages`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Notion API createPage error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async updatePage(
    pageId: string,
    payload: {
      properties?: Record<string, unknown>;
      cover?: unknown;
      icon?: unknown;
    }
  ): Promise<void> {
    if (!this.token) {
      throw new Error("NOTION_TOKEN is required to update Notion pages");
    }

    const res = await this.fetchWithRetry(`${this.baseUrl}/pages/${pageId}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Notion API updatePage error (${res.status}): ${errorText}`);
    }
  }

  async updatePageProperties(pageId: string, properties: Record<string, unknown>): Promise<void> {
    return this.updatePage(pageId, { properties });
  }
}

export const notionClient = new NotionClient();

