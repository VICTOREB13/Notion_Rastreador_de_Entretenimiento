import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

export interface ContractEndpoint {
  method: string;
  path: string;
  canonical: string;
  raw: string;
  source?: string;
  line?: number;
}

export interface LintContractsOptions {
  specFile?: string;
  srcDirs?: string[];
  stack?: "node" | "flutter" | "laravel" | "python" | "auto";
  slice?: string;
  json?: boolean;
  allowMissing?: boolean;
  allowOrphans?: boolean;
  allowEmpty?: boolean;
}

export interface LintContractsResult {
  valid: boolean;
  contracts: string[];
  codeEndpoints: string[];
  missing: string[];
  orphans: string[];
  scannedFilesCount: number;
  stackDetected: string;
  summary: string;
}

export function normalizePath(rawPath: string): string {
  let p = rawPath.trim().replace(/^[`'"]+|[`'"]+$/g, "").trim().split("?")[0].split("#")[0];
  if (!p.startsWith("/")) p = "/" + p;
  // Replace {param}, {param:type} (FastAPI / OpenAPI) FIRST so :type is not mistaken for :param
  p = p.replace(/\{[^{}]+\}/g, "{param}");
  // Replace <param>, <type:param> (Flask)
  p = p.replace(/<[^<>]+>/g, "{param}");
  // Replace [param], [...param], [[...param]] (Next.js)
  p = p.replace(/\[{1,2}[^\[\]]+\]{1,2}/g, "{param}");
  // Replace :param, :param?, :param(regex) (Express / Hono)
  p = p.replace(/:[a-zA-Z0-9_]+(?:\([^)]+\))?\??/g, "{param}");
  // Remove duplicate slashes
  p = p.replace(/\/+/g, "/");
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p.toLowerCase();
}

export function toCanonicalKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizePath(path)}`;
}

export function parseSpecContracts(specFilePath: string, sliceFilter?: string): ContractEndpoint[] {
  if (!existsSync(specFilePath)) {
    return [];
  }

  const content = readFileSync(specFilePath, "utf-8");
  const lines = content.split("\n");
  const endpoints: ContractEndpoint[] = [];
  const seen = new Set<string>();

  // Matches:
  // - **GET /api/resource** or - **GET** `/api/resource`
  // - `GET /api/resource`
  // ### GET /api/resource or #### `GET /api/resource`
  // # @spec-contract GET /api/resource
  // | GET | /api/resource |
  const httpRegex = /(?:^-\s*\*\*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)(?:\*\*\s*`|\s+)([^\*`]+)(?:\*\*|`\*\*)|^-\s*`\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^`]+)`|^#{2,4}\s*`?\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^`\s]+)`?|(?:#|\/\/|<!--)\s*@spec-contract\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)|\|\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\|\s*([^\|]+)\s*\|)/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    const match = rawLine.match(httpRegex);
    if (match) {
      const method = (match[1] || match[3] || match[5] || match[7] || match[9]).toUpperCase();
      let rawPath = (match[2] || match[4] || match[6] || match[8] || match[10]).trim();
      rawPath = rawPath.replace(/^[`'"]+|[`'"]+$/g, "").trim();
      const canonical = toCanonicalKey(method, rawPath);

      if (sliceFilter) {
        const sliceLower = sliceFilter.toLowerCase();
        if (!canonical.includes(sliceLower) && !rawPath.toLowerCase().includes(sliceLower)) {
          continue;
        }
      }

      if (!seen.has(canonical)) {
        seen.add(canonical);
        endpoints.push({
          method,
          path: normalizePath(rawPath),
          canonical,
          raw: `${method} ${rawPath}`,
          source: specFilePath,
          line: i + 1,
        });
      }
    }
  }

  return endpoints;
}

const IGNORED_DIRS = new Set([
  "node_modules",
  "vendor",
  ".git",
  ".dart_tool",
  "dist",
  "build",
  ".venv",
  "artifacts",
  "_workspace",
  ".agents",
]);

export function findSourceFiles(dirs: string[], extensions: string[]): string[] {
  const files: string[] = [];
  const exts = new Set(extensions.map((e) => (e.startsWith(".") ? e : `.${e}`)));

  function walk(currentDir: string) {
    if (!existsSync(currentDir)) return;
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
            walk(join(currentDir, entry.name));
          }
        } else if (entry.isFile()) {
          if (exts.has(extname(entry.name).toLowerCase())) {
            files.push(join(currentDir, entry.name));
          }
        }
      }
    } catch {
      // Gracefully ignore unreadable directories
    }
  }

  for (const d of dirs) {
    walk(resolve(d));
  }

  return files;
}

