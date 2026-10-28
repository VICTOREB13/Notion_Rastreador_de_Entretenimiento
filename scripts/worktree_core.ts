import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  type WorktreeAddOptions,
  type WorktreeInfo,
  type WorktreeRemoveOptions,
  type WorktreeResult,
  type WorktreeTeardownResult,
  CIRCUIT_BREAKER_STATE_FILE,
  DEFAULT_HEAVY_DEPENDENCIES,
  HARNESS_STATE_DIR,
  createDirectoryJunction,
  detectJunctions,
  doesBranchExist,
  getGitRepoRoot,
  isJunctionOrSymlink,
  normalizeDomain,
  safeUnlinkJunction,
} from "./worktree_helpers";

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
 */
export function createWorktree(options: WorktreeAddOptions): WorktreeResult {
  const repoRoot = options.repoRoot ? resolve(options.repoRoot) : getGitRepoRoot();
  const { domain, branch: defaultBranch, worktreeDirName } = normalizeDomain(options.domain);
  const branch = options.branch ? options.branch.trim() : defaultBranch;
  const worktreePath = options.path ? resolve(options.path) : resolve(repoRoot, "..", worktreeDirName);

  const existingWorktrees = listWorktrees(repoRoot);
  const alreadyRegistered = existingWorktrees.find(
    (w) => w.path.toLowerCase() === worktreePath.toLowerCase()
  );

  if (alreadyRegistered) {
    throw new Error(
      `Worktree already active at '${worktreePath}' on branch '${alreadyRegistered.branch || "detached"}'.`
    );
  }

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
    const depsToLink = options.dependencies || DEFAULT_HEAVY_DEPENDENCIES;
    for (const dep of depsToLink) {
      const srcDepPath = join(repoRoot, dep);
      if (existsSync(srcDepPath)) {
        const tgtDepPath = join(worktreePath, dep);
        createDirectoryJunction(srcDepPath, tgtDepPath);
        junctionsCreated.push(dep);
      }
    }

    const rootWorkspaceDir = join(repoRoot, HARNESS_STATE_DIR);
    if (!existsSync(rootWorkspaceDir)) {
      mkdirSync(rootWorkspaceDir, { recursive: true });
    }

    const wtWorkspaceDir = join(worktreePath, HARNESS_STATE_DIR);
    createDirectoryJunction(rootWorkspaceDir, wtWorkspaceDir, { overwriteExisting: true });
    junctionsCreated.push(HARNESS_STATE_DIR);

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

  const existingWorktrees = listWorktrees(repoRoot);
  const targetWt = options.path
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

  if (existsSync(worktreePath)) {
    const knownCandidates = [
      ...DEFAULT_HEAVY_DEPENDENCIES,
      HARNESS_STATE_DIR,
      ...(options.dependencies || []),
    ];

    for (const candidate of knownCandidates) {
      const candidatePath = join(worktreePath, candidate);
      if (isJunctionOrSymlink(candidatePath)) {
        if (safeUnlinkJunction(candidatePath)) {
          junctionsUnlinked.push(candidate);
        }
      }
    }

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

    const wtEnvPath = join(worktreePath, ".env");
    if (existsSync(wtEnvPath) && !isJunctionOrSymlink(wtEnvPath)) {
      try {
        unlinkSync(wtEnvPath);
      } catch {}
    }
  }

  try {
    execSync(`git worktree remove "${worktreePath}" --force`, { cwd: repoRoot, stdio: "pipe" });
  } catch {
    try {
      execSync("git worktree prune", { cwd: repoRoot, stdio: "pipe" });
    } catch {}
  }

  try {
    execSync("git worktree prune", { cwd: repoRoot, stdio: "pipe" });
  } catch {}

  if (existsSync(worktreePath)) {
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
