import { execSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

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
        return;
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
      symlinkSync(resolvedTarget, resolvedLink, "dir");
    }
  }
}

/**
 * Safely unlinks an NTFS junction without ever deleting original target files.
 */
export function safeUnlinkJunction(linkPath: string): boolean {
  const resolvedPath = resolve(linkPath);

  if (!existsSync(resolvedPath) && !isJunctionOrSymlink(resolvedPath)) {
    return false;
  }

  if (isJunctionOrSymlink(resolvedPath)) {
    unlinkSync(resolvedPath);
    return true;
  }

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