export function detectStack(files: string[]): "node" | "flutter" | "laravel" | "python" {
  let tsCount = 0;
  let dartCount = 0;
  let phpCount = 0;
  let pyCount = 0;

  for (const f of files) {
    const ext = extname(f).toLowerCase();
    if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") tsCount++;
    else if (ext === ".dart") dartCount++;
    else if (ext === ".php") phpCount++;
    else if (ext === ".py") pyCount++;
  }

  if (dartCount > tsCount && dartCount > phpCount && dartCount > pyCount) return "flutter";
  if (phpCount > tsCount && phpCount > dartCount && phpCount > pyCount) return "laravel";
  if (pyCount > tsCount && pyCount > dartCount && pyCount > phpCount) return "python";
  return "node";
}

export function extractEndpointsFromNode(filePath: string, content: string): ContractEndpoint[] {
  const endpoints: ContractEndpoint[] = [];
  const lines = content.split("\n");

  // Express / Hono / Fastify / Elysia
  // router.get('/path', ...), app.post("/path", ...), route.put(...)
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

    // Chained Hono controller routes (.get("/path"), etc.) when not already matched by expressRegex
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

    // Explicit @spec-contract or @endpoint comments
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

  // NestJS Decorators: @Controller('prefix') + @Get('path')
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

  // Next.js Route Handlers (app/api/.../route.ts)
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

  // Next.js Pages router API (pages/api/.../[id].ts)
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

  // Dio or Shelf: dio.get('/api/...'), router.get('/api/...'), app.get('/api/...'), ..get('/api/...')
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

  // Route::get('path', ...), Route::post(...)
  const routeRegex = /Route::(get|post|put|patch|delete|options)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  // Route::apiResource('users', ...)
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
      let resource = match[1].replace(/^\/+|\/+$/g, "");
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

  // Track router prefixes: router = APIRouter(prefix="/api/users") or Blueprint(..., url_prefix="/api/users")
  const prefixMap = new Map<string, string>();
  const routerPrefixRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:APIRouter|Blueprint)\s*\([^)]*(?:prefix|url_prefix)\s*=\s*["'`]([^"'`]+)["'`]/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = routerPrefixRegex.exec(content)) !== null) {
    prefixMap.set(pMatch[1], pMatch[2].replace(/\/+$/, ""));
  }

  // FastAPI: @router.get('/path'), @app.post("/path")
  const fastApiRegex = /@([a-zA-Z0-9_]+)\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  // Flask: @app.route('/path', methods=['GET', 'POST'])
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

export function lintContracts(options: LintContractsOptions = {}): LintContractsResult {
  const repoRoot = process.cwd();
  const specFile = options.specFile ? resolve(options.specFile) : join(repoRoot, "artifacts", "architecture", "api_spec.md");
  const defaultDirs = ["src", "lib", "routes", "app", "features"];
  const candidateDirs = options.srcDirs && options.srcDirs.length > 0 ? options.srcDirs : defaultDirs;
  if (!options.srcDirs || options.srcDirs.length === 0) {
    for (const d of ["packages", "apps"]) {
      if (existsSync(join(repoRoot, d)) && !candidateDirs.includes(d)) {
        candidateDirs.push(d);
      }
    }
  }

  const specContracts = parseSpecContracts(specFile, options.slice);
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".dart", ".php", ".py"];
  const codeFiles = findSourceFiles(candidateDirs, extensions);

  const stack = options.stack && options.stack !== "auto" ? options.stack : detectStack(codeFiles);
  const codeEndpoints = extractCodeEndpoints(codeFiles, stack);

  // When auditing a specific slice, scope code endpoints to that slice to prevent false orphan errors
  let activeCodeEndpoints = codeEndpoints;
  if (options.slice) {
    const sliceLower = options.slice.toLowerCase();
    activeCodeEndpoints = codeEndpoints.filter(
      (ce) =>
        ce.canonical.toLowerCase().includes(sliceLower) ||
        (ce.source && ce.source.toLowerCase().includes(sliceLower))
    );
  }

  const specSet = new Set(specContracts.map((c) => c.canonical));
  const codeSet = new Set(activeCodeEndpoints.map((c) => c.canonical));

  const missing: string[] = [];
  const orphans: string[] = [];

  // Check missing (defined in spec, missing in code)
  for (const sc of specContracts) {
    if (!codeSet.has(sc.canonical)) {
      missing.push(sc.canonical);
    }
  }

  // Check orphans (implemented in code, missing in spec)
  for (const ce of activeCodeEndpoints) {
    if (!specSet.has(ce.canonical)) {
      orphans.push(ce.canonical);
    }
  }

  // Handle empty code repo (e.g. freshly cloned template before code is written)
  let valid = true;
  if (codeFiles.length === 0 && options.allowEmpty) {
    valid = true;
  } else {
    const hasMissingError = missing.length > 0 && !options.allowMissing;
    const hasOrphansError = orphans.length > 0 && !options.allowOrphans;
    valid = !hasMissingError && !hasOrphansError;
  }

  let summary = "";
  if (valid) {
    summary = `✅ SDD Contract Guard: Contratos alineados. ${specContracts.length} contratos en spec, ${activeCodeEndpoints.length} endpoints en código (${codeFiles.length} archivos escaneados [${stack}]).`;
  } else {
    summary = `❌ SDD Contract Drift: Desalineamiento detectado (${missing.length} pendientes en código, ${orphans.length} huérfanos sin spec).`;
  }

  return {
    valid,
    contracts: specContracts.map((c) => c.canonical),
    codeEndpoints: codeEndpoints.map((c) => c.canonical),
    missing,
    orphans,
    scannedFilesCount: codeFiles.length,
    stackDetected: stack,
    summary,
  };
}

export function parseCliArgs(args: string[]): LintContractsOptions {
  let specFile: string | undefined;
  const srcDirs: string[] = [];
  let stack: "node" | "flutter" | "laravel" | "python" | "auto" = "auto";
  let slice: string | undefined;
  let json = false;
  let allowMissing = false;
  let allowOrphans = false;
  let allowEmpty = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--spec") {
      specFile = args[++i];
    } else if (arg === "--src" || arg === "-s") {
      srcDirs.push(args[++i]);
    } else if (arg === "--stack") {
      const st = args[++i]?.toLowerCase();
      if (st === "node" || st === "flutter" || st === "laravel" || st === "python") {
        stack = st;
      }
    } else if (arg === "--slice") {
      slice = args[++i];
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--allow-missing") {
      allowMissing = true;
    } else if (arg === "--allow-orphans") {
      allowOrphans = true;
    } else if (arg === "--allow-empty") {
      allowEmpty = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Uso: bun scripts/lint_contracts.ts [--spec <api_spec.md>] [--src <dir>] [--stack <auto|node|flutter|laravel|python>] [--json]

Opciones:
  --spec <ruta>       Ruta al archivo api_spec.md (default: artifacts/architecture/api_spec.md)
  --src, -s <dir>     Directorio(s) de código a escanear (default: src, lib, routes, app, features)
  --stack <nombre>    Stack tecnológico a auditar (node, flutter, laravel, python, auto)
  --slice <nombre>    Filtrar contratos y rutas por Vertical Slice
  --json              Salida en formato JSON estructurado
  --allow-missing     No fallar si hay contratos de la especificación aún sin implementar (Fase Red TDD)
  --allow-orphans     No fallar si hay endpoints en código sin documentar
  --allow-empty       Aceptar 0 archivos de código si el repositorio es una plantilla inicial
  --help, -h          Muestra esta ayuda
`);
      process.exit(0);
    }
  }

  return {
    specFile,
    srcDirs: srcDirs.length > 0 ? srcDirs : undefined,
    stack,
    slice,
    json,
    allowMissing,
    allowOrphans,
    allowEmpty,
  };
}

if (import.meta.main) {
  const options = parseCliArgs(process.argv.slice(2));
  const result = lintContracts(options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.summary);
    if (result.missing.length > 0) {
      console.log("\n⚠️ Contratos pendientes de implementar en código (Missing):");
      for (const m of result.missing) {
        console.log(`   - ${m}`);
      }
    }
    if (result.orphans.length > 0) {
      console.log("\n⚠️ Endpoints huérfanos implementados sin contrato en api_spec.md (Orphans):");
      for (const o of result.orphans) {
        console.log(`   - ${o}`);
      }
    }
  }

  process.exit(result.valid ? 0 : 1);
}
