import { readFileSync } from "node:fs";
import {
  type ContractEndpoint,
  normalizePath,
  toCanonicalKey,
} from "./lint_contracts_helpers";

export function extractEndpointsFromNode(filePath: string, content: string): ContractEndpoint[] {
  const endpoints: ContractEndpoint[] = [];
  const lines = content.split("\n");

  const expressRegex = /(?:app|router|route|server|fastify|elysia)\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;

  const normalizedFilePath = filePath.replace(/\\/g, "/");
  const isController = normalizedFilePath.includes("/controllers/") || normalizedFilePath.endsWith(".controller.ts");
  const ctrlMatch = normalizedFilePath.match(/\/([a-zA-Z0-9_-]+)\.controller\.[jt]sx?$/);
  const honoControllerPrefix = ctrlMatch ? `/api/${ctrlMatch[1]}` : "";
  const honoChainedRegex = /^\s*\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/i;
  const commentEndpointRegex = /(?:#|\/\/|<!--)\s*@(?:spec-contract|endpoint)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let expressMatched = false;
    let match: RegExpExecArray | null;
    expressRegex.lastIndex = 0;
    while ((match = expressRegex.exec(line)) !== null) {
      expressMatched = true;
      const method = match[1].toUpperCase();
      const rawPath = match[2];
      endpoints.push({
        method,
        path: normalizePath(rawPath),
        canonical: toCanonicalKey(method, rawPath),
        raw: `${method} ${rawPath}`,
        source: filePath,
        line: i + 1,
      });
    }

    if (!expressMatched) {
      const hMatch = line.match(honoChainedRegex);
      if (hMatch) {
        const method = hMatch[1].toUpperCase();
        const sub = hMatch[2].trim();
        let fullPath = sub;
        if (isController && honoControllerPrefix) {
          fullPath = sub === "/" ? honoControllerPrefix : `${honoControllerPrefix}${sub.startsWith("/") ? sub : "/" + sub}`;
        }
        endpoints.push({
          method,
          path: normalizePath(fullPath),
          canonical: toCanonicalKey(method, fullPath),
          raw: `${method} ${fullPath}`,
          source: filePath,
          line: i + 1,
        });
      }
    }

    const cMatch = line.match(commentEndpointRegex);
    if (cMatch) {
      const method = cMatch[1].toUpperCase();
      const rawPath = cMatch[2].trim();
      endpoints.push({
        method,
        path: normalizePath(rawPath),
        canonical: toCanonicalKey(method, rawPath),
        raw: `${method} ${rawPath}`,
        source: filePath,
        line: i + 1,
      });
    }
  }

  const controllerMatch = content.match(/@Controller\s*\(\s*(?:["'`]([^"'`]+)["'`])?\s*\)/i);
  const controllerPrefix = controllerMatch && controllerMatch[1] ? controllerMatch[1].replace(/^\/?/, "/").replace(/\/+$/, "") : "";
  const nestMethodRegex = /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*(?:["'`]([^"'`]+)["'`])?\s*\)/gi;
  let nMatch: RegExpExecArray | null;
  while ((nMatch = nestMethodRegex.exec(content)) !== null) {
    const method = nMatch[1].toUpperCase();
    const subPath = nMatch[2] ? nMatch[2].replace(/^\/+/, "") : "";
    const fullPath = controllerPrefix ? `${controllerPrefix}/${subPath}`.replace(/\/+$/, "") || "/" : (subPath ? `/${subPath}` : "/");
    endpoints.push({
      method,
      path: normalizePath(fullPath),
      canonical: toCanonicalKey(method, fullPath),
      raw: `${method} ${fullPath}`,
      source: filePath,
    });
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  if (normalizedPath.includes("/api/") && (normalizedPath.endsWith("/route.ts") || normalizedPath.endsWith("/route.js"))) {
    const apiPart = normalizedPath.substring(normalizedPath.indexOf("/api/"));
    const routePath = apiPart.replace(/\/route\.[jt]sx?$/, "");
    const handlerMethodsRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;

    let hMatch: RegExpExecArray | null;
    while ((hMatch = handlerMethodsRegex.exec(content)) !== null) {
      const method = hMatch[1].toUpperCase();
      endpoints.push({
        method,
        path: normalizePath(routePath),
        canonical: toCanonicalKey(method, routePath),
        raw: `${method} ${routePath}`,
        source: filePath,
      });
    }
  }

  if (normalizedPath.includes("/pages/api/")) {
    const apiPart = normalizedPath.substring(normalizedPath.indexOf("/pages/api/") + 6);
    const routePath = apiPart.replace(/\/index\.[jt]sx?$/, "").replace(/\.[jt]sx?$/, "");
    const methodsFound = new Set<string>();
    const methodChecks = content.match(/req\.method\s*===?\s*["'`](GET|POST|PUT|PATCH|DELETE)["'`]/gi);
    if (methodChecks) {
      for (const mc of methodChecks) {
        const m = mc.match(/["'`]([A-Z]+)["'`]/i);
        if (m) methodsFound.add(m[1].toUpperCase());
      }
    }
    if (methodsFound.size === 0) methodsFound.add("GET");
    for (const method of methodsFound) {
      endpoints.push({
        method,
        path: normalizePath(routePath),
        canonical: toCanonicalKey(method, routePath),
        raw: `${method} ${routePath}`,
        source: filePath,
      });
    }
  }

  return endpoints;
}

export function extractEndpointsFromFlutter(filePath: string, content: string): ContractEndpoint[] {
  const endpoints: ContractEndpoint[] = [];
  const lines = content.split("\n");

  const clientRegex = /(?:\b(?:dio|client|http|router|app)\.|\.\.)(get|post|put|patch|delete|head)\s*(?:<[^>]+>)?\s*\(\s*(?:Uri\.parse\s*\(\s*)?["'`]([^"'`]+)["'`]/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    clientRegex.lastIndex = 0;
    while ((match = clientRegex.exec(line)) !== null) {
      const method = match[1].toUpperCase();
      let rawPath = match[2];
      if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
        try {
          rawPath = new URL(rawPath).pathname;
        } catch {
          // ignore invalid url
        }
      }
      endpoints.push({
        method,
        path: normalizePath(rawPath),
        canonical: toCanonicalKey(method, rawPath),
        raw: `${method} ${rawPath}`,
        source: filePath,
        line: i + 1,
      });
    }
  }

  return endpoints;
}

export function extractEndpointsFromLaravel(filePath: string, content: string): ContractEndpoint[] {
  const endpoints: ContractEndpoint[] = [];
  const lines = content.split("\n");
  const isApiFile = filePath.replace(/\\/g, "/").includes("routes/api.php");

  const routeRegex = /Route::(get|post|put|patch|delete|options)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  const resourceRegex = /Route::apiResource\s*\(\s*["'`]([^"'`]+)["'`]/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let match: RegExpExecArray | null;
    routeRegex.lastIndex = 0;
    while ((match = routeRegex.exec(line)) !== null) {
      const method = match[1].toUpperCase();
      let rawPath = match[2];
      if (isApiFile && !rawPath.startsWith("/api") && !rawPath.startsWith("api/")) {
        rawPath = `/api/${rawPath.replace(/^\/+/, "")}`;
      }
      endpoints.push({
        method,
        path: normalizePath(rawPath),
        canonical: toCanonicalKey(method, rawPath),
        raw: `${method} ${rawPath}`,
        source: filePath,
        line: i + 1,
      });
    }

    resourceRegex.lastIndex = 0;
    while ((match = resourceRegex.exec(line)) !== null) {
      const resource = match[1].replace(/^\/+|\/+$/g, "");
      const basePath = isApiFile ? `/api/${resource}` : `/${resource}`;
      const crud = [
        { method: "GET", path: basePath },
        { method: "POST", path: basePath },
        { method: "GET", path: `${basePath}/{param}` },
        { method: "PUT", path: `${basePath}/{param}` },
        { method: "DELETE", path: `${basePath}/{param}` },
      ];
      for (const item of crud) {
        endpoints.push({
          method: item.method,
          path: normalizePath(item.path),
          canonical: toCanonicalKey(item.method, item.path),
          raw: `${item.method} ${item.path}`,
          source: filePath,
          line: i + 1,
        });
      }
    }
  }

  return endpoints;
}

export function extractEndpointsFromPython(filePath: string, content: string): ContractEndpoint[] {
  const endpoints: ContractEndpoint[] = [];
  const lines = content.split("\n");

  const prefixMap = new Map<string, string>();
  const routerPrefixRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:APIRouter|Blueprint)\s*\([^)]*(?:prefix|url_prefix)\s*=\s*["'`]([^"'`]+)["'`]/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = routerPrefixRegex.exec(content)) !== null) {
    prefixMap.set(pMatch[1], pMatch[2].replace(/\/+$/, ""));
  }

  const fastApiRegex = /@([a-zA-Z0-9_]+)\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  const flaskRegex = /@([a-zA-Z0-9_]+)\.route\s*\(\s*["'`]([^"'`]+)["'`](?:.*methods\s*=\s*\[([^\]]+)\])?/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let match: RegExpExecArray | null;
    fastApiRegex.lastIndex = 0;
    while ((match = fastApiRegex.exec(line)) !== null) {
      const routerVar = match[1];
      const method = match[2].toUpperCase();
      let rawPath = match[3];

      if (prefixMap.has(routerVar)) {
        const prefix = prefixMap.get(routerVar)!;
        rawPath = `${prefix}/${rawPath.replace(/^\/+/, "")}`;
      }

      endpoints.push({
        method,
        path: normalizePath(rawPath),
        canonical: toCanonicalKey(method, rawPath),
        raw: `${method} ${rawPath}`,
        source: filePath,
        line: i + 1,
      });
    }

    flaskRegex.lastIndex = 0;
    while ((match = flaskRegex.exec(line)) !== null) {
      const bpVar = match[1];
      let rawPath = match[2];
      const methodsStr = match[3] || "'GET'";

      if (prefixMap.has(bpVar)) {
        const prefix = prefixMap.get(bpVar)!;
        rawPath = `${prefix}/${rawPath.replace(/^\/+/, "")}`;
      }

      const methods = methodsStr.match(/['"](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)['"]/gi) || ["GET"];
      for (const m of methods) {
        const method = m.replace(/['"]/g, "").toUpperCase();
        endpoints.push({
          method,
          path: normalizePath(rawPath),
          canonical: toCanonicalKey(method, rawPath),
          raw: `${method} ${rawPath}`,
          source: filePath,
          line: i + 1,
        });
      }
    }
  }

  return endpoints;
}

export function extractCodeEndpoints(files: string[], stack: "node" | "flutter" | "laravel" | "python"): ContractEndpoint[] {
  const allEndpoints: ContractEndpoint[] = [];
  const seen = new Set<string>();

  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, "utf-8");
      let extracted: ContractEndpoint[] = [];

      switch (stack) {
        case "flutter":
          extracted = extractEndpointsFromFlutter(filePath, content);
          break;
        case "laravel":
          extracted = extractEndpointsFromLaravel(filePath, content);
          break;
        case "python":
          extracted = extractEndpointsFromPython(filePath, content);
          break;
        case "node":
        default:
          extracted = extractEndpointsFromNode(filePath, content);
          break;
      }

      for (const ep of extracted) {
        if (!seen.has(ep.canonical)) {
          seen.add(ep.canonical);
          allEndpoints.push(ep);
        }
      }
    } catch {
      // Continue if a file is unreadable
    }
  }

  return allEndpoints;
}
