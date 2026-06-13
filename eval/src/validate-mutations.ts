// SID-42 retrofit runner. Grades the seed-and-mutate set of agent outputs against
// the UNCHANGED chunk-1 ruler — same gradeOutput, same judges, same
// scenario expected_answer — via a separate entry point. Sibling-runner pattern
// inherited from CHUNK2-DESIGN-DECISIONS Q17: modifies no existing grader file;
// touches neither good.json/wrong.json nor VALIDATION-NOTES.
//
// Compares ruler-grade against author-labeled expected grades from
// agent-outputs/mutations/expected-grades.json. A disagreement is either a ruler
// bug or a genuinely ambiguous mutation (drop and name in VALIDATION-NOTES §5).
//
// Done-criterion (RETROFIT-DESIGN-DECISIONS Q2): 100% agreement post-investigation
// across all grading dimensions, ≤1 mutation dropped. This runner reports the
// facts; the done-criterion call is Sid's.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import type { AgentOutput, GradeResult, Scenario } from "./types";
import { gradeOutput } from "./grade";
import { JUDGE_MODEL } from "./judges";

dotenv.config();

const here = dirname(fileURLToPath(import.meta.url));
const chunkRoot = resolve(here, "../..");

function loadJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(resolve(chunkRoot, relPath), "utf8")) as T;
}

function fmt(b: boolean): string {
  return b ? "PASS" : "FAIL";
}

interface ExpectedGrade {
  verdict: boolean;
  root_cause: boolean;
  criterion_1: boolean;
  criterion_2: boolean;
}

interface MutationEntry {
  file: string;
  axis: string;
  rationale: string;
  expected: ExpectedGrade;
}

interface Manifest {
  mutations: MutationEntry[];
}

const MUTATIONS_DIR = "agent-outputs/mutations";
const MANIFEST_PATH = `${MUTATIONS_DIR}/expected-grades.json`;

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key (see README).",
    );
    process.exit(1);
  }

  const scenario = loadJson<Scenario>("scenario.json");
  const manifest = loadJson<Manifest>(MANIFEST_PATH);
  const client = new Anthropic();

  console.log(
    `Grading ${manifest.mutations.length} mutations against scenario '${scenario.scenario_id}' ` +
      `with the unchanged chunk-1 ruler (gradeOutput + ${JUDGE_MODEL} judges).\n`,
  );

  type Row = {
    entry: MutationEntry;
    result: GradeResult;
    disagreements: (keyof ExpectedGrade)[];
  };

  const rows: Row[] = [];

  for (const entry of manifest.mutations) {
    const output = loadJson<AgentOutput>(`${MUTATIONS_DIR}/${entry.file}`);
    const result = await gradeOutput(client, scenario, output);
    const f = result.fields;
    const e = entry.expected;
    const disagreements: (keyof ExpectedGrade)[] = [];
    if (f.verdict !== e.verdict) disagreements.push("verdict");
    if (f.root_cause !== e.root_cause) disagreements.push("root_cause");
    if (f.criterion_1 !== e.criterion_1) disagreements.push("criterion_1");
    if (f.criterion_2 !== e.criterion_2) disagreements.push("criterion_2");
    rows.push({ entry, result, disagreements });
  }

  // Per-row line: actual fields, expected fields, AGREE/DISAGREE per dim.
  console.log(
    "─ Per-mutation grade vs. expected ─────────────────────────────────────────",
  );
  for (const { entry, result, disagreements } of rows) {
    const f = result.fields;
    const e = entry.expected;
    const mark = (k: keyof ExpectedGrade) =>
      f[k] === e[k] ? "·" : "✗"; // dot = agree, x = disagree
    console.log(
      `[${entry.file.padEnd(40)}] ` +
        `v=${fmt(f.verdict)}/${fmt(e.verdict)}${mark("verdict")}  ` +
        `rc=${fmt(f.root_cause)}/${fmt(e.root_cause)}${mark("root_cause")}  ` +
        `c1=${fmt(f.criterion_1)}/${fmt(e.criterion_1)}${mark("criterion_1")}  ` +
        `c2=${fmt(f.criterion_2)}/${fmt(e.criterion_2)}${mark("criterion_2")}  ` +
        (disagreements.length === 0
          ? "→ AGREE ✓"
          : `→ DISAGREE on ${disagreements.join(", ")} ✗`),
    );
  }

  // Summary: per-dim disagreement counts + overall rate.
  const total = rows.length * 4;
  const perDim: Record<keyof ExpectedGrade, number> = {
    verdict: 0,
    root_cause: 0,
    criterion_1: 0,
    criterion_2: 0,
  };
  for (const { disagreements } of rows) {
    for (const k of disagreements) perDim[k] += 1;
  }
  const totalDisagreements = Object.values(perDim).reduce((a, b) => a + b, 0);
  const rate = total === 0 ? 0 : (totalDisagreements / total) * 100;

  console.log("");
  console.log("─ Summary ─────────────────────────────────────────────────────────────────");
  console.log(`Total grading cells: ${total} (${rows.length} mutations × 4 dimensions)`);
  console.log(
    `Disagreements: ${totalDisagreements}  ` +
      `(verdict=${perDim.verdict}, root_cause=${perDim.root_cause}, ` +
      `criterion_1=${perDim.criterion_1}, criterion_2=${perDim.criterion_2})`,
  );
  console.log(`Disagreement rate: ${rate.toFixed(1)}%`);
  console.log(
    "Course reference (7.1.5): <10% is the rubric-disagreement target across human labelers. " +
      "Retrofit bar is stricter — 100% post-investigation, ≤1 mutation dropped (see RETROFIT-DESIGN-DECISIONS Q2).",
  );

  // Print judge reasoning ONLY for rows where a judge dimension disagreed —
  // makes "is this a ruler bug or a genuinely ambiguous mutation" easy to triage.
  const judgeDisagreements = rows.filter(
    (r) => r.disagreements.includes("criterion_1") || r.disagreements.includes("criterion_2"),
  );
  if (judgeDisagreements.length > 0) {
    console.log("");
    console.log("─ Judge reasoning on disagreeing rows (triage aid) ────────────────────────");
    for (const { entry, result, disagreements } of judgeDisagreements) {
      console.log(`\n[${entry.file}]  axis: ${entry.axis}`);
      if (disagreements.includes("criterion_1")) {
        console.log(
          `  c1 (mechanism) → ruler=${result.judgeRaw.criterion_1.answer}, expected=${entry.expected.criterion_1 ? "yes" : "no"}`,
        );
        console.log(`    reasoning: ${result.judgeRaw.criterion_1.reasoning}`);
      }
      if (disagreements.includes("criterion_2")) {
        console.log(
          `  c2 (reconciliation) → ruler=${result.judgeRaw.criterion_2.answer}, expected=${entry.expected.criterion_2 ? "yes" : "no"}`,
        );
        console.log(`    reasoning: ${result.judgeRaw.criterion_2.reasoning}`);
      }
    }
  }

  // Exit 0 if zero disagreements; otherwise 1 so CI / `npm run` signals a fail.
  // Sid's call whether to investigate-and-fix or drop a mutation.
  process.exit(totalDisagreements === 0 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
