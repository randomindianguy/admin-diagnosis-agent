// SID chunk-3 runner — the out-of-scope refusal test (scope C, revised per Q5).
//
// Sibling-runner pattern (CHUNK2-DESIGN-DECISIONS Q17, reused in SID-43 and here):
// imports the UNCHANGED chunk-2/3 lib (`lib/retrieval.ts`, `lib/diagnosis.ts`) and
// does not modify them. It calls `diagnose()` DIRECTLY rather than going through
// /api/diagnose — that bypasses `lib/gate-signals.ts`, which still carries the
// step-1 union-widening errors (deferred to step 3.5). The refuse boundary is a
// property of the model's tool choice, so the single-shot diagnose() call is
// sufficient to grade it; the consistency gate is not on the critical path here.
//
// GRADING (binary, per the Q5 lock): the only thing graded is the refuse boundary.
//   actual_refuse  = (judgment.verdict === "refuse_out_of_scope")
//   expected_refuse = manifest field per item
// resolve-vs-escalate among in-scope items is NOT graded (the manifest's
// _labeling_note explains why three-way grading was dropped).
//
// DONE-CRITERION (three bars, asymmetric):
//   clear-OOS recall          (a01)                100%  — all must refuse
//   in-scope refuse-precision  (a02 + m01-m06, m12) ≤1 false-refuse across 8
//   borderline-OOS recall      (a03 + m07-m11)      ≤1 false-clear across 6
//
// NFR baseline (this step adds it): per-item + total wall-clock, latency
// distribution, and the architectural LLM-call counts. SID-42 close named
// NFR-not-measured as a real gap; chunk 3 establishes the reference point that
// chunks 4-7 measure against.
//
// INVOCATION: run from anywhere — chdir to project root BEFORE the dynamic imports,
// because lib/retrieval.ts builds REFERENCE_LIBRARY_DIR / SCENARIO_PATH from
// process.cwd() at module load.
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Correct from the start — SID-43's `.env`-vs-`.env.local` dotenv bug stays
// deferred, but new code does not repeat it.
dotenv.config({ path: ".env.local" });

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
process.chdir(projectRoot);

// Dynamic imports AFTER chdir — see header.
const { retrieveContext } = (await import("../../lib/retrieval")) as {
  retrieveContext: (symptom: string) => Promise<unknown>;
};
const { diagnose } = (await import("../../lib/diagnosis")) as {
  diagnose: (
    symptom: string,
    context: unknown,
    options?: { temperature?: number },
  ) => Promise<{ verdict: string; root_cause?: string; owner?: string; diagnosis_text?: string }>;
};

// --- Manifest shape ----------------------------------------------------------

interface ManifestItem {
  file: string;
  expected_refuse: boolean;
  boundary_axis: string;
  persona: string;
  rationale: string;
}
interface Manifest {
  anchors: ManifestItem[];
  mutations: {
    borderline_in_scope: ManifestItem[];
    borderline_oos: ManifestItem[];
  };
}
interface SymptomFile {
  symptom_id: string;
  text: string;
}

const MUTATIONS_DIR = "agent-outputs/scope-mutations";
const MANIFEST_PATH = join(projectRoot, MUTATIONS_DIR, "manifest.json");

// Which done-criterion bar each item belongs to.
type Bar = "clear_oos" | "in_scope" | "oos";

function barForAnchor(item: ManifestItem): Bar {
  if (item.boundary_axis.toLowerCase().startsWith("clear-oos")) return "clear_oos";
  return item.expected_refuse ? "oos" : "in_scope";
}

