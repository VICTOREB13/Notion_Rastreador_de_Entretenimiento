import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type LintContractsOptions,
  type LintContractsResult,
  detectStack,
  findSourceFiles,
  parseSpecContracts,
} from "./lint_contracts_helpers";
import { extractCodeEndpoints } from "./lint_contracts_extractors";

export * from "./lint_contracts_helpers";
export * from "./lint_contracts_extractors";

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
