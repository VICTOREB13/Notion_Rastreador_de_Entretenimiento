import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  detectStack,
  extractEndpointsFromFlutter,
  extractEndpointsFromLaravel,
  extractEndpointsFromNode,
  extractEndpointsFromPython,
  lintContracts,
  normalizePath,
  parseSpecContracts,
  toCanonicalKey,
} from "./lint_contracts";

const FIXTURES_DIR = join(process.cwd(), "_workspace", "test_lint_fixtures");

describe("SDD Multi-Stack Contract Drift Guard (lint_contracts.ts)", () => {
  beforeAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
    mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(FIXTURES_DIR)) {
      rmSync(FIXTURES_DIR, { recursive: true, force: true });
    }
  });

  it("1. Normaliza rutas HTTP y comodines de parámetros (:id, {id}, <id>, [id])", () => {
    expect(normalizePath("/api/users/:id")).toBe("/api/users/{param}");
    expect(normalizePath("/api/users/{user_id}")).toBe("/api/users/{param}");
    expect(normalizePath("/api/users/<id>/")).toBe("/api/users/{param}");
    expect(normalizePath("api/users/[id]")).toBe("/api/users/{param}");
    expect(toCanonicalKey("get", "/api/users/:id")).toBe("GET /api/users/{param}");
    expect(toCanonicalKey("POST", "/api/users/")).toBe("POST /api/users");
  });

  it("2. Extrae contratos desde api_spec.md en múltiples formatos válidos", () => {
    const specPath = join(FIXTURES_DIR, "spec_test.md");
    const specContent = `---
tipo: api_spec
---
# API Spec
## Endpoints
- **GET /api/resource**
- **POST /api/users/:id**
### PUT /api/users/{id}
# @spec-contract DELETE /api/users/:id
| PATCH | /api/settings | Actualizar settings |
`;
    writeFileSync(specPath, specContent, "utf-8");

    const contracts = parseSpecContracts(specPath);
    expect(contracts.length).toBe(5);
    const keys = contracts.map((c) => c.canonical);
    expect(keys).toContain("GET /api/resource");
    expect(keys).toContain("POST /api/users/{param}");
    expect(keys).toContain("PUT /api/users/{param}");
    expect(keys).toContain("DELETE /api/users/{param}");
    expect(keys).toContain("PATCH /api/settings");
  });

  it("3. Extrae endpoints desde código TypeScript/Node (Express y Next.js)", () => {
    const expressCode = `
import { Router } from "express";
const router = Router();
router.get("/api/resource", (req, res) => res.json({}));
app.post('/api/users/:id', handler);
server.delete("/api/users/:id", deleteHandler);
`;
    const endpoints = extractEndpointsFromNode("src/routes.ts", expressCode);
    const keys = endpoints.map((e) => e.canonical);
    expect(keys).toContain("GET /api/resource");
    expect(keys).toContain("POST /api/users/{param}");
    expect(keys).toContain("DELETE /api/users/{param}");

    // Next.js Route handler
    const nextCode = `
export async function GET(req: Request) { return Response.json({}); }
export async function POST(req: Request) { return Response.json({}); }
`;
    const nextEndpoints = extractEndpointsFromNode("src/app/api/auth/route.ts", nextCode);
    const nextKeys = nextEndpoints.map((e) => e.canonical);
    expect(nextKeys).toContain("GET /api/auth");
    expect(nextKeys).toContain("POST /api/auth");
  });

  it("4. Extrae endpoints desde código Flutter/Dart (Dio & Shelf)", () => {
    const dartCode = `
class ApiClient {
  Future<void> fetch() async {
    await dio.get('/api/resource');
    await client.post('https://api.example.com/api/users');
    router.delete('/api/users/:id', handler);
  }
}
`;
    const endpoints = extractEndpointsFromFlutter("lib/api.dart", dartCode);
    const keys = endpoints.map((e) => e.canonical);
    expect(keys).toContain("GET /api/resource");
    expect(keys).toContain("POST /api/users");
    expect(keys).toContain("DELETE /api/users/{param}");
  });

  it("5. Extrae endpoints desde Laravel/PHP (Route & apiResource)", () => {
    const phpCode = `<?php
Route::get('/api/resource', [ResourceController::class, 'index']);
Route::post('api/users', [UserController::class, 'store']);
Route::apiResource('products', ProductController::class);
`;
    const endpoints = extractEndpointsFromLaravel("routes/api.php", phpCode);
    const keys = endpoints.map((e) => e.canonical);
    expect(keys).toContain("GET /api/resource");
    expect(keys).toContain("POST /api/users");
    // apiResource generates CRUD
    expect(keys).toContain("GET /api/products");
    expect(keys).toContain("GET /api/products/{param}");
    expect(keys).toContain("DELETE /api/products/{param}");
  });

  it("6. Extrae endpoints desde Python (FastAPI & Flask)", () => {
    const pyCode = `
from fastapi import APIRouter
router = APIRouter()

@router.get("/api/resource")
def get_resource():
    return {}

@app.post("/api/users/{user_id}")
def create_user(user_id: int):
    return {}

@blueprint.route("/api/legacy", methods=["GET", "POST"])
def legacy():
    pass
`;
    const endpoints = extractEndpointsFromPython("app/routes.py", pyCode);
    const keys = endpoints.map((e) => e.canonical);
    expect(keys).toContain("GET /api/resource");
    expect(keys).toContain("POST /api/users/{param}");
    expect(keys).toContain("GET /api/legacy");
    expect(keys).toContain("POST /api/legacy");
  });

  it("7. Detecta drift: Endpoint huérfano (en código pero no en spec)", () => {
    const specPath = join(FIXTURES_DIR, "drift_spec.md");
    writeFileSync(specPath, "- **GET /api/resource**\n", "utf-8");

    const srcDir = join(FIXTURES_DIR, "drift_src_orphan");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "routes.ts"),
      `app.get('/api/resource', h); app.post('/api/untracked', h);`,
      "utf-8"
    );

    const result = lintContracts({
      specFile: specPath,
      srcDirs: [srcDir],
    });

    expect(result.valid).toBe(false);
    expect(result.orphans).toContain("POST /api/untracked");
    expect(result.missing.length).toBe(0);
  });

  it("8. Detecta drift: Contrato pendiente (en spec pero sin implementar en código)", () => {
    const specPath = join(FIXTURES_DIR, "drift_missing_spec.md");
    writeFileSync(
      specPath,
      "- **GET /api/resource**\n- **POST /api/missing**\n",
      "utf-8"
    );

    const srcDir = join(FIXTURES_DIR, "drift_src_missing");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "routes.ts"),
      `app.get('/api/resource', h);`,
      "utf-8"
    );

    const result = lintContracts({
      specFile: specPath,
      srcDirs: [srcDir],
    });

    expect(result.valid).toBe(false);
    expect(result.missing).toContain("POST /api/missing");
    expect(result.orphans.length).toBe(0);
  });

  it("9. Valida con éxito cuando spec y código están en paridad total (valid: true)", () => {
    const specPath = join(FIXTURES_DIR, "perfect_spec.md");
    writeFileSync(
      specPath,
      "- **GET /api/resource**\n- **POST /api/users/:id**\n",
      "utf-8"
    );

    const srcDir = join(FIXTURES_DIR, "perfect_src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "routes.ts"),
      `app.get('/api/resource', h);\nrouter.post('/api/users/{id}', h);`,
      "utf-8"
    );

    const result = lintContracts({
      specFile: specPath,
      srcDirs: [srcDir],
    });

    expect(result.valid).toBe(true);
    expect(result.missing.length).toBe(0);
    expect(result.orphans.length).toBe(0);
  });

  it("10. Permite contratos pendientes en Fase Red TDD con --allow-missing", () => {
    const specPath = join(FIXTURES_DIR, "red_tdd_spec.md");
    writeFileSync(specPath, "- **GET /api/resource**\n- **POST /api/new**\n", "utf-8");

    const srcDir = join(FIXTURES_DIR, "red_tdd_src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "routes.ts"), `app.get('/api/resource', h);`, "utf-8");

    const result = lintContracts({
      specFile: specPath,
      srcDirs: [srcDir],
      allowMissing: true,
    });

    expect(result.valid).toBe(true);
    expect(result.missing).toContain("POST /api/new");
  });

  it("11. CLI emite JSON estructurado y código de salida 0 en paridad", () => {
    const specPath = join(FIXTURES_DIR, "cli_spec.md");
    writeFileSync(specPath, "- **GET /api/test**\n", "utf-8");
    const srcDir = join(FIXTURES_DIR, "cli_src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "routes.ts"), `app.get('/api/test', h);`, "utf-8");

    const cmd = `bun scripts/lint_contracts.ts --spec "${specPath}" --src "${srcDir}" --json`;
    const stdout = execSync(cmd, { encoding: "utf-8" });
    const parsed = JSON.parse(stdout);

    expect(parsed.valid).toBe(true);
    expect(parsed.contracts).toContain("GET /api/test");
    expect(parsed.codeEndpoints).toContain("GET /api/test");
    expect(parsed.missing.length).toBe(0);
    expect(parsed.orphans.length).toBe(0);
  });

  it("12. CLI falla con código de salida 1 cuando se detecta drift", () => {
    const specPath = join(FIXTURES_DIR, "cli_fail_spec.md");
    writeFileSync(specPath, "- **GET /api/test**\n", "utf-8");
    const srcDir = join(FIXTURES_DIR, "cli_fail_src");
    mkdirSync(srcDir, { recursive: true });
    // Empty source -> missing contract
    writeFileSync(join(srcDir, "empty.ts"), `const x = 1;`, "utf-8");

    let exitCode = 0;
    try {
      execSync(`bun scripts/lint_contracts.ts --spec "${specPath}" --src "${srcDir}"`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }

    expect(exitCode).toBe(1);
  });

  it("13. Normaliza parámetros avanzados de FastAPI, Flask, Next.js y Express regex", () => {
    // FastAPI typed params
    expect(normalizePath("/api/items/{item_id:int}")).toBe("/api/items/{param}");
    expect(normalizePath("/api/files/{file_path:path}")).toBe("/api/files/{param}");
    // Flask converters
    expect(normalizePath("/api/users/<int:user_id>")).toBe("/api/users/{param}");
    expect(normalizePath("/api/docs/<path:doc_path>")).toBe("/api/docs/{param}");
    // Next.js catch-all routes
    expect(normalizePath("/api/posts/[...slug]")).toBe("/api/posts/{param}");
    expect(normalizePath("/api/posts/[[...slug]]")).toBe("/api/posts/{param}");
    // Express regex constraint & optional
    expect(normalizePath("/api/orders/:id([0-9]+)")).toBe("/api/orders/{param}");
    expect(normalizePath("/api/orders/:id?")).toBe("/api/orders/{param}");
  });

  it("14. Extrae endpoints con prefijo en Python FastAPI APIRouter y Flask Blueprint", () => {
    const pythonCode = `
from fastapi import APIRouter
router = APIRouter(prefix="/api/v1/users")

@router.get("/{id:int}")
def get_user(id: int):
    return {}

from flask import Blueprint
auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

@auth_bp.route("/login", methods=["POST"])
def login():
    return {}
`;
    const endpoints = extractEndpointsFromPython("app/api.py", pythonCode);
    const keys = endpoints.map((e) => e.canonical);
    expect(keys).toContain("GET /api/v1/users/{param}");
    expect(keys).toContain("POST /api/v1/auth/login");
  });

  it("15. Extrae endpoints de NestJS (@Controller y @Get/@Post) y Next.js Pages router", () => {
    const nestCode = `
@Controller('/api/products')
export class ProductController {
  @Get(':id')
  findOne() {}

  @Post()
  create() {}
}
`;
    const nestEndpoints = extractEndpointsFromNode("src/product.controller.ts", nestCode);
    const nestKeys = nestEndpoints.map((e) => e.canonical);
    expect(nestKeys).toContain("GET /api/products/{param}");
    expect(nestKeys).toContain("POST /api/products");

    // Next.js Pages router
    const pagesCode = `
export default function handler(req, res) {
  if (req.method === 'POST') { return res.json({}); }
  if (req.method === 'GET') { return res.json({}); }
  return res.json({});
}
`;
    const pagesEndpoints = extractEndpointsFromNode("src/pages/api/billing/[id].ts", pagesCode);
    const pagesKeys = pagesEndpoints.map((e) => e.canonical);
    expect(pagesKeys).toContain("POST /api/billing/{param}");
    expect(pagesKeys).toContain("GET /api/billing/{param}");
  });

  it("16. Extrae endpoints de Shelf router y cascade syntax en Flutter/Dart", () => {
    const shelfCode = `
void main() {
  final app = Router();
  app.get('/api/resource', handler);
  final router = Router()
    ..get('/api/users', listUsers)
    ..delete('/api/users/<id>', deleteUser);
}
`;
    const endpoints = extractEndpointsFromFlutter("bin/server.dart", shelfCode);
    const keys = endpoints.map((e) => e.canonical);
    expect(keys).toContain("GET /api/resource");
    expect(keys).toContain("GET /api/users");
    expect(keys).toContain("DELETE /api/users/{param}");
  });

  it("17. Aislamiento por slice: no genera falsos positivos (huérfanos) de otros slices en la app", () => {
    const specPath = join(FIXTURES_DIR, "multi_slice_spec.md");
    writeFileSync(
      specPath,
      `- **GET /api/resource**\n- **POST /api/auth/login**\n`,
      "utf-8"
    );

    const srcDir = join(FIXTURES_DIR, "multi_slice_src");
    mkdirSync(join(srcDir, "resource"), { recursive: true });
    mkdirSync(join(srcDir, "auth"), { recursive: true });

    writeFileSync(
      join(srcDir, "resource", "resource.route.ts"),
      `app.get('/api/resource', h);`,
      "utf-8"
    );
    writeFileSync(
      join(srcDir, "auth", "auth.route.ts"),
      `app.post('/api/auth/login', h);`,
      "utf-8"
    );

    // Auditing only "resource" slice
    const result = lintContracts({
      specFile: specPath,
      srcDirs: [srcDir],
      slice: "resource",
    });

    expect(result.valid).toBe(true);
    expect(result.missing.length).toBe(0);
    expect(result.orphans.length).toBe(0);
    expect(result.contracts).toContain("GET /api/resource");
    // Does NOT flag /api/auth/login as orphan of resource slice
    expect(result.orphans).not.toContain("POST /api/auth/login");
  });
});
