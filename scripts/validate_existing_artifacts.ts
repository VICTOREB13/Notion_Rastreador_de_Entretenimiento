import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const validator = join(process.cwd(), ".agents", "skills", "artifact-standards", "scripts", "validate_artifact.ts");
const schemasDir = join(process.cwd(), ".agents", "skills", "artifact-standards", "references", "schemas");

// Base canonical living artifacts
const baseArtifacts = [
  { artifact: "artifacts/project_overview.md", schema: "overview.md" },
  { artifact: "artifacts/architecture/abstractions.md", schema: "abstractions.md" },
  { artifact: "artifacts/architecture/api_spec.md", schema: "api_spec.md" },
  { artifact: "artifacts/architecture/architecture.md", schema: "architecture.md" },
  { artifact: "artifacts/architecture/design_system.md", schema: "design_system.md" },
  { artifact: "artifacts/audit_reports/audit_report.md", schema: "audit_report.md" },
];

// Dynamically discover all active or sealed changelog versions (changelog_v*.md)
const planningDir = join(process.cwd(), "artifacts", "planning");
const changelogPairs: { artifact: string; schema: string }[] = [];

if (existsSync(planningDir)) {
  let changelogFiles: string[] = [];
  if (typeof Bun !== "undefined" && Bun.Glob) {
    const glob = new Bun.Glob("changelog_v*.md");
    changelogFiles = Array.from(glob.scanSync({ cwd: planningDir, onlyFiles: true }));
  } else {
    changelogFiles = readdirSync(planningDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^changelog_v.+\.md$/.test(entry.name))
      .map((entry) => entry.name);
  }
  changelogFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  for (const file of changelogFiles) {
    changelogPairs.push({
      artifact: `artifacts/planning/${file}`,
      schema: "changelog.md",
    });
  }
}

// Fallback if no versioned changelogs exist
if (changelogPairs.length === 0) {
  changelogPairs.push({
    artifact: "artifacts/planning/changelog_v1.md",
    schema: "changelog.md",
  });
}

const planningArtifacts = [
  { artifact: "artifacts/planning/implementation_plan.md", schema: "implementation_plan.md" },
  { artifact: "artifacts/planning/task.md", schema: "task.md" },
];

const artifactSchemaPairs = [
  ...baseArtifacts,
  ...changelogPairs,
  ...planningArtifacts,
];

const heuristicsFiles = [
  ".agents/skills/artifact-standards/rules/learned_heuristics.md",
  ".agents/skills/backend-architect/rules/learned_heuristics.md",
  ".agents/skills/devops-engineer/rules/learned_heuristics.md",
  ".agents/skills/frontend-ui/rules/learned_heuristics.md",
  ".agents/skills/project-planner/rules/learned_heuristics.md",
  ".agents/skills/systems-auditor/rules/learned_heuristics.md",
];

console.log(`=== VALIDATING ${artifactSchemaPairs.length} LIVING & DELTA ARTIFACTS AGAINST CANONICAL SCHEMAS ===`);
let allArtifactsPass = true;

for (const pair of artifactSchemaPairs) {
  const artPath = join(process.cwd(), pair.artifact);
  const schemaPath = join(schemasDir, pair.schema);

  let exitCode = 0;
  let stdout = "";
  try {
    stdout = execSync(`bun "${validator}" "${artPath}" --schema "${schemaPath}"`, { encoding: "utf-8" });
    exitCode = 0;
  } catch (e: any) {
    exitCode = e.status ?? 1;
    stdout = e.stdout ?? "";
  }

  let parsed: { valid: boolean; errors: any[] };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = { valid: false, errors: [`Failed to parse validator output: ${stdout}`] };
  }

  const passed = exitCode === 0 && parsed.valid === true && parsed.errors.length === 0;
  if (!passed) allArtifactsPass = false;

  console.log(`${passed ? "[PASS]" : "[FAIL]"} ${pair.artifact} -> ${pair.schema} (Exit: ${exitCode}, Valid: ${parsed.valid})`);
  if (!passed) {
    console.log(`       Errors: ${JSON.stringify(parsed.errors, null, 2)}`);
  }
}

console.log(`\n=== VALIDATING ${heuristicsFiles.length} LEARNED HEURISTICS (FIFO BUDGET & SCHEMA) ===`);
let allHeuristicsPass = true;
const heuristicsSchema = join(schemasDir, "learned_heuristics.md");

for (const hFile of heuristicsFiles) {
  const hPath = join(process.cwd(), hFile);

  let exitCode = 0;
  let stdout = "";
  try {
    stdout = execSync(`bun "${validator}" "${hPath}" --heuristics --schema "${heuristicsSchema}"`, { encoding: "utf-8" });
    exitCode = 0;
  } catch (e: any) {
    exitCode = e.status ?? 1;
    stdout = e.stdout ?? "";
  }

  let parsed: { valid: boolean; errors: any[] };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = { valid: false, errors: [`Failed to parse validator output: ${stdout}`] };
  }

  const passed = exitCode === 0 && parsed.valid === true && parsed.errors.length === 0;
  if (!passed) allHeuristicsPass = false;

  console.log(`${passed ? "[PASS]" : "[FAIL]"} ${hFile} (Exit: ${exitCode}, Valid: ${parsed.valid})`);
  if (!passed) {
    console.log(`       Errors: ${JSON.stringify(parsed.errors, null, 2)}`);
  }
}

console.log(`\nArtifacts Result: ${allArtifactsPass ? `ALL ${artifactSchemaPairs.length} PASSED` : "FAILURES DETECTED"}`);
console.log(`Heuristics Result: ${allHeuristicsPass ? `ALL ${heuristicsFiles.length} PASSED` : "FAILURES DETECTED"}`);

if (!allArtifactsPass || !allHeuristicsPass) {
  process.exit(1);
}
