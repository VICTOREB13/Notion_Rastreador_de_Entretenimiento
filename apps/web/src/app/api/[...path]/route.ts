import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dynamic Runtime Catch-All Reverse Proxy for Next.js 16.
 * Resolves upstream backend at runtime via INTERNAL_API_URL or defaults to daemon container.
 * Eliminates build-time static rewrites and Docker ECONNREFUSED issues.
 * Supports streaming and Server-Sent Events (SSE) for /api/events.
 */
async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const rawBase = process.env.INTERNAL_API_URL || "http://daemon-api:3001";
  const targetBase = rawBase.replace(/\/+$/, "");
  const search = request.nextUrl.search;
  const subPath = Array.isArray(path) ? path.join("/") : "";
  const targetUrl = `${targetBase}/api/${subPath}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower !== "host" && lower !== "content-length") {
      headers.set(key, value);
    }
  });

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method,
      headers,
      body,
      // @ts-ignore - Node fetch duplex flag for streaming bodies
      duplex: "half",
      cache: "no-store",
    });

    const contentType = upstreamRes.headers.get("content-type") || "";
    const isSSE = contentType.includes("text/event-stream");

    const responseHeaders = new Headers();
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower !== "content-encoding") {
        responseHeaders.set(key, val);
      }
    });

    if (isSSE) {
      responseHeaders.set("Content-Type", "text/event-stream");
      responseHeaders.set("Cache-Control", "no-cache, no-transform");
      responseHeaders.set("Connection", "keep-alive");
      responseHeaders.set("X-Accel-Buffering", "no");
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Gateway connection error to daemon backend",
        targetUrl,
        details: error?.message || String(error),
      },
      { status: 502 }
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
