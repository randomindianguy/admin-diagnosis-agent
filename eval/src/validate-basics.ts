// SID-85 basics runner — files the 40 basics-tier cases (10 seeds + 30 paraphrases,
// all verified live) into runnable form so `npm run validate:basics` produces real
// numbers. Touches no existing eval file; mirrors validate-robustness.ts's structure.
//
// TWO deliberate deviations from validate-robustness.ts, both to reproduce the exact
// conditions the cases were LOCKED under:
//   1. SUBJECT = demo.user (not the scenario default alex.chen). The cases were
//      authored + verified for the first-visit demo.user persona, which is in NO
//      groups — so retrieveContext() is called WITH personaUserId "user:demo.user".
//   2. GATED 3-sample path. Robustness calls diagnose() single-shot; basics was
//      verified via the gated /api/diagnose path (runGatedDiagnosis = 3-sample
//      self-consistency + applyGate), so this runner uses the SAME gated call to
//      reproduce the file-backed number faithfully.
//
// GRADING: binary per case — PASS iff verdict ∈ expected_verdicts. PHASE 1 validates
// each grader against a synthetic good output (must PASS) and the case's bad_verdict
// (must FAIL); if any grader can't discriminate, the run aborts. This runner MEASURES;
// exit code reflects ruler health only, never the pass rate.

import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
// Load the ROOT .env.local by absolute path — robust to the invocation cwd
// (npm scripts run from eval/, so a bare ".env.local" would miss the root file).
dotenv.config({ path: resolve(projectRoot, ".env.local") });
process.chdir(projectRoot);

// Dynamic imports AFTER chdir — lib/retrieval.ts builds its paths from process.cwd().
const { retrieveContext } = (await import("../../lib/retrieval")) as {
  retrieveContext: (symptom: string, personaUserId?: string) => Promise<unknown>;
};
const { runGatedDiagnosis } = (await import("../../lib/gate-signals")) as {
  runGatedDiagnosis: (
    symptom: string,
    context: unknown,
  ) => Promise<{
    verdict: string;
    root_cause?: string;
    owner?: string;
    refuse_reason?: string;
    diagnosis_text?: string;
  }>;
};

// The basics tier runs as the first-visit landing persona (zero groups).
const SUBJECT_PERSONA = "user:demo.user";

// --- Manifest shape (single file; same case schema as robustness) ------------

interface Case {
  id: string;
  text: string;
  expected_verdicts: string[];
  bad_verdict: string;
  axis: string;
  rationale: string;
}
interface Manifest {
  _tier: string;
  cases: Case[];
}

const MANIFEST_PATH = "agent-outputs/basics/manifest.json";

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(join(projectRoot, MANIFEST_PATH), "utf8")) as Manifest;
}

// The grader, isolated so PHASE 1 can validate the SAME function the live run uses.
function grade(verdict: string, expected: string[]): boolean {
  return expected.includes(verdict);
}

interface Row {
  id: string;
  axis: string;
  expected: string[];
  verdict: string;
  pass: boolean;
  detail: string;
  latencyMs: number;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main(): Promise<void> {
  for (const key of ["ANTHROPIC_API_KEY", "VOYAGE_API_KEY"]) {
    if (!process.env[key]) {
      console.error(`${key} is not set. Add it to .env.local in the project root.`);
      process.exit(1);
    }
  }

  const manifest = loadManifest();

  // ── PHASE 1 — grader self-validation (no API) ──────────────────────────────
  console.log("─ PHASE 1 — grader validation (synthetic good/bad; no API) ──────────────────");
  let rulerBroken = false;
  for (const c of manifest.cases) {
    const good = grade(c.expected_verdicts[0], c.expected_verdicts); // must be true
    const bad = grade(c.bad_verdict, c.expected_verdicts); // must be false
    if (!(good && !bad)) {
      rulerBroken = true;
      console.log(
        `  [${c.id}] RULER BROKEN ✗  good(${c.expected_verdicts[0]})=${good}  bad(${c.bad_verdict})=${bad}`,
      );
    }
  }
  if (rulerBroken) {
    console.log("\nGrader validation FAILED — a ruler does not discriminate. Fix the manifest before trusting any live result.");
    process.exit(1);
  }
  console.log(`  All ${manifest.cases.length} graders discriminate (good→PASS, bad→FAIL). Rulers trusted.\n`);

  // ── PHASE 2 — live run ─────────────────────────────────────────────────────
  console.log(`─ PHASE 2 — live run (${SUBJECT_PERSONA} subject; gated 3-sample diagnose) ──────`);
  const rows: Row[] = [];
  const runStart = performance.now();

  for (const c of manifest.cases) {
    const context = await retrieveContext(c.text, SUBJECT_PERSONA);
    const t0 = performance.now();
    const j = await runGatedDiagnosis(c.text, context);
    const latencyMs = performance.now() - t0;

    const pass = grade(j.verdict, c.expected_verdicts);
    const detail = [
      j.root_cause ? `root_cause=${j.root_cause}` : "",
      j.refuse_reason ? `refuse_reason=${j.refuse_reason}` : "",
      j.owner ? `owner=${j.owner}` : "",
      j.diagnosis_text ? `text="${j.diagnosis_text.replace(/\s+/g, " ").slice(0, 200)}"` : "",
    ]
      .filter(Boolean)
      .join("  ");

    rows.push({ id: c.id, axis: c.axis, expected: c.expected_verdicts, verdict: j.verdict, pass, detail, latencyMs });
    console.log(
      `  [${c.id.padEnd(38)}] expected={${c.expected_verdicts.join("|")}}  got=${j.verdict.padEnd(20)} → ${pass ? "PASS" : "FAIL"}  (${latencyMs.toFixed(0)}ms)`,
    );
  }
  const totalRunMs = performance.now() - runStart;

  // ── Tier score ───────────────────────────────────────────────────────────
  const passed = rows.filter((r) => r.pass).length;
  console.log("\n─ Tier score ────────────────────────────────────────────────────────────────");
  console.log(`  ${manifest._tier.padEnd(12)} ${passed}/${rows.length}`);

  // ── Failures (full detail for root-cause classification) ───────────────────
  const failures = rows.filter((r) => !r.pass);
  if (failures.length) {
    console.log("\n─ Failures (classify each: grader-insufficient / prompt-insufficient / architectural-gap) ─");
    for (const r of failures) {
      console.log(`  [${r.id}]  axis=${r.axis}`);
      console.log(`     expected={${r.expected.join("|")}}  got=${r.verdict}`);
      console.log(`     ${r.detail}`);
    }
  } else {
    console.log("\n  No failures.");
  }

  // ── NFR ────────────────────────────────────────────────────────────────────
  const latencies = rows.map((r) => r.latencyMs);
  console.log("\n─ NFR ──────────────────────────────────────────────────────────────────────");
  console.log(`  total run: ${(totalRunMs / 1000).toFixed(1)}s   per-diagnose: min ${Math.min(...latencies).toFixed(0)}ms  median ${median(latencies).toFixed(0)}ms  max ${Math.max(...latencies).toFixed(0)}ms`);
  console.log(`  (gated 3-sample: ${rows.length} cases × self-consistency samples + ${rows.length} query embeds)`);

  console.log("\n─ Done — rulers healthy; pass rate above is the measurement, not a gate. ─");
  process.exit(0); // exit reflects ruler health (PHASE 1), never the pass rate
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
