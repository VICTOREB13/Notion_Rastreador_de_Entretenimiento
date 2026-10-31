import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { GET, POST } from "../src/app/api/[...path]/route";
import { NextRequest } from "next/server";

describe("Runtime API Proxy (/api/[...path]/route.ts)", () => {
  let server: ReturnType<typeof Bun.serve>;
  let upstreamPort: number;

  beforeAll(() => {
    server = Bun.serve({
      port: 0, // ephemeral port
      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/api/games") {
          return new Response(JSON.stringify({ success: true, count: 2, items: ["Cyberpunk", "Hollow Knight"] }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Custom-Upstream": "daemon-v1",
            },
          });
        }

        if (url.pathname === "/api/echo") {
          return (async () => {
            const body = await req.text();
            return new Response(JSON.stringify({ echoed: body }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          })();
        }

        if (url.pathname === "/api/events") {
          const stream = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode("data: event-1\n\n"));
              const timer = setInterval(() => {
                try {
                  controller.enqueue(encoder.encode("data: event-tick\n\n"));
                } catch {
                  clearInterval(timer);
                }
              }, 50);

              return () => {
                clearInterval(timer);
              };
            },
          });

          return new Response(stream, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache",
            },
          });
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    upstreamPort = server.port;
    process.env.INTERNAL_API_URL = `http://localhost:${upstreamPort}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  it("should buffer regular non-SSE responses into arrayBuffer and forward headers", async () => {
    const req = new NextRequest(`http://localhost:3000/api/games`);
    const context = { params: Promise.resolve({ path: ["games"] }) };

    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Custom-Upstream")).toBe("daemon-v1");

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(2);
    expect(json.items).toContain("Cyberpunk");
  });

  it("should forward request body for non-GET requests cleanly", async () => {
    const payload = JSON.stringify({ message: "hello upstream" });
    const req = new NextRequest(`http://localhost:3000/api/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const context = { params: Promise.resolve({ path: ["echo"] }) };

    const res = await POST(req, context);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.echoed).toBe(payload);
  });

  it("should proxy SSE streams and deliver event chunks with proper streaming headers", async () => {
    const req = new NextRequest(`http://localhost:3000/api/events`);
    const context = { params: Promise.resolve({ path: ["events"] }) };

    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");

    expect(res.body).toBeDefined();
    const reader = res.body!.getReader();

    const { value: firstChunk } = await reader.read();
    const text = new TextDecoder().decode(firstChunk);
    expect(text).toContain("data: event-1");

    await reader.cancel();
  });

  it("should cancel reader cleanly when client aborts during active SSE stream", async () => {
    const controller = new AbortController();
    const req = new NextRequest(`http://localhost:3000/api/events`, {
      signal: controller.signal,
    });
    const context = { params: Promise.resolve({ path: ["events"] }) };

    const res = await GET(req, context);
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const { value: firstChunk } = await reader.read();
    expect(firstChunk).toBeDefined();

    // Abort the client signal while the stream is actively running
    controller.abort();

    // Stream should cleanly terminate
    const next = await reader.read().catch(() => ({ done: true, value: undefined }));
    expect(next.done).toBe(true);
  });

  it("should return 502 Gateway Connection Error when daemon is unreachable", async () => {
    const deadPort = upstreamPort + 9999;
    process.env.INTERNAL_API_URL = `http://127.0.0.1:${deadPort}`;

    const req = new NextRequest(`http://localhost:3000/api/games`);
    const context = { params: Promise.resolve({ path: ["games"] }) };

    const res = await GET(req, context);
    expect(res.status).toBe(502);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Gateway connection error to daemon backend");
    expect(json.targetUrl).toContain(String(deadPort));

    // Restore URL
    process.env.INTERNAL_API_URL = `http://localhost:${upstreamPort}`;
  });
});
