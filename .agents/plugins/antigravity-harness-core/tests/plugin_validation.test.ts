import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

describe("Harness³ Plugin Validation (Antigravity CLI Compliance)", () => {
  const localPluginPath = resolve(".agents/plugins/antigravity-harness-core");
  const home = process.env.USERPROFILE || process.env.HOME || ".";
  const globalPluginPath = resolve(home, ".gemini/config/plugins/antigravity-harness-core");

  const hasAgy = (() => {
    try {
      const checkCmd = process.platform === "win32" ? "where.exe agy" : "which agy";
      const res = spawnSync(checkCmd, { shell: true, stdio: "ignore" });
      return res.status === 0;
    } catch {
      return false;
    }
  })();

  test("1. plugin.json contains valid manifest specifications (version 9.0.0)", () => {
    const manifestPath = resolve(localPluginPath, "plugin.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBe("antigravity-harness-core");
    expect(manifest.version).toBe("9.0.0");
    expect(manifest.license).toBe("MIT");
    expect(manifest.author?.name).toBeDefined();
  });

  test("2. hooks.json configures all 6 native Antigravity CLI lifecycle hooks", () => {
    const hooksPath = resolve(localPluginPath, "hooks.json");
    expect(existsSync(hooksPath)).toBe(true);

    const hooksConfig = JSON.parse(readFileSync(hooksPath, "utf-8"));
    const harnessHook = hooksConfig["antigravity-harness-core"];
    expect(harnessHook).toBeDefined();

    expect(Array.isArray(harnessHook.SessionStart)).toBe(true);
    expect(Array.isArray(harnessHook.PreInvocation)).toBe(true);
    expect(Array.isArray(harnessHook.PreToolUse)).toBe(true);
    expect(Array.isArray(harnessHook.PostToolUse)).toBe(true);
    expect(Array.isArray(harnessHook.PostInvocation)).toBe(true);
    expect(Array.isArray(harnessHook.Stop)).toBe(true);
  });

  test.skipIf(!hasAgy)("3. Local workspace plugin passes strict validation via 'agy plugin validate'", () => {
    const proc = spawnSync("agy", ["plugin", "validate", JSON.stringify(localPluginPath), "--strict", "--json"], {
      encoding: "utf-8",
      shell: true,
    });

    expect(proc.status).toBe(0);
    const parsed = JSON.parse(proc.stdout);
    expect(parsed.components.hooks).toBeGreaterThanOrEqual(1);
    const errors = (parsed.findings || []).filter((f: { severity?: string }) => f.severity === "error");
    expect(errors.length).toBe(0);
  });

  test.skipIf(!hasAgy || !existsSync(globalPluginPath))("4. Global config plugin passes strict validation via 'agy plugin validate'", () => {
    const proc = spawnSync("agy", ["plugin", "validate", JSON.stringify(globalPluginPath), "--strict", "--json"], {
      encoding: "utf-8",
      shell: true,
    });

    expect(proc.status).toBe(0);
    const parsed = JSON.parse(proc.stdout);
    expect(parsed.components.hooks).toBeGreaterThanOrEqual(1);
    const errors = (parsed.findings || []).filter((f: { severity?: string }) => f.severity === "error");
    expect(errors.length).toBe(0);
  });
});
