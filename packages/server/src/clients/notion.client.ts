import type { INotionSyncClient, NotionPageDelta } from "@repo/database";
import { config } from "../config";

export class NotionClient implements INotionSyncClient {
  private token: string;
  private baseUrl = "https://api.notion.com/v1";

  constructor(token?: string) {
    this.token = token ?? config.notionToken;
  }

  private get headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };
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
    if (!this.token) {
      console.warn("[NotionClient] NOTION_TOKEN is not configured. Returning empty array.");
      return [];
    }

    const url = `${this.baseUrl}/databases/${databaseId}/query`;
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

      const res = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
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
    if (!this.token) {
      throw new Error("NOTION_TOKEN is required to create Notion pages");
    }

    const payload: Record<string, unknown> = {
      parent: { database_id: databaseId },
      properties,
    };
    if (cover) payload.cover = cover;
    if (icon) payload.icon = icon;

    const res = await fetch(`${this.baseUrl}/pages`, {
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

    const res = await fetch(`${this.baseUrl}/pages/${pageId}`, {
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
