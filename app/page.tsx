"use client";

import { useState } from "react";
import { DiagnosisInput } from "@/components/diagnosis-input";
import { DiagnosisOutput } from "@/components/diagnosis-output";
import { PreviousVerdictRow } from "@/components/previous-verdict-row";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useDiagnose } from "@/hooks/use-diagnose";
import type { DiagnosisOutput as DiagnosisOutputT } from "@/lib/schema";

type Previous = { query: string; verdict: DiagnosisOutputT["verdict"] };

export default function Home() {
  const [symptom, setSymptom] = useState("");
  // The query that produced the current result, and the prior result kept as a
  // slim row for "did rephrasing change anything" (UI-SPEC component 3).
  const [submitted, setSubmitted] = useState("");
  const [previous, setPrevious] = useState<Previous | null>(null);
  const diagnose = useDiagnose();

  function handleSubmit() {
    const query = symptom.trim();
    if (query.length === 0 || diagnose.isPending) return;
    // Demote the current result to "previous" before issuing the next one.
    if (diagnose.data) {
      setPrevious({ query: submitted, verdict: diagnose.data.verdict });
    }
    setSubmitted(query);
    diagnose.mutate(query);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-xl px-md py-2xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-h1Mobile leading-headingTight tracking-heading">
          Access diagnosis
        </h1>
        {/* FRAMING LINE — author-owned draft; rewrite. */}
        <p className="text-text-secondary">
          Describe an access problem in your workspace — who can&rsquo;t reach
          what — and this diagnoses the cause and shows its reasoning.
        </p>
      </header>

      <DiagnosisInput
        value={symptom}
        onChange={setSymptom}
        onSubmit={handleSubmit}
        disabled={diagnose.isPending}
      />

      {previous && (
        <PreviousVerdictRow query={previous.query} verdict={previous.verdict} />
      )}

      {/* Outcome region, driven by the mutation lifecycle. */}
      {diagnose.isPending ? (
        <LoadingState />
      ) : diagnose.isError ? (
        <ErrorState
          message={diagnose.error.message}
          onRetry={() => diagnose.mutate(submitted)}
        />
      ) : diagnose.data ? (
        <DiagnosisOutput output={diagnose.data} />
      ) : (
        <section className="rounded-lg border border-border bg-background-secondary p-lg text-text-secondary">
          <p>
            No diagnosis yet. Try the example above, or describe an access issue
            in your own words.
          </p>
        </section>
      )}
    </main>
  );
}
