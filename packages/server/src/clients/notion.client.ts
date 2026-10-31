import type { INotionSyncClient, NotionPageDelta } from "@repo/database";
import { cleanNotionDatabaseId, cleanNotionToken } from "@repo/database";
import { config } from "../config";

export class NotionClient implements INotionSyncClient {
  private token: string;
  private baseUrl = "https://api.notion.com/v1";
  private resolvedDbCache = new Map<string, string>();

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

  async queryDatabase(
    databaseId: string,
    filter?: Record<string, unknown>,
    retryWithResolved = true
  ): Promise<NotionPageDelta[]> {
    const rawCleanId = cleanNotionDatabaseId(databaseId);
    const cleanId = this.resolvedDbCache.get(rawCleanId) || rawCleanId;
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
        if (res.status === 400 && errorText.includes("is a page, not a database") && retryWithResolved) {
          console.warn(
            `[NotionClient] El ID '${cleanId}' corresponde a una Página contenedora, no a una Base de Datos. Intentando auto-resolver la base de datos interna...`
          );
          const resolved = await this.resolvePageToDatabase(cleanId);
          if (resolved) {
            this.resolvedDbCache.set(rawCleanId, resolved);
            this.resolvedDbCache.set(cleanId, resolved);
            return this.queryDatabase(resolved, filter, false);
          }
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

  /**
   * Inspecciona una página de Notion para extraer automáticamente el ID de la base de datos hija (child_database),
   * o lista las bases de datos accesibles mediante la API de búsqueda si no es directa.
   */
  async resolvePageToDatabase(pageId: string): Promise<string | null> {
    try {
      const blocksUrl = `${this.baseUrl}/blocks/${pageId}/children?page_size=100`;
      const blocksRes = await this.fetchWithRetry(blocksUrl, {
        headers: this.headers,
      });

      if (blocksRes.ok) {
        const blocksData = (await blocksRes.json()) as {
          results?: Array<{ id: string; type: string; child_database?: { title: string } }>;
        };
        const childDbs = (blocksData.results || []).filter((b) => b.type === "child_database");

        if (childDbs.length > 0) {
          const matched = childDbs[0];
          const dbTitle = matched.child_database?.title || "Sin título";
          console.log(
            `[NotionClient] ✅ Base de datos encontrada dentro de la página '${pageId}': "${dbTitle}" (ID: ${matched.id}). Auto-resolviendo conexión.`
          );
          return matched.id;
        }
      }

      // Si no se encontró child_database directo, buscar bases de datos compartidas con la integración
      console.log(`[NotionClient] Consultando bases de datos autorizadas en el espacio de Notion...`);
      const searchRes = await this.fetchWithRetry(`${this.baseUrl}/search`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          filter: { value: "database", property: "object" },
          page_size: 20,
        }),
      });

      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          results?: Array<{ id: string; title?: Array<{ plain_text: string }> }>;
        };
        const dbs = (searchData.results || []).map((d) => ({
          id: d.id,
          title: (d.title || []).map((t) => t.plain_text).join("") || "Sin título",
        }));
        if (dbs.length > 0) {
          console.warn(
            `[NotionClient] ℹ️ Bases de datos encontradas en tu Notion compartidas con la integración:\n` +
              dbs.map((d) => `  - "${d.title}": ID ${d.id}`).join("\n")
          );
          // Si encontramos exactamente una o la primera
          return dbs[0].id;
        }
      }
    } catch (err) {
      console.warn(`[NotionClient] No se pudo resolver automáticamente la página a base de datos:`, err);
    }
    return null;
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

