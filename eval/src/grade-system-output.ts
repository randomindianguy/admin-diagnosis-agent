// Chunk-2 sibling runner (CHUNK2-DESIGN-DECISIONS Q17). Grades the diagnosis
// system's REAL Seed-1 output against the UNCHANGED chunk-1 ruler — same
// gradeOutput, same judges, same scenario expected_answer — via a separate entry
// point. Modifies no existing grader file; touches neither good.json nor
// VALIDATION-NOTES. Output mirrors chunk-1's validation log format exactly so the
// two logs read as one instrument.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import type { AgentOutput, Scenario } from "./types";
import { gradeOutput } from "./grade";
import { JUDGE_MODEL } from "./judges";

dotenv.config();

const here = dirname(fileURLToPath(import.meta.url));
const chunkRoot = resolve(here, "../.."); // Project/

function loadJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(resolve(chunkRoot, relPath), "utf8")) as T;
}

function fmt(b: boolean): string {
  return b ? "PASS" : "FAIL";
}

const SYSTEM_OUTPUT_PATH = "agent-outputs/seed-1-system-output.json";

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key (see README).",
    );
    process.exit(1);
  }

  const scenario = loadJson<Scenario>("scenario.json");
  const output = loadJson<AgentOutput>(SYSTEM_OUTPUT_PATH);
  const client = new Anthropic();

  console.log(
    `Grading ${SYSTEM_OUTPUT_PATH} against scenario '${scenario.scenario_id}' ` +
      `with the unchanged chunk-1 ruler (gradeOutput + ${JUDGE_MODEL} judges):\n`,
  );

  const result = await gradeOutput(client, scenario, output);
  const f = result.fields;
  const pass = f.verdict && f.root_cause && f.criterion_1 && f.criterion_2;
  const tag = pass ? "RULER PASSES ✓" : "RULER FAILS ✗";

  console.log(
    `[${"good".padEnd(5)}] verdict=${fmt(f.verdict)}  root_cause=${fmt(f.root_cause)}  ` +
      `criterion_1=${fmt(f.criterion_1)}  criterion_2=${fmt(f.criterion_2)}  →  ${tag}`,
  );

  console.log("\nJudge reasoning (supplementary — captured, not graded):");
  console.log(
    `- criterion_1 (mechanism) → ${result.judgeRaw.criterion_1.answer}: ${result.judgeRaw.criterion_1.reasoning}`,
  );
  console.log(
    `- criterion_2 (reconciliation) → ${result.judgeRaw.criterion_2.answer}: ${result.judgeRaw.criterion_2.reasoning}`,
  );

  console.log("");
  if (pass) {
    console.log("Done-criterion: system output PASSES the chunk-1 ruler ✓");
    process.exit(0);
  }
  console.log(
    "Done-criterion: NOT satisfied — the system output failed the ruler. Fix the system, not the ruler.",
  );
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
