import { execSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export interface WorktreeJunctionInfo {
  name: string;
  target: string;
  valid: boolean;
}

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string | null;
  isBare: boolean;
  isDetached: boolean;
  isRoot: boolean;
  domain?: string;
  junctions: WorktreeJunctionInfo[];
}

export interface WorktreeAddOptions {
  domain: string;
  branch?: string;
  path?: string;
  repoRoot?: string;
  baseBranch?: string;
  dependencies?: string[];
}

export interface WorktreeRemoveOptions {
  domain: string;
  path?: string;
  repoRoot?: string;
  force?: boolean;
  deleteBranch?: boolean;
  dependencies?: string[];
}

export interface WorktreeResult {
  success: boolean;
  worktreePath: string;
  branch: string;
  domain: string;
  junctionsCreated: string[];
  envConfigured: boolean;
  message: string;
}

export interface WorktreeTeardownResult {
  success: boolean;
  worktreePath: string;
  junctionsUnlinked: string[];
  branchDeleted?: string;
  message: string;
}

export const DEFAULT_HEAVY_DEPENDENCIES = ["node_modules", "vendor", ".dart_tool", ".venv"];
export const HARNESS_STATE_DIR = "_workspace";
export const CIRCUIT_BREAKER_STATE_FILE = "tool_counter.json";

/**
 * Gets the git repository root directory.
 */
export function getGitRepoRoot(cwd?: string): string {
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      cwd: cwd || process.cwd(),
      stdio: "pipe",
      encoding: "utf8",
    }).trim();
    return resolve(root);
  } catch (err: any) {
    throw new Error(`Failed to locate git root: ${err?.message || "Not a git repository"}`);
  }
}

/**
 * Normalizes a domain identifier into domain, branch name and worktree directory name.
 * e.g. "backend" -> domain="backend", branch="agent/backend", worktreeDirName="worktree-backend"
 * e.g. "agent/frontend" -> domain="frontend", branch="agent/frontend", worktreeDirName="worktree-frontend"
 * e.g. "feat/issue-1" -> domain="feat-issue-1", branch="feat/issue-1", worktreeDirName="worktree-feat-issue-1"
 */
export function normalizeDomain(input: string): { domain: string; branch: string; worktreeDirName: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Domain name cannot be empty.");
  }

  let domain = trimmed;
  let branch = trimmed;

  if (trimmed.startsWith("agent/")) {
    domain = trimmed.slice("agent/".length);
    branch = trimmed;
  } else if (trimmed.startsWith("feat/") || trimmed.startsWith("fix/") || trimmed.startsWith("chore/")) {
    domain = trimmed.replace(/[\/\\]/g, "-");
    branch = trimmed;
  } else {
    branch = `agent/${trimmed}`;
  }

  const folderSafe = domain.replace(/[\/\\]/g, "-");
  const worktreeDirName = `worktree-${folderSafe}`;

  return { domain, branch, worktreeDirName };
}

/**
 * Checks if a git branch exists locally.
 */
