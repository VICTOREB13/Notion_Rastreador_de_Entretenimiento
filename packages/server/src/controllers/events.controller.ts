import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

interface SSEClient {
  id: string;
  writeSSE: (data: { event?: string; data: string; id?: string }) => Promise<void>;
}

const clients = new Set<SSEClient>();

/**
 * Emite un evento en tiempo real a todos los clientes web conectados vía Server-Sent Events.
 */
export function broadcastEvent(event: string, data?: unknown): void {
  const payload = JSON.stringify(data ?? {});
  for (const client of clients) {
    client.writeSSE({ event, data: payload }).catch(() => {
      clients.delete(client);
    });
  }
}

export function getConnectedClientsCount(): number {
  return clients.size;
}

export const eventsController = new Hono()
  .get("/", async (c) => {
  return streamSSE(c, async (stream) => {
    const clientId = Math.random().toString(36).substring(2, 10);
    const client: SSEClient = {
      id: clientId,
      writeSSE: (data) => stream.writeSSE(data),
    };
    clients.add(client);

    // Saludo inicial de conexión establecida
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({
        status: "connected",
        clientId,
        timestamp: new Date().toISOString(),
      }),
    });

    let abortResolve: () => void;
    const abortPromise = new Promise<void>((resolve) => {
      abortResolve = resolve;
    });

    const cleanup = () => {
      clearInterval(heartbeat);
      clients.delete(client);
      abortResolve?.();
    };

    // Latido periódico (keep-alive) cada 25 segundos
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: "ping",
          data: JSON.stringify({ timestamp: new Date().toISOString() }),
        });
      } catch {
        cleanup();
      }
    }, 25000);

    stream.onAbort(cleanup);

    // Mantener la conexión abierta hasta que el cliente cierre o el socket falle
    await abortPromise;
  });
});
