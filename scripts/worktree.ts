import {
  createWorktree,
  listWorktrees,
  removeWorktree,
} from "./worktree_core";

export * from "./worktree_helpers";
export * from "./worktree_core";

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