export function doesBranchExist(branchName: string, cwd?: string): boolean {
  try {
    execSync(`git rev-parse --verify --quiet refs/heads/${branchName}`, {
      cwd: cwd || process.cwd(),
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a path is an NTFS junction or symbolic link without following it.
 */
export function isJunctionOrSymlink(targetPath: string): boolean {
  try {
    const stat = lstatSync(targetPath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Safely creates an NTFS directory junction on Windows (or directory symlink on POSIX).
 * Note: Junction creation does NOT copy files; it creates a zero-copy pointer.
 */
export function createDirectoryJunction(
  existingTarget: string,
  newLinkPath: string,
  options?: { overwriteExisting?: boolean }
): void {
  const resolvedTarget = resolve(existingTarget);
  const resolvedLink = resolve(newLinkPath);

  if (!existsSync(resolvedTarget)) {
    throw new Error(`Target directory does not exist: ${resolvedTarget}`);
  }

  if (isJunctionOrSymlink(resolvedLink)) {
    try {
      const current = resolve(readlinkSync(resolvedLink));
      if (current.toLowerCase() === resolvedTarget.toLowerCase()) {
        return; // Junction already exists and points to correct target
      }
    } catch {}
    safeUnlinkJunction(resolvedLink);
  } else if (existsSync(resolvedLink)) {
    if (options?.overwriteExisting) {
      rmSync(resolvedLink, { recursive: true, force: true });
    } else {
      const entries = readdirSync(resolvedLink);
      if (entries.length === 0) {
        rmdirSync(resolvedLink);
      } else {
        throw new Error(
          `Cannot create junction at '${resolvedLink}': directory already exists and contains files.`
        );
      }
    }
  }

  const parentDir = dirname(resolvedLink);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  try {
    // fs.symlinkSync with 'junction' creates NTFS directory junction on Windows without admin
    symlinkSync(resolvedTarget, resolvedLink, "junction");
  } catch (err: any) {
    if (process.platform === "win32") {
      try {
        execSync(`cmd /c mklink /J "${resolvedLink}" "${resolvedTarget}"`, { stdio: "pipe" });
      } catch (cmdErr: any) {
        throw new Error(
          `Failed to create NTFS junction '${resolvedLink}' -> '${resolvedTarget}': ${cmdErr?.message || err?.message}`
        );
      }
    } else {
      // Fallback for unix-like test environments
      symlinkSync(resolvedTarget, resolvedLink, "dir");
    }
  }
}

/**
 * Safely unlinks an NTFS junction without ever deleting original target files.
 * GUARANTEE: Never invokes recursive deletion. Only unlinks the reparse point.
 */
export function safeUnlinkJunction(linkPath: string): boolean {
  const resolvedPath = resolve(linkPath);

  if (!existsSync(resolvedPath) && !isJunctionOrSymlink(resolvedPath)) {
    return false;
  }

  if (isJunctionOrSymlink(resolvedPath)) {
    // Unlink the symbolic link / reparse point ONLY.
    // In Node/Bun, unlinkSync on a directory junction unlinks the junction without touching target files.
    unlinkSync(resolvedPath);
    return true;
  }

  // Windows fallback: cmd /c rmdir without /S only removes empty directories or junctions.
  // It physically refuses to remove non-empty regular directories, guaranteeing data safety.
  if (process.platform === "win32") {
    try {
      execSync(`cmd /c rmdir "${resolvedPath}"`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Detects all junctions present in a given worktree directory.
 */
export function detectJunctions(targetDir: string): WorktreeJunctionInfo[] {
  const junctions: WorktreeJunctionInfo[] = [];
  if (!existsSync(targetDir)) return junctions;

  try {
    const entries = readdirSync(targetDir);
    for (const entry of entries) {
      const fullPath = join(targetDir, entry);
      if (isJunctionOrSymlink(fullPath)) {
        try {
          const rawTarget = readlinkSync(fullPath);
          const resolvedTarget = resolve(targetDir, rawTarget);
          junctions.push({
            name: entry,
            target: resolvedTarget,
            valid: existsSync(resolvedTarget),
          });
        } catch {
          junctions.push({
            name: entry,
            target: "unknown",
            valid: false,
          });
        }
      }
    }
  } catch {}

  return junctions;
}

/**
 * Lists all active git worktrees and enriches them with junction information.
 */
export function listWorktrees(repoRoot?: string): WorktreeInfo[] {
  const root = repoRoot ? resolve(repoRoot) : getGitRepoRoot();
  let porcelainOutput = "";

  try {
    porcelainOutput = execSync("git worktree list --porcelain", {
      cwd: root,
      stdio: "pipe",
      encoding: "utf8",
    });
  } catch (err: any) {
    throw new Error(`Failed to list git worktrees: ${err?.message}`);
  }

  const blocks = porcelainOutput.trim().split(/\r?\n\r?\n/);
  const worktrees: WorktreeInfo[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split(/\r?\n/);
    let wtPath = "";
    let head = "";
    let branch: string | null = null;
    let isBare = false;
    let isDetached = false;

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        wtPath = resolve(line.slice("worktree ".length).trim());
      } else if (line.startsWith("HEAD ")) {
        head = line.slice("HEAD ".length).trim();
      } else if (line.startsWith("branch ")) {
        const ref = line.slice("branch ".length).trim();
        branch = ref.replace(/^refs\/heads\//, "");
      } else if (line === "bare") {
        isBare = true;
      } else if (line === "detached") {
        isDetached = true;
      }
    }

    if (!wtPath) continue;

    const isRoot = wtPath.toLowerCase() === root.toLowerCase();
    const folderName = basename(wtPath);
    let domain: string | undefined;
    if (folderName.startsWith("worktree-")) {
      domain = folderName.slice("worktree-".length);
    } else if (branch && branch.startsWith("agent/")) {
      domain = branch.slice("agent/".length);
    }

    const junctions = detectJunctions(wtPath);

    worktrees.push({
      path: wtPath,
      head,
      branch,
      isBare,
      isDetached,
      isRoot,
      domain,
      junctions,
    });
  }

  return worktrees;
}

/**
 * Creates an ephemeral git worktree for parallel agent execution.
 * Configures NTFS junctions for dependencies and harness state sharing.
 */
export function createWorktree(options: WorktreeAddOptions): WorktreeResult {
  const repoRoot = options.repoRoot ? resolve(options.repoRoot) : getGitRepoRoot();
  const { domain, branch: defaultBranch, worktreeDirName } = normalizeDomain(options.domain);
  const branch = options.branch ? options.branch.trim() : defaultBranch;
  const worktreePath = options.path ? resolve(options.path) : resolve(repoRoot, "..", worktreeDirName);

  // Check if worktree is already registered in git
  const existingWorktrees = listWorktrees(repoRoot);
  const alreadyRegistered = existingWorktrees.find(
    (w) => w.path.toLowerCase() === worktreePath.toLowerCase()
  );

  if (alreadyRegistered) {
    throw new Error(
      `Worktree already active at '${worktreePath}' on branch '${alreadyRegistered.branch || "detached"}'.`
    );
  }

  // Check branch existence
  const branchExists = doesBranchExist(branch, repoRoot);
  let gitCmd: string;
  if (branchExists) {
    gitCmd = `git worktree add "${worktreePath}" "${branch}"`;
  } else if (options.baseBranch) {
    gitCmd = `git worktree add -b "${branch}" "${worktreePath}" "${options.baseBranch.trim()}"`;
  } else {
    gitCmd = `git worktree add -b "${branch}" "${worktreePath}"`;
  }

  try {
    execSync(gitCmd, { cwd: repoRoot, stdio: "pipe" });
  } catch (err: any) {
    throw new Error(`git worktree add failed: ${err?.stderr?.toString() || err?.message}`);
  }

  const junctionsCreated: string[] = [];

  try {
    // 1. Link heavy dependencies
    const depsToLink = options.dependencies || DEFAULT_HEAVY_DEPENDENCIES;
    for (const dep of depsToLink) {
      const srcDepPath = join(repoRoot, dep);
      if (existsSync(srcDepPath)) {
        const tgtDepPath = join(worktreePath, dep);
        createDirectoryJunction(srcDepPath, tgtDepPath);
        junctionsCreated.push(dep);
      }
    }

    // 2. Share harness state directory (_workspace)
    const rootWorkspaceDir = join(repoRoot, HARNESS_STATE_DIR);
    if (!existsSync(rootWorkspaceDir)) {
      mkdirSync(rootWorkspaceDir, { recursive: true });
    }

    const wtWorkspaceDir = join(worktreePath, HARNESS_STATE_DIR);
    createDirectoryJunction(rootWorkspaceDir, wtWorkspaceDir, { overwriteExisting: true });
    junctionsCreated.push(HARNESS_STATE_DIR);

    // 3. Inject shared Circuit Breaker state via ephemeral .env
    const rootCounterPath = resolve(rootWorkspaceDir, CIRCUIT_BREAKER_STATE_FILE);
    const wtEnvPath = join(worktreePath, ".env");
    const envContent = [
      "# Shared Harness State - Windows 11 Concurrency Safe",
      `TOOL_COUNTER_FILE=${rootCounterPath}`,
      `SHARED_HARNESS_ROOT=${repoRoot}`,
      "",
    ].join("\n");

    if (existsSync(wtEnvPath)) {
      const existingEnv = readFileSync(wtEnvPath, "utf8");
      if (!existingEnv.includes("TOOL_COUNTER_FILE=")) {
        writeFileSync(wtEnvPath, `${existingEnv}\n${envContent}`, "utf8");
      }
    } else {
      writeFileSync(wtEnvPath, envContent, "utf8");
    }
  } catch (setupErr: any) {
    // Transactional rollback: dismantle junctions and remove dirty worktree
    for (const j of junctionsCreated) {
      try {
        safeUnlinkJunction(join(worktreePath, j));
      } catch {}
    }
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, { cwd: repoRoot, stdio: "pipe" });
      execSync("git worktree prune", { cwd: repoRoot, stdio: "pipe" });
    } catch {}
    throw new Error(`Failed to configure worktree junctions/state: ${setupErr?.message}`);
  }

  return {
    success: true,
    worktreePath,
    branch,
    domain,
    junctionsCreated,
    envConfigured: true,
    message: `Worktree successfully created at '${worktreePath}' on branch '${branch}'. Linked ${junctionsCreated.length} junctions.`,
  };
}

/**
 * Safely removes a worktree and dismantles all NTFS junctions without touching root files.
 */
export function removeWorktree(options: WorktreeRemoveOptions): WorktreeTeardownResult {
  const repoRoot = options.repoRoot ? resolve(options.repoRoot) : getGitRepoRoot();
  const { domain, branch: defaultBranch, worktreeDirName } = normalizeDomain(options.domain);

  // Find worktree by path or matching domain/branch
  const existingWorktrees = listWorktrees(repoRoot);
  let targetWt = options.path
    ? existingWorktrees.find((w) => w.path.toLowerCase() === resolve(options.path!).toLowerCase())
    : existingWorktrees.find(
        (w) =>
          w.domain === domain ||
          w.branch === defaultBranch ||
          basename(w.path).toLowerCase() === worktreeDirName.toLowerCase()
      );

  const worktreePath = targetWt
    ? targetWt.path
    : options.path
    ? resolve(options.path)
    : resolve(repoRoot, "..", worktreeDirName);

  if (targetWt?.isRoot || worktreePath.toLowerCase() === repoRoot.toLowerCase()) {
    throw new Error(`Cannot remove root repository worktree at '${worktreePath}'.`);
  }

  if (!targetWt && !existsSync(worktreePath)) {
    throw new Error(`Worktree '${options.domain}' not found at '${worktreePath}' or in active git worktrees.`);
  }

  const junctionsUnlinked: string[] = [];

  // CRITICAL SAFETY STEP: Unlink all directory junctions FIRST!
  // This guarantees that any subsequent deletion never deletes files in the root repository.
  if (existsSync(worktreePath)) {
    const knownCandidates = [
      ...DEFAULT_HEAVY_DEPENDENCIES,
      HARNESS_STATE_DIR,
      ...(options.dependencies || []),
    ];

    // Check known candidate junctions
    for (const candidate of knownCandidates) {
      const candidatePath = join(worktreePath, candidate);
      if (isJunctionOrSymlink(candidatePath)) {
        if (safeUnlinkJunction(candidatePath)) {
          junctionsUnlinked.push(candidate);
        }
      }
    }

    // Also scan all top-level directory entries for any additional symlinks/junctions
    try {
      const remainingEntries = readdirSync(worktreePath);
      for (const entry of remainingEntries) {
        const entryPath = join(worktreePath, entry);
        if (isJunctionOrSymlink(entryPath)) {
          if (safeUnlinkJunction(entryPath)) {
            junctionsUnlinked.push(entry);
          }
        }
      }
    } catch {}

    // Safely remove ephemeral .env if generated
    const wtEnvPath = join(worktreePath, ".env");
    if (existsSync(wtEnvPath) && !isJunctionOrSymlink(wtEnvPath)) {
      try {
        unlinkSync(wtEnvPath);
      } catch {}
    }
  }

  // Remove from git worktrees
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, { cwd: repoRoot, stdio: "pipe" });
  } catch (err: any) {
    // If git worktree remove errors because directory was already deleted or not registered
    try {
      execSync("git worktree prune", { cwd: repoRoot, stdio: "pipe" });
    } catch {}
  }

  try {
    execSync("git worktree prune", { cwd: repoRoot, stdio: "pipe" });
  } catch {}

  // If worktree folder still exists on disk (e.g. untracked artifacts left over)
  if (existsSync(worktreePath)) {
    // Re-verify NO junctions remain before wiping leftover folder
    const leftoverJunctions = detectJunctions(worktreePath);
    for (const lj of leftoverJunctions) {
      safeUnlinkJunction(join(worktreePath, lj.name));
    }
    rmSync(worktreePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }

  let branchDeleted: string | undefined;
  const branchToDelete = targetWt?.branch || defaultBranch;
  if (options.deleteBranch && branchToDelete) {
    try {
      execSync(`git branch -D "${branchToDelete}"`, { cwd: repoRoot, stdio: "pipe" });
      branchDeleted = branchToDelete;
    } catch {}
  }

  return {
    success: true,
    worktreePath,
    junctionsUnlinked,
    branchDeleted,
    message: `Worktree dismantled safely at '${worktreePath}'. Unlinked ${junctionsUnlinked.length} junctions.`,
  };
}

/**
 * CLI Entrypoint
 */
export async function runCli(
  argv = process.argv.slice(2),
  options: { exitOnError?: boolean } = { exitOnError: true }
): Promise<number> {
  const [command, ...args] = argv;

  const isHelp =
    !command ||
    command === "--help" ||
    command === "-h" ||
    command === "help" ||
    argv.includes("--help") ||
    argv.includes("-h");

  if (isHelp) {
    console.log(`
Usage:
  bun scripts/worktree.ts add <dominio> [options]      Create ephemeral worktree with NTFS junctions
  bun scripts/worktree.ts remove <dominio> [options]   Safely teardown worktree and unlink junctions
  bun scripts/worktree.ts teardown <dominio>           Alias for remove
  bun scripts/worktree.ts list [options]               List all active worktrees and junction status

Options:
  --branch <branch>    Specify custom git branch (default: agent/<dominio>)
  --base <branch>      Specify base branch to fork from if creating new branch
  --path <path>        Custom directory path for worktree (default: ../worktree-<dominio>)
  --json               Output results in JSON format
  --force              Force worktree removal
  --delete-branch      Delete git branch during teardown
  --help, -h           Show this help message
`);
    return 0;
  }

  let isJson = false;
  let isForce = false;
  let isDeleteBranch = false;
  let customPath: string | undefined;
  let customBranch: string | undefined;
  let baseBranch: string | undefined;
  let repoRoot: string | undefined;
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      isJson = true;
    } else if (arg === "--force") {
      isForce = true;
    } else if (arg === "--delete-branch") {
      isDeleteBranch = true;
    } else if (arg === "--path" && i + 1 < args.length) {
      customPath = args[++i];
    } else if (arg.startsWith("--path=")) {
      customPath = arg.slice("--path=".length);
    } else if (arg === "--branch" && i + 1 < args.length) {
      customBranch = args[++i];
    } else if (arg.startsWith("--branch=")) {
      customBranch = arg.slice("--branch=".length);
    } else if ((arg === "--base" || arg === "--base-branch") && i + 1 < args.length) {
      baseBranch = args[++i];
    } else if (arg.startsWith("--base=")) {
      baseBranch = arg.slice("--base=".length);
    } else if (arg.startsWith("--base-branch=")) {
      baseBranch = arg.slice("--base-branch=".length);
    } else if (arg === "--repo-root" && i + 1 < args.length) {
      repoRoot = args[++i];
    } else if (arg.startsWith("--repo-root=")) {
      repoRoot = arg.slice("--repo-root=".length);
    } else if (!arg.startsWith("--")) {
      positionalArgs.push(arg);
    }
  }

  const domain = positionalArgs[0];

  try {
    switch (command.toLowerCase()) {
      case "add": {
        if (!domain) {
          throw new Error("Missing required domain argument. Example: bun scripts/worktree.ts add backend");
        }
        const result = createWorktree({
          domain,
          branch: customBranch,
          baseBranch,
          path: customPath,
          repoRoot,
        });

        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\x1b[32m✔ [worktree] ${result.message}\x1b[0m`);
          console.log(`  Path: ${result.worktreePath}`);
          console.log(`  Branch: ${result.branch}`);
          console.log(`  Junctions: ${result.junctionsCreated.join(", ") || "none"}`);
          console.log(`  Harness Shared State: OK (.env & _workspace junction)`);
        }
        return 0;
      }

      case "remove":
      case "teardown": {
        if (!domain) {
          throw new Error("Missing required domain argument. Example: bun scripts/worktree.ts remove backend");
        }
        const result = removeWorktree({
          domain,
          path: customPath,
          repoRoot,
          force: isForce,
          deleteBranch: isDeleteBranch,
        });

        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\x1b[32m✔ [worktree] ${result.message}\x1b[0m`);
          console.log(`  Path: ${result.worktreePath}`);
          console.log(`  Unlinked junctions: ${result.junctionsUnlinked.join(", ") || "none"}`);
          if (result.branchDeleted) {
            console.log(`  Deleted branch: ${result.branchDeleted}`);
          }
        }
        return 0;
      }

      case "list":
      case "status": {
        const worktrees = listWorktrees(repoRoot);
        if (isJson) {
          console.log(JSON.stringify(worktrees, null, 2));
        } else {
          console.log("\n\x1b[1mActive Git Worktrees:\x1b[0m");
          for (const wt of worktrees) {
            const tag = wt.isRoot ? "\x1b[36m[ROOT]\x1b[0m" : "\x1b[33m[WORKTREE]\x1b[0m";
            console.log(`  ${tag} ${wt.path}`);
            console.log(`    Branch: ${wt.branch || "(detached/bare)"}`);
            console.log(`    HEAD: ${wt.head}`);
            if (wt.junctions.length > 0) {
              const junctionsSummary = wt.junctions
                .map((j) => `${j.name} -> ${j.target} (${j.valid ? "OK" : "BROKEN"})`)
                .join(", ");
              console.log(`    Junctions (${wt.junctions.length}): ${junctionsSummary}`);
            } else {
              console.log(`    Junctions: None`);
            }
          }
          console.log("");
        }
        return 0;
      }

      default:
        throw new Error(`Unknown command '${command}'. Use --help for usage.`);
    }
  } catch (err: any) {
    if (isJson) {
      console.error(JSON.stringify({ error: err.message }, null, 2));
    } else {
      console.error(`\x1b[31m✖ [worktree error] ${err.message}\x1b[0m`);
    }
    if (options.exitOnError) {
      process.exit(1);
    }
    return 1;
  }
}

if (import.meta.main) {
  runCli();
}
