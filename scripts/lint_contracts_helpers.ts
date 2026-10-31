import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

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
  p = p.replace(/\{[^{}]+\}/g, "{param}");
  p = p.replace(/<[^<>]+>/g, "{param}");
  p = p.replace(/\[{1,2}[^\[\]]+\]{1,2}/g, "{param}");
  p = p.replace(/:[a-zA-Z0-9_]+(?:\([^)]+\))?\??/g, "{param}");
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

  const httpRegex = /(?:^-\s*\*\*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)(?:\*\*\s*`|\s+)([^\*`]+)(?:\*\*|`\*\*)|^-\s*`\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^`]+)`|^#{1,6}\s*`?\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)|(?:#|\/\/|<!--)\s*@spec-contract\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)|\|\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\|\s*([^\|]+)\s*\|)/i;

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
