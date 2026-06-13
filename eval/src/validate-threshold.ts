// SID-43 retrofit runner. Measures chunk-2's evidence-sufficiency threshold
// (0.21) against ten realistic paraphrases of the Seed-1 anchor symptom.
//
// Sibling-runner pattern (CHUNK2-DESIGN-DECISIONS Q17, applied again here):
// imports `retrieveRunbook` from the UNCHANGED chunk-2 `lib/retrieval.ts` and
// `SUFFICIENCY_THRESHOLD` from the UNCHANGED `lib/gate-signals.ts`. Does not
// modify chunk-2 code. The chunk-2 corpus embedding is loaded once (lazy +
// module-scope memoized cache, per CHUNK2-DESIGN-DECISIONS Q10) and reused
// across all ten mutations.
//
// MEASUREMENT-ONLY (RQ3 option A locked in CHUNK2-RETROFIT-DESIGN-DECISIONS):
// no pass/fail bar. The retrofit succeeds by honestly producing the score
// distribution and the false-escalate rate at the current calibration. The
// structural fix (HyDE query transformation, course ref Deepak 8.2.6) is
// chunk-7's job; this is the baseline against which chunk-7 will measure.
//
// INVOCATION: run from anywhere — the runner chdirs to the project root before
// importing chunk-2 modules. chunk-2's retrieval.ts builds its REFERENCE_LIBRARY_DIR
// and SCENARIO_PATH constants from process.cwd() at module load, so the chdir
// MUST happen before the dynamic imports below.
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
process.chdir(projectRoot);

// Dynamic imports AFTER chdir — see header comment.
const { retrieveRunbook } = (await import("../../lib/retrieval")) as {
  retrieveRunbook: (
    symptom: string,
  ) => Promise<{ source: string; snippet: string; score: number }[]>;
};
const { SUFFICIENCY_THRESHOLD, evaluateSufficiency } = (await import(
  "../../lib/gate-signals"
)) as {
  SUFFICIENCY_THRESHOLD: number;
  evaluateSufficiency: (topScore: number) => "pass" | "fail";
};

interface ManifestEntry {
  file: string;
  axis: string;
  rationale: string;
}

interface Manifest {
  anchor_symptom: string;
  anchor_score_measured: number;
  threshold: number;
  mutations: ManifestEntry[];
}

interface SymptomFile {
  symptom_id: string;
  text: string;
}

const MUTATIONS_DIR = "agent-outputs/symptom-mutations";
const MANIFEST_PATH = join(projectRoot, MUTATIONS_DIR, "manifest.json");

async function main(): Promise<void> {
  if (!process.env.VOYAGE_API_KEY) {
    console.error(
      "VOYAGE_API_KEY is not set. Add it to .env.local in the project root.",
    );
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;

  console.log("─ SID-43 — chunk-2 threshold calibration retrofit ─────────────────────────");
  console.log(`Anchor symptom score (measured 2026-06-12): ${manifest.anchor_score_measured.toFixed(4)}`);
  console.log(`Threshold (CHUNK2-DESIGN-DECISIONS Q13):    ${SUFFICIENCY_THRESHOLD.toFixed(2)}`);
  console.log(`Mutations to measure:                       ${manifest.mutations.length}`);
  console.log("");
  console.log("Embedding each mutation against runbook corpus (voyage-4-lite, lazy-cached)...");
  console.log("");

  type Row = {
    file: string;
    axis: string;
    symptom: string;
    score: number;
    verdict: "pass" | "fail";
  };
  const results: Row[] = [];

  for (const m of manifest.mutations) {
    const symptomFile = JSON.parse(
      readFileSync(join(projectRoot, MUTATIONS_DIR, m.file), "utf8"),
    ) as SymptomFile;
    const evidence = await retrieveRunbook(symptomFile.text);
    const topScore = evidence[0]?.score ?? 0;
    const verdict = evaluateSufficiency(topScore);
    results.push({
      file: m.file,
      axis: m.axis,
      symptom: symptomFile.text,
      score: topScore,
      verdict,
    });
  }

  // Per-mutation table
  console.log("─ Per-mutation scores ─────────────────────────────────────────────────────");
  for (const r of results) {
    const mark = r.verdict === "pass" ? "✓ clears" : "✗ FALSE ESCALATE";
    console.log(
      `[${r.file.padEnd(36)}] score=${r.score.toFixed(4)}  ${mark}`,
    );
    console.log(`    axis: ${r.axis}`);
  }

  // Summary stats
  const passing = results.filter((r) => r.verdict === "pass").length;
  const failing = results.length - passing;
  const falseRate = (failing / results.length) * 100;
  const scoresAsc = results.map((r) => r.score).sort((a, b) => a - b);
  const min = scoresAsc[0];
  const max = scoresAsc[scoresAsc.length - 1];
  const median = scoresAsc[Math.floor(scoresAsc.length / 2)];
  const mean = scoresAsc.reduce((a, b) => a + b, 0) / scoresAsc.length;

  console.log("");
  console.log("─ Summary ─────────────────────────────────────────────────────────────────");
  console.log(`Anchor (calibration) score:          ${manifest.anchor_score_measured.toFixed(4)}`);
  console.log(`Threshold:                           ${SUFFICIENCY_THRESHOLD.toFixed(2)}`);
  console.log(`Mutations measured:                  ${results.length}`);
  console.log(`Above threshold (sufficiency=pass):  ${passing} / ${results.length}`);
  console.log(`Below threshold (false-escalate):    ${failing} / ${results.length}`);
  console.log(`False-escalate rate at calibration:  ${falseRate.toFixed(1)}%`);
  console.log("");
  console.log(`Score distribution across mutations:`);
  console.log(`  min:     ${min.toFixed(4)}`);
  console.log(`  median:  ${median.toFixed(4)}`);
  console.log(`  mean:    ${mean.toFixed(4)}`);
  console.log(`  max:     ${max.toFixed(4)}`);
  console.log("");
  console.log(
    "Structural fix: HyDE query transformation (course ref Deepak 8.2.6) lands in chunk 7.",
  );
  console.log(
    "Re-running this same mutation set after chunk-7 HyDE gives a direct before/after.",
  );

  // Exit 0 — this is measurement, not pass/fail (RQ3 option A).
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
