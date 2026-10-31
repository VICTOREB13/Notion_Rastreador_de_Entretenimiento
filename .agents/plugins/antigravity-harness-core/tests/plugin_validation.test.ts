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
    const proc = spawnSync("agy", ["plugin", "validate", `"${localPluginPath}"`, "--strict", "--json"], {
      encoding: "utf-8",
      shell: true,
    });

    expect(proc.status).toBe(0);
    // agy 1.3.1 emite el reporte --json por stderr
    const parsed = JSON.parse(proc.stdout || proc.stderr);
    expect(parsed.components.hooks).toBeGreaterThanOrEqual(1);
    expect(parsed.findings.length).toBe(0);
  });

  test.skipIf(!hasAgy || !existsSync(globalPluginPath))("4. Global config plugin passes strict validation via 'agy plugin validate'", () => {
    const proc = spawnSync("agy", ["plugin", "validate", globalPluginPath, "--strict", "--json"], {
      encoding: "utf-8",
      shell: true,
    });

    expect(proc.status).toBe(0);
    const parsed = JSON.parse(proc.stdout || proc.stderr);
    expect(parsed.components.hooks).toBeGreaterThanOrEqual(1);
    expect(parsed.findings.length).toBe(0);
  });

  test("5. All lifecycle hook commands avoid shell chaining operators ('||', '&&') for Windows PowerShell 5.1 compatibility", () => {
    const hooksPath = resolve(localPluginPath, "hooks.json");
    const hooksConfig = JSON.parse(readFileSync(hooksPath, "utf-8"));
    const harnessHook = hooksConfig["antigravity-harness-core"];

    const commands: string[] = [];
    for (const hookList of Object.values(harnessHook)) {
      if (Array.isArray(hookList)) {
        for (const item of hookList as any[]) {
          if (item.command) commands.push(item.command);
          if (Array.isArray(item.hooks)) {
            for (const subItem of item.hooks) {
              if (subItem.command) commands.push(subItem.command);
            }
          }
        }
      }
    }

    expect(commands.length).toBe(6);
    for (const cmd of commands) {
      expect(cmd).not.toContain("||");
      expect(cmd).not.toContain("&&");
      if (process.platform === "win32") {
        const psCheck = spawnSync("powershell.exe", ["-NoProfile", "-Command", `[scriptblock]::Create('${cmd}')`], {
          encoding: "utf-8",
        });
        expect(psCheck.status).toBe(0);
      }
    }
  });
});