interface Row {
  id: string;
  bar: Bar;
  symptom: string;
  expected_refuse: boolean;
  actual_refuse: boolean;
  verdict: string;
  detail: string; // root_cause / owner / diagnosis_text for triage
  agree: boolean;
  latencyMs: number;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Add it to .env.local in the project root.");
    process.exit(1);
  }
  if (!process.env.VOYAGE_API_KEY) {
    console.error("VOYAGE_API_KEY is not set. Add it to .env.local in the project root.");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;

  // Flatten into one ordered worklist, tagged with its bar.
  const worklist: { item: ManifestItem; bar: Bar }[] = [
    ...manifest.anchors.map((item) => ({ item, bar: barForAnchor(item) })),
    ...manifest.mutations.borderline_in_scope.map((item) => ({ item, bar: "in_scope" as Bar })),
    ...manifest.mutations.borderline_oos.map((item) => ({ item, bar: "oos" as Bar })),
  ];

  console.log("─ SID chunk-3 — out-of-scope refusal test (scope C) ────────────────────────");
  console.log(`Items: ${worklist.length}   Grading: binary refuse vs not-refuse`);
  console.log("Calling diagnose() directly (bypasses gate-signals.ts; consistency gate off path).");
  console.log("");

  const rows: Row[] = [];
  const runStart = performance.now();

  for (const { item, bar } of worklist) {
    const symptomFile = JSON.parse(
      readFileSync(join(projectRoot, MUTATIONS_DIR, item.file), "utf8"),
    ) as SymptomFile;
    const context = await retrieveContext(symptomFile.text);

    const t0 = performance.now();
    const judgment = await diagnose(symptomFile.text, context);
    const latencyMs = performance.now() - t0;

    const actual_refuse = judgment.verdict === "refuse_out_of_scope";
    const detail =
      judgment.verdict === "refuse_out_of_scope"
        ? "(refuse — no diagnosis_text; authored scope-perimeter copy shown to user)"
        : [
            judgment.root_cause ? `root_cause=${judgment.root_cause}` : "",
            judgment.owner ? `owner=${judgment.owner}` : "",
            judgment.diagnosis_text ? `\n      ${judgment.diagnosis_text}` : "",
          ]
            .filter(Boolean)
            .join(" ");

    rows.push({
      id: symptomFile.symptom_id,
      bar,
      symptom: symptomFile.text,
      expected_refuse: item.expected_refuse,
      actual_refuse,
      verdict: judgment.verdict,
      detail,
      agree: actual_refuse === item.expected_refuse,
      latencyMs,
    });
  }

  const totalRunMs = performance.now() - runStart;

  // --- Per-item table --------------------------------------------------------
  console.log("─ Per-item results ─────────────────────────────────────────────────────────");
  for (const r of rows) {
    const mark = r.agree ? "AGREE" : "DISAGREE";
    console.log(
      `[${r.id.padEnd(34)}] expected_refuse=${String(r.expected_refuse).padEnd(5)} ` +
        `actual=${String(r.actual_refuse).padEnd(5)} → ${mark}  (${r.latencyMs.toFixed(0)}ms)`,
    );
  }

  // --- Disagreement triage aid ----------------------------------------------
  const disagreements = rows.filter((r) => !r.agree);
  if (disagreements.length) {
    console.log("");
    console.log("─ Disagreements (triage per SID-42 Q8: ruler / mutation-design / genuinely ambiguous) ─");
    for (const r of disagreements) {
      console.log(`[${r.id}]  expected_refuse=${r.expected_refuse}  actual verdict=${r.verdict}`);
      console.log(`    symptom: ${r.symptom}`);
      console.log(`    model:   ${r.detail}`);
    }
  }

  // --- Done-criterion bars ---------------------------------------------------
  const clearOos = rows.filter((r) => r.bar === "clear_oos");
  const inScope = rows.filter((r) => r.bar === "in_scope");
  const oos = rows.filter((r) => r.bar === "oos");

  const clearOosRefused = clearOos.filter((r) => r.actual_refuse).length;
  const clearOosRecall = (clearOosRefused / clearOos.length) * 100;
  const clearOosPass = clearOosRefused === clearOos.length; // 100% required

  const falseRefuse = inScope.filter((r) => r.actual_refuse).length; // wrongly refused in-scope
  const inScopePass = falseRefuse <= 1;
  const inScopePrecision = ((inScope.length - falseRefuse) / inScope.length) * 100;

  const oosRefused = oos.filter((r) => r.actual_refuse).length;
  const falseClear = oos.length - oosRefused; // OOS wrongly handled
  const oosRecall = (oosRefused / oos.length) * 100;
  const oosPass = falseClear <= 1;

  console.log("");
  console.log("─ Done-criterion ───────────────────────────────────────────────────────────");
  console.log(
    `refuse_recall_clear_oos            ${clearOosRecall.toFixed(0)}%  (${clearOosRefused}/${clearOos.length} refused)   ` +
      `bar=100%  → ${clearOosPass ? "PASS" : "FAIL"}`,
  );
  console.log(
    `refuse_precision_borderline_in_scope ${inScopePrecision.toFixed(1)}%  (${falseRefuse} false-refuse / ${inScope.length})   ` +
      `bar=≤1 false-refuse  → ${inScopePass ? "PASS" : "FAIL"}`,
  );
  console.log(
    `refuse_recall_borderline_oos       ${oosRecall.toFixed(1)}%  (${falseClear} false-clear / ${oos.length})   ` +
      `bar=≤1 false-clear  → ${oosPass ? "PASS" : "FAIL"}`,
  );

  // --- NFR baseline ----------------------------------------------------------
  const latencies = rows.map((r) => r.latencyMs);
  console.log("");
  console.log("─ NFR baseline (chunk-3 reference point for chunks 4-7) ─────────────────────");
  console.log("LLM-call counts — ARCHITECTURAL (full system), not measured by this runner:");
  console.log("  Anthropic calls:    45   (15 items × 3 self-consistency samples)");
  console.log("  Voyage embeddings:  15   (1 query embedding per diagnosis)");
  console.log("  Counts are architectural — instrument the SDK if exact retry/token data needed later.");
  console.log("  Honesty note: this runner bypasses the consistency gate (single-shot diagnose), so it");
  console.log(`  actually executed ${rows.length} Anthropic calls + ${rows.length} query embeds (+1 cached corpus embed).`);
  console.log("");
  console.log("Wall-clock:");
  console.log(`  total run:    ${(totalRunMs / 1000).toFixed(1)}s`);
  console.log(`  per-diagnose: min ${Math.min(...latencies).toFixed(0)}ms  median ${median(latencies).toFixed(0)}ms  ` +
    `mean ${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0)}ms  max ${Math.max(...latencies).toFixed(0)}ms`);

  const allPass = clearOosPass && inScopePass && oosPass;
  console.log("");
  console.log(`─ Result: ${allPass ? "ALL BARS CLEARED" : "BAR(S) MISSED — see above; Q2 reopen trigger may fire"} ─`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
