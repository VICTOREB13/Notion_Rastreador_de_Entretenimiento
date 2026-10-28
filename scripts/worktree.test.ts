import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  createDirectoryJunction,
  createWorktree,
  doesBranchExist,
  getGitRepoRoot,
  isJunctionOrSymlink,
  listWorktrees,
  normalizeDomain,
  removeWorktree,
  runCli,
  safeUnlinkJunction,
} from "./worktree";

describe("Deterministic Worktree & Concurrency Security (Pilar II)", () => {
  let tempBaseDir: string;
  let tempRepoRoot: string;

  beforeAll(() => {
    // Create an isolated directory structure for testing:
    // tempBaseDir/
    //   repo/                <-- main git repository
    //   worktree-backend/   <-- ephemeral worktree created as sibling
    tempBaseDir = mkdtempSync(join(tmpdir(), "worktree-test-suite-"));
    tempRepoRoot = join(tempBaseDir, "repo");
    mkdirSync(tempRepoRoot, { recursive: true });

    // Initialize test git repository
    execSync("git init", { cwd: tempRepoRoot, stdio: "pipe" });
    execSync("git config user.name \"Worktree Test Worker\"", { cwd: tempRepoRoot, stdio: "pipe" });
    execSync("git config user.email \"worker@test.local\"", { cwd: tempRepoRoot, stdio: "pipe" });
    execSync("git checkout -b main", { cwd: tempRepoRoot, stdio: "pipe" });

    // Create initial commit
    writeFileSync(join(tempRepoRoot, "README.md"), "# Test Repo\n", "utf8");
    execSync("git add README.md", { cwd: tempRepoRoot, stdio: "pipe" });
    execSync("git commit -m \"initial commit\"", { cwd: tempRepoRoot, stdio: "pipe" });

    // Set up mock heavy dependencies in source repo
    const mockDeps = [
      { dir: "node_modules/pkg-example", file: "index.js", content: "module.exports = 'pkg-v1';" },
      { dir: "vendor/test-dep", file: "autoload.php", content: "<?php // vendor autoload" },
      { dir: ".dart_tool", file: "package_config.json", content: '{"configVersion":2}' },
      { dir: ".venv", file: "pyvenv.cfg", content: "version = 3.12.0" },
    ];

    for (const dep of mockDeps) {
      const depDir = join(tempRepoRoot, dep.dir);
      mkdirSync(depDir, { recursive: true });
      writeFileSync(join(depDir, dep.file), dep.content, "utf8");
    }

    // Set up mock harness state
    const wsDir = join(tempRepoRoot, "_workspace");
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(join(wsDir, "tool_counter.json"), JSON.stringify({ consecutive_reads: 0 }), "utf8");
  });

  afterAll(() => {
    // Clean up all temporary files safely
    try {
      rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  describe("1. Domain Normalization", () => {
    it("normalizes simple domain name to agent/ branch", () => {
      const res = normalizeDomain("backend");
      expect(res.domain).toBe("backend");
      expect(res.branch).toBe("agent/backend");
      expect(res.worktreeDirName).toBe("worktree-backend");
    });

    it("normalizes agent/ prefixed input cleanly", () => {
      const res = normalizeDomain("agent/frontend");
      expect(res.domain).toBe("frontend");
      expect(res.branch).toBe("agent/frontend");
      expect(res.worktreeDirName).toBe("worktree-frontend");
    });

    it("preserves feat/ and fix/ branch conventions with folder-safe names", () => {
      const res = normalizeDomain("feat/issue-42");
      expect(res.domain).toBe("feat-issue-42");
      expect(res.branch).toBe("feat/issue-42");
      expect(res.worktreeDirName).toBe("worktree-feat-issue-42");
    });

    it("throws on empty domain name", () => {
      expect(() => normalizeDomain("   ")).toThrow("Domain name cannot be empty.");
    });
  });

  describe("2. Safe Junction Operations & Non-Destructive Guarantees", () => {
    it("creates NTFS directory junction with zero-copy access to files", () => {
      const srcDir = join(tempBaseDir, "mock_source_dep");
      const junctionDir = join(tempBaseDir, "mock_junction_link");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "asset.txt"), "shared asset payload", "utf8");

      createDirectoryJunction(srcDir, junctionDir);

      expect(isJunctionOrSymlink(junctionDir)).toBe(true);
      expect(existsSync(join(junctionDir, "asset.txt"))).toBe(true);
      expect(readFileSync(join(junctionDir, "asset.txt"), "utf8")).toBe("shared asset payload");

      // Cleanup
      safeUnlinkJunction(junctionDir);
      rmSync(srcDir, { recursive: true, force: true });
    });

    it("CRITICAL: safeUnlinkJunction NEVER deletes target directory contents", () => {
      const srcDir = join(tempBaseDir, "precious_node_modules");
      const junctionDir = join(tempBaseDir, "wt_node_modules_junction");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "heavy-lib.js"), "important production code", "utf8");

      createDirectoryJunction(srcDir, junctionDir);
      expect(isJunctionOrSymlink(junctionDir)).toBe(true);

      // Perform safe teardown
      const unlinked = safeUnlinkJunction(junctionDir);
      expect(unlinked).toBe(true);

      // Verify the junction is gone
      expect(existsSync(junctionDir)).toBe(false);

      // CRITICAL ASSERTION: The source folder and its files MUST remain completely intact!
      expect(existsSync(srcDir)).toBe(true);
      expect(existsSync(join(srcDir, "heavy-lib.js"))).toBe(true);
      expect(readFileSync(join(srcDir, "heavy-lib.js"), "utf8")).toBe("important production code");

      rmSync(srcDir, { recursive: true, force: true });
    });

    it("safeUnlinkJunction does not delete files in a regular non-empty directory", () => {
      const regDir = join(tempBaseDir, "regular_folder");
      mkdirSync(regDir, { recursive: true });
      writeFileSync(join(regDir, "keep_me.txt"), "safe", "utf8");

      // Calling safeUnlinkJunction on a regular non-symlink directory should refuse to delete
      const result = safeUnlinkJunction(regDir);
      expect(result).toBe(false);
      expect(existsSync(join(regDir, "keep_me.txt"))).toBe(true);

      rmSync(regDir, { recursive: true, force: true });
    });
  });

  describe("3. Full Git Worktree Lifecycle & Shared Harness State", () => {
    it("creates worktree, links heavy dependencies, and injects shared harness state", () => {
      const res = createWorktree({
        domain: "backend",
        repoRoot: tempRepoRoot,
      });

      expect(res.success).toBe(true);
      expect(res.branch).toBe("agent/backend");
      expect(res.domain).toBe("backend");
      expect(existsSync(res.worktreePath)).toBe(true);

      // Verify heavy dependencies are linked as junctions
      expect(res.junctionsCreated).toContain("node_modules");
      expect(res.junctionsCreated).toContain("vendor");
      expect(res.junctionsCreated).toContain(".dart_tool");
      expect(res.junctionsCreated).toContain(".venv");
      expect(res.junctionsCreated).toContain("_workspace");

      // Verify files in linked dependencies are readable from worktree
      const wtPkgFile = join(res.worktreePath, "node_modules", "pkg-example", "index.js");
      expect(existsSync(wtPkgFile)).toBe(true);
      expect(readFileSync(wtPkgFile, "utf8")).toBe("module.exports = 'pkg-v1';");

      // Verify harness state file is accessible
      const wtWsFile = join(res.worktreePath, "_workspace", "tool_counter.json");
      expect(existsSync(wtWsFile)).toBe(true);

      // Verify ephemeral .env was configured with TOOL_COUNTER_FILE pointing to root
      const envPath = join(res.worktreePath, ".env");
      expect(existsSync(envPath)).toBe(true);
      const envContent = readFileSync(envPath, "utf8");
      expect(envContent).toContain("TOOL_COUNTER_FILE=");
      expect(envContent).toContain(resolve(tempRepoRoot, "_workspace", "tool_counter.json"));

      // Verify git branch exists
      expect(doesBranchExist("agent/backend", tempRepoRoot)).toBe(true);
    });

    it("listWorktrees accurately detects active worktrees and junction status", () => {
      const worktrees = listWorktrees(tempRepoRoot);

      expect(worktrees.length).toBeGreaterThanOrEqual(2);
      const rootWt = worktrees.find((w) => w.isRoot);
      const backendWt = worktrees.find((w) => w.domain === "backend");

      expect(rootWt).toBeDefined();
      expect(backendWt).toBeDefined();
      expect(backendWt?.branch).toBe("agent/backend");

      // Verify junctions in backend worktree
      const junctionNames = backendWt?.junctions.map((j) => j.name) || [];
      expect(junctionNames).toContain("node_modules");
      expect(junctionNames).toContain("_workspace");

      const nodeModulesJunction = backendWt?.junctions.find((j) => j.name === "node_modules");
      expect(nodeModulesJunction?.valid).toBe(true);
    });

    it("rejects duplicate worktree creation for active path", () => {
      expect(() =>
        createWorktree({
          domain: "backend",
          repoRoot: tempRepoRoot,
        })
      ).toThrow("Worktree already active");
    });

    it("safely tears down worktree without touching root repository dependencies", () => {
      const res = removeWorktree({
        domain: "backend",
        repoRoot: tempRepoRoot,
        deleteBranch: true,
      });

      expect(res.success).toBe(true);
      expect(res.junctionsUnlinked).toContain("node_modules");
      expect(res.junctionsUnlinked).toContain("_workspace");

      // Verify worktree folder is gone
      expect(existsSync(res.worktreePath)).toBe(false);

      // Verify branch is deleted
      expect(doesBranchExist("agent/backend", tempRepoRoot)).toBe(false);

      // CRITICAL VERIFICATION: Root dependencies MUST be 100% intact!
      const rootPkg = join(tempRepoRoot, "node_modules", "pkg-example", "index.js");
      expect(existsSync(rootPkg)).toBe(true);
      expect(readFileSync(rootPkg, "utf8")).toBe("module.exports = 'pkg-v1';");

      const rootVendor = join(tempRepoRoot, "vendor", "test-dep", "autoload.php");
      expect(existsSync(rootVendor)).toBe(true);

      const rootDart = join(tempRepoRoot, ".dart_tool", "package_config.json");
      expect(existsSync(rootDart)).toBe(true);

      const rootVenv = join(tempRepoRoot, ".venv", "pyvenv.cfg");
      expect(existsSync(rootVenv)).toBe(true);

      const rootCounter = join(tempRepoRoot, "_workspace", "tool_counter.json");
      expect(existsSync(rootCounter)).toBe(true);
    });

    it("attaches to an existing git branch when creating a worktree", () => {
      // Pre-create branch
      execSync("git branch agent/frontend", { cwd: tempRepoRoot, stdio: "pipe" });
      expect(doesBranchExist("agent/frontend", tempRepoRoot)).toBe(true);

      const res = createWorktree({
        domain: "frontend",
        repoRoot: tempRepoRoot,
      });

      expect(res.success).toBe(true);
      expect(res.branch).toBe("agent/frontend");

      // Clean up
      removeWorktree({
        domain: "frontend",
        repoRoot: tempRepoRoot,
        deleteBranch: true,
      });
    });

    it("refuses to remove the root repository worktree", () => {
      expect(() =>
        removeWorktree({
          domain: "main",
          path: tempRepoRoot,
          repoRoot: tempRepoRoot,
        })
      ).toThrow("Cannot remove root repository worktree");
    });

    it("throws explicit error when removing non-existent worktree", () => {
      expect(() =>
        removeWorktree({
          domain: "non-existent-worker",
          repoRoot: tempRepoRoot,
        })
      ).toThrow("Worktree 'non-existent-worker' not found");
    });

    it("creates worktree with custom branch and baseBranch, then tears it down cleanly", () => {
      const res = createWorktree({
        domain: "custom-audit",
        branch: "feat/custom-audit-slice",
        baseBranch: "main",
        repoRoot: tempRepoRoot,
      });

      expect(res.success).toBe(true);
      expect(res.branch).toBe("feat/custom-audit-slice");
      expect(doesBranchExist("feat/custom-audit-slice", tempRepoRoot)).toBe(true);

      const teardown = removeWorktree({
        domain: "custom-audit",
        repoRoot: tempRepoRoot,
        deleteBranch: true,
      });

      expect(teardown.success).toBe(true);
      expect(teardown.branchDeleted).toBe("feat/custom-audit-slice");
      expect(doesBranchExist("feat/custom-audit-slice", tempRepoRoot)).toBe(false);
    });
  });

  describe("4. CLI Invocations and Argument Handling", () => {
    it("displays help and exits with 0 on --help", async () => {
      const code = await runCli(["--help"], { exitOnError: false });
      expect(code).toBe(0);
    });

    it("displays command help and exits with 0 on add --help and remove -h", async () => {
      const addHelpCode = await runCli(["add", "--help"], { exitOnError: false });
      expect(addHelpCode).toBe(0);

      const removeHelpCode = await runCli(["remove", "-h"], { exitOnError: false });
      expect(removeHelpCode).toBe(0);
    });

    it("lists active worktrees via CLI with --json", async () => {
      const code = await runCli(["list", "--json"], { exitOnError: false });
      expect(code).toBe(0);
    });

    it("correctly extracts domain when flags with values precede positional argument", async () => {
      const cliWtPath = join(tempBaseDir, "wt-cli-test");
      const addCode = await runCli(
        [
          "add",
          "--branch",
          "feat/cli-domain-order",
          "--repo-root",
          tempRepoRoot,
          "--path",
          cliWtPath,
          "cli-feature",
          "--json",
        ],
        { exitOnError: false }
      );
      expect(addCode).toBe(0);
      expect(existsSync(cliWtPath)).toBe(true);

      const removeCode = await runCli(
        ["remove", "cli-feature", "--repo-root", tempRepoRoot, "--path", cliWtPath, "--delete-branch", "--json"],
        { exitOnError: false }
      );
      expect(removeCode).toBe(0);
      expect(existsSync(cliWtPath)).toBe(false);
    });

    it("returns error code 1 when domain argument is missing for add", async () => {
      const code = await runCli(["add"], { exitOnError: false });
      expect(code).toBe(1);
    });

    it("returns error code 1 when domain argument is missing for remove", async () => {
      const code = await runCli(["remove"], { exitOnError: false });
      expect(code).toBe(1);
    });

    it("returns error code 1 on unknown command", async () => {
      const code = await runCli(["unknown-command"], { exitOnError: false });
      expect(code).toBe(1);
    });
  });
});


