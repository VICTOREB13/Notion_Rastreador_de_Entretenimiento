import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dynamic Runtime Catch-All Reverse Proxy for Next.js 16.
 * Resolves upstream backend at runtime via INTERNAL_API_URL or defaults to daemon container.
 * Eliminates build-time static rewrites and Docker ECONNREFUSED issues.
 * Supports streaming and Server-Sent Events (SSE) for /api/events.
 */
const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = (await context.params) || {};
  const rawBase =
    (process.env.INTERNAL_API_URL && process.env.INTERNAL_API_URL.trim()) ||
    "http://127.0.0.1:3001";
  const targetBase = rawBase.replace(/\/+$/, "");
  const search = request.nextUrl ? request.nextUrl.search : new URL(request.url).search;
  const subPath = Array.isArray(path)
    ? path.filter(Boolean).join("/")
    : typeof path === "string" && path
    ? path
    : "";
  const targetUrl = `${targetBase}/api${subPath ? `/${subPath}` : ""}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower)) {
      headers.set(key, value);
    }
  });

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  let body: ArrayBuffer | undefined = undefined;
  if (hasBody) {
    try {
      const buf = await request.arrayBuffer();
      if (buf && buf.byteLength > 0) {
        body = buf;
      }
    } catch {
      // Body may be absent or empty
    }
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method,
      headers,
      body,
      // @ts-ignore - Node fetch duplex flag for streaming bodies
      duplex: body ? "half" : undefined,
      cache: "no-store",
      signal: request.signal,
    });

    const contentType = upstreamRes.headers.get("content-type") || "";
    const isSSE = contentType.includes("text/event-stream");

    const responseHeaders = new Headers();
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (
        lower !== "content-encoding" &&
        lower !== "content-length" &&
        lower !== "transfer-encoding" &&
        lower !== "connection"
      ) {
        responseHeaders.set(key, val);
      }
    });

    if (isSSE) {
      responseHeaders.set("Content-Type", "text/event-stream");
      responseHeaders.set("Cache-Control", "no-cache, no-transform");
      responseHeaders.set("X-Accel-Buffering", "no");

      if (upstreamRes.body) {
        const reader = upstreamRes.body.getReader();
        const stream = new ReadableStream({
          start(controller) {
            const cleanup = () => {
              request.signal.removeEventListener("abort", onAbort);
            };

            const onAbort = () => {
              cleanup();
              reader.cancel().catch(() => {});
              try {
                controller.close();
              } catch {}
            };

            if (request.signal.aborted) {
              onAbort();
              return;
            }

            request.signal.addEventListener("abort", onAbort, { once: true });

            function pump() {
              reader
                .read()
                .then(({ done, value }) => {
                  if (done) {
                    cleanup();
                    try {
                      controller.close();
                    } catch {}
                    return;
                  }
                  controller.enqueue(value);
                  pump();
                })
                .catch((_err) => {
                  cleanup();
                  // En SSE, cuando el socket se cierra o hay desconexión remota,
                  // cerrar el stream limpiamente sin invocar controller.error()
                  // para evitar "failed to pipe response" en el runtime de Next.js.
                  try {
                    controller.close();
                  } catch {}
                });
            }
            pump();
          },
          cancel() {
            reader.cancel().catch(() => {});
          },
        });

        return new Response(stream, {
          status: upstreamRes.status,
          headers: responseHeaders,
        });
      }

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    const buffer = await upstreamRes.arrayBuffer();
    return new Response(buffer, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    if (request.signal?.aborted || error?.name === "AbortError") {
      return new Response(null, { status: 499, statusText: "Client Closed Request" });
    }
    const isSocketTerminated =
      error?.code === "UND_ERR_SOCKET" ||
      error?.cause?.code === "UND_ERR_SOCKET" ||
      error?.message?.includes("terminated") ||
      error?.cause?.message?.includes("terminated") ||
      error?.message?.includes("other side closed") ||
      error?.cause?.message?.includes("other side closed") ||
      error?.cause?.name === "SocketError";

    if (isSocketTerminated) {
      return new Response(null, { status: 204 });
    }
    return NextResponse.json(
      {
        success: false,
        error: "Gateway connection error to daemon backend",
        targetUrl,
        details: error?.message || String(error),
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}


export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
