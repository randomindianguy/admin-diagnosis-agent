"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DiagnosisInput } from "@/components/diagnosis-input";
import { EndUserCard } from "@/components/end-user-card";
import { ApprovalResultCard } from "@/components/approval-result-card";
import { ThreadDivider } from "@/components/thread-divider";
import { UserBubble } from "@/components/user-bubble";
import { ErrorState } from "@/components/error-state";
import { TicketFeed } from "@/components/ticket-feed";
import { TicketDetail, type LiveTrace } from "@/components/ticket-detail";
import { PersonaToggle, type PersonaView } from "@/components/persona-toggle";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { GitHubIcon } from "@/components/icons";
import { AboutPanel } from "@/components/about-panel";
import { usePipelineSchedule } from "@/hooks/use-pipeline-schedule";
import { HelpCircle, Info, RotateCcw } from "lucide-react";
import { runWalkthrough, WALKTHROUGH_KEY } from "@/lib/walkthrough";
import "driver.js/dist/driver.css";
import { useDiagnose } from "@/hooks/use-diagnose";
import { useTraceReveal } from "@/hooks/use-trace-reveal";
import {
  useSubmissions,
  makeId,
  type Turn,
  type Requester,
  type Submission,
} from "@/lib/store";
import { lastAgentOutput } from "@/lib/submission";
import { MethodologyView } from "@/components/methodology-view";
import { PERSONAS, DEMO_USER } from "@/lib/seed-submissions";

const REPO_URL = "https://github.com/randomindianguy/admin-diagnosis-agent";

// Admin reasoning trace = 7 steps (Scope check leads). Reveal mounts rows over
// ~3.5s; on resolve the values swap in (staggered); the card un-gates when the
// trace signals it's settled (SID-50).
const TOTAL_TRACE_ROWS = 7;

// SID-84 — five end-user scenarios, ORDERED + COLOR-GROUPED by the verdict each
// reliably triggers for the Demo User landing persona (resolve → escalate → refuse),
// so the verdict taxonomy reads top-to-bottom before the visitor clicks anything.
// Each chip is tinted with its target verdict's badge color (verdict-pill palette).
// Note: the palette has three tones — "Needs detail" and "Refused" both render in
// the `refuse` tone, so both refuse-family chips share it. All five verdicts were
// verified live against the current workspace state. Click pre-fills the input
// (no auto-submit) and resets any conversation.
type ChipTone = "resolve" | "escalate" | "refuse";

const SCENARIOS: { label: string; query: string; tone: ChipTone }[] = [
  {
    // resolve — owner-controlled, route to owner (resource_owner_routing). The only
    // resolve reachable for a zero-group persona (others are group-gated → escalate).
    label: "I can't open the Q3 strategy plan",
    query: "I can't open the Q3 strategy plan.",
    tone: "resolve",
  },
  {
    // escalate — onboarding provisioning gap (route to identity team)
    label: "New hire needs the data warehouse",
    query:
      "I joined the analytics team last week and need access to the data warehouse dashboards.",
    tone: "escalate",
  },
  {
    // escalate — role transition, lost access (provisioning gap)
    label: "I changed roles last week and lost access to marketing folders",
    query: "I changed roles last week and lost access to marketing folders.",
    tone: "escalate",
  },
  {
    // refuse · needs detail — intent too vague to ground (intent_ambiguity)
    label: "Things are broken",
    query: "Things are broken.",
    tone: "refuse",
  },
  {
    // refuse · out of scope — policy question, not an access diagnosis
    label: "What's the company holiday policy?",
    query: "What's the company holiday policy?",
    tone: "refuse",
  },
];

// Chip tint per verdict tone — mirrors the verdict-pill badge palette (same color
// tokens + opacities) so the colors a visitor learns here reinforce on the admin
// badges. Subtle: tinted border + low-opacity fill, neutral text that brightens on
// hover (the existing hover behaviour, kept identity-preserving rather than going
// neutral-bordered on hover).
const CHIP_TONE: Record<ChipTone, string> = {
  resolve:
    "border-verdict-resolve/40 bg-verdict-resolve/10 hover:bg-verdict-resolve/[0.15]",
  escalate:
    "border-verdict-escalate/40 bg-verdict-escalate/10 hover:bg-verdict-escalate/[0.15]",
  refuse:
    "border-verdict-refuse/50 bg-verdict-refuse/10 hover:bg-verdict-refuse/[0.15]",
};

// Scenario chips — empty-state suggestions. Click resets any conversation and
// pre-fills the input (no auto-submit).
function ScenarioChips({
  onPick,
  disabled,
}: {
  onPick: (query: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-xs">
      {SCENARIOS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onPick(s.query)}
          disabled={disabled}
          className={`inline-flex min-h-[44px] items-center rounded-md border px-md py-xs text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50 ${CHIP_TONE[s.tone]}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [symptom, setSymptom] = useState("");
  // The query that produced the current result (kept for the live retry path).
  const [submitted, setSubmitted] = useState("");
  const [personaView, setPersonaView] = useState<PersonaView>("end-user");
  const [aboutOpen, setAboutOpen] = useState(false); // SID-76: about-this-demo modal
  // SID-82: visitor-triggered demo reset. `resetting` disables the button during
  // the ~3s Okta round-trip; `resetToast` is the inline confirmation/error line.
  const [resetting, setResetting] = useState(false);
  const [resetToast, setResetToast] = useState<string | null>(null);
  // End-user portal (SID-68): which persona is "me", and which past ticket of
  // theirs is open (read-only). Local UI state — the store + admin stay untouched.
  // SID-71: Demo User is the default landing persona — a fresh, empty portal that
  // sets up the headline closed-loop story for first-time reviewers.
  const [currentPersona, setCurrentPersona] = useState<Requester>(DEMO_USER);
  const [pastSelectedId, setPastSelectedId] = useState<string | null>(null);
  // The id for the in-flight agent turn. Minted at submit and reused when the
  // turn is archived, so the loading card and the settled card share a key and
  // morph in place (SID-59). Non-null === a request is in flight / awaiting.
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  // Trace reveal counters (SID-50): submitKey drives row MOUNT; resolveKey the
  // value SWAP after the API resolves.
  const [submitKey, setSubmitKey] = useState(0);
  const [resolveKey, setResolveKey] = useState(0);
  const [traceSettled, setTraceSettled] = useState(false);
  const revealedRowCount = useTraceReveal(submitKey, TOTAL_TRACE_ROWS);
  const swappedRowCount = useTraceReveal(resolveKey, TOTAL_TRACE_ROWS, 150);
  // SID-90-revise: mock pipeline reveal — keyed off submitKey so the 5 tiles animate
  // DURING the diagnose wait (the timeline IS the loading state), holding at the
  // verdict tile until the real response lands. Page-side so it survives the
  // pending→settled card swap. Reduced-motion jumps straight to fully revealed.
  const timelineRevealed = usePipelineSchedule(submitKey);
  const handleSettled = useCallback(() => setTraceSettled(true), []);
  const diagnose = useDiagnose();

  // Shared submissions store. End-user drives the ACTIVE conversation; the admin
  // feed reads the full list + a selected ticket (SID-63).
  const submissions = useSubmissions((s) => s.submissions);
  const activeId = useSubmissions((s) => s.activeId);
  const selectedId = useSubmissions((s) => s.selectedId);
  const startSubmission = useSubmissions((s) => s.startSubmission);
  const addUserTurn = useSubmissions((s) => s.addUserTurn);
  const addAgentTurn = useSubmissions((s) => s.addAgentTurn);
  const resetStore = useSubmissions((s) => s.reset);
  const seed = useSubmissions((s) => s.seed);
  const reseed = useSubmissions((s) => s.reseed);
  const selectTicket = useSubmissions((s) => s.selectTicket);
  const markAllSeen = useSubmissions((s) => s.markAllSeen);
  const markDecisionsSeen = useSubmissions((s) => s.markDecisionsSeen);

  const active = submissions.find((s) => s.id === activeId) ?? null;
  const turns = active?.turns ?? [];
  // SID-90-revise: the pipeline timeline renders only on the LIVE/current answer.
  // For a settled turn that's the last agent turn AND nothing is in flight, that's
  // the current final answer; while a request is pending, the pending card is live.
  const lastAgentTurnId = [...turns].reverse().find((t) => t.role === "agent")?.id;
  const openActiveInAdmin = () => {
    if (active) selectTicket(active.id);
    handlePersonaChange("admin");
  };
  // SID-91: the end-user verdict CTA now pivots to Methodology (the middle act),
  // carrying the active ticket as context; Methodology's own CTA goes on to Admin.
  const openActiveInMethodology = () => {
    if (active) selectTicket(active.id);
    handlePersonaChange("methodology");
  };

  // End-user portal (SID-68): this persona's own tickets for the left rail, the
  // open past ticket, and whether a detail/active view is showing (mobile drill-in).
  const personaSubs = submissions.filter(
    (s) => s.requester.name === currentPersona.name,
  );
  const pastSub = submissions.find((s) => s.id === pastSelectedId) ?? null;
  const mobileDetailOpen = !!active || !!pastSub;
  // SID-69: minutes between the original request and its continuation, for the
  // "— N min later" divider in a past ticket's read-only thread.
  const pastGapMin =
    pastSub?.follow_up_turns?.[0]?.at != null
      ? Math.round((pastSub.follow_up_turns[0].at - pastSub.createdAt) / 60_000)
      : null;

  // SID-75: the approval payoff as a SEPARATE card below the escalate "Submitted"
  // card (which no longer mutates). Renders for a terminal add_to_group escalate,
  // under a ThreadDivider labelled by the submit→decision gap ("just now" live).
  const approvalResultBlock = (sub: Submission | null) => {
    if (!sub || (sub.status !== "approved" && sub.status !== "denied")) return null;
    const out = lastAgentOutput(sub);
    if (out?.verdict !== "escalate" || out.approval_action?.type !== "add_to_group") {
      return null;
    }
    const gapMin = sub.decidedAt
      ? Math.round((sub.decidedAt - sub.createdAt) / 60_000)
      : 0;
    const label = gapMin < 1 ? "just now" : `${gapMin} min later`;
    return (
      <>
        <ThreadDivider label={label} />
        <ApprovalResultCard output={out} status={sub.status} />
      </>
    );
  };

  // `now` anchors the "X ago" timestamps. Computed once via a lazy initializer
  // (not setState-in-effect); only ever read once the admin feed renders, which
  // is client-only (personaView defaults to end-user), so no SSR time mismatch.
  const [now] = useState(() => Date.now());
  // Pre-seed the demo tickets once on mount (zustand action, guarded internally).
  useEffect(() => {
    seed();
  }, [seed]);

  const unseenCount = submissions.filter((s) => !s.seen).length;
  // SID-75: terminal decisions the end user hasn't seen yet → End User tab indicator.
  const endUserUnseenCount = submissions.filter(
    (s) => (s.status === "approved" || s.status === "denied") && s.decisionSeen === false,
  ).length;
  const selectedSub = submissions.find((s) => s.id === selectedId) ?? null;
  // SID-91: the verdict the Methodology view anchors on — the ACTIVE conversation's
  // latest verdict, i.e. one the visitor produced THIS session. Seeded/admin-selected
  // history doesn't count (the store pre-seeds selectedId for the admin feed), so we
  // read `active` only. Null → empty (aerial) state.
  const methodologyOutput = active ? lastAgentOutput(active) : null;
  // The selected ticket is "live" only while it's the active conversation still
  // being diagnosed — then the trace animates (SID-59) and the package gates.
  const selectedIsLive =
    !!selectedSub && selectedSub.id === activeId && pendingAgentId !== null;

  // Switching to a view clears that view's indicator: Admin → new tickets seen,
  // End user → decisions seen (SID-75).
  const handlePersonaChange = (next: PersonaView) => {
    setPersonaView(next);
    // Clear the relevant unseen indicator; Methodology has none (no side effect).
    if (next === "admin") markAllSeen();
    else if (next === "end-user") markDecisionsSeen();
  };

  // Auto-scroll the transcript to the newest turn as the conversation grows.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeId) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turns.length, pendingAgentId, activeId]);

  // Issue a diagnosis. Archive the agent turn (and bump the swap reveal) in the
  // mutation's onSuccess — the idiomatic place, so no setState-in-effect.
  const runDiagnose = useCallback(
    (query: string, agentId: string) => {
      setTraceSettled(false);
      setSubmitKey((k) => k + 1);
      // SID-80: read the active submission id straight from the store — the closure's
      // `activeId` can be a render behind a just-created submission. Threaded as
      // ticketId so the server groups logged queries by ticket (storage-only).
      const ticketId = useSubmissions.getState().activeId ?? undefined;
      // SID-70: reason against the active persona's real Okta identity.
      diagnose.mutate(
        { symptom: query, personaUserId: currentPersona.userId, ticketId },
        {
          onSuccess: (output) => {
            addAgentTurn(output, agentId);
            setPendingAgentId(null);
            setResolveKey((k) => k + 1);
          },
        },
      );
    },
    [diagnose, addAgentTurn, currentPersona.userId],
  );

  // Live trace state for the in-flight selected ticket (after runDiagnose so the
  // retry closure can reference it).
  const live: LiveTrace | undefined = selectedIsLive
    ? {
        output: diagnose.data ?? null,
        isError: diagnose.isError,
        errorMessage: diagnose.error?.message,
        onRetry: () => runDiagnose(submitted, pendingAgentId!),
        revealedRowCount,
        swappedRowCount,
        onSettled: handleSettled,
        packageReady: traceSettled,
      }
    : undefined;

  function handleSubmit(text: string) {
    const q = text.trim();
    if (q.length === 0 || diagnose.isPending) return;

    // If the last agent turn was a clarifying refuse, this message is the
    // clarification — stitch it WITH the original so retrieval + the model see
    // the combined context (SID-62 Q2; backend stays single-shot).
    const agentTurns = turns.filter(
      (t): t is Extract<Turn, { role: "agent" }> => t.role === "agent",
    );
    const lastAgent = agentTurns[agentTurns.length - 1];
    const inRefuseLoop =
      lastAgent?.output.verdict === "refuse_out_of_scope" &&
      lastAgent.output.refuse_reason !== "out_of_scope";

    let query = q;
    if (inRefuseLoop && active) {
      const firstUser = active.turns.find(
        (t): t is Extract<Turn, { role: "user" }> => t.role === "user",
      );
      query = `Original request: "${firstUser?.text ?? ""}" Clarification: "${q}"`;
    }

    if (!active) startSubmission(currentPersona, q);
    else addUserTurn(q);

    const agentId = makeId("agent");
    setPastSelectedId(null); // leaving any past view → this becomes the active one
    setPendingAgentId(agentId);
    setSubmitted(query);
    setSymptom(""); // clear input on submit (standard chat behavior)
    runDiagnose(query, agentId);
  }

  // Reset to the compose state. The submission persists in the store's feed (the
  // live-ingestion seam SID-63 reads, and the SID-68 rail's "Recent") — only the
  // active + past pointers clear. Doubles as the rail "New request" and mobile back.
  function handleReset() {
    resetStore();
    diagnose.reset();
    setPendingAgentId(null);
    setPastSelectedId(null);
    setSymptom("");
    setSubmitted("");
    setTraceSettled(false);
  }

  // Chip click doubles as "start over from here": reset, then pre-fill.
  function handlePickChip(query: string) {
    handleReset();
    setSymptom(query);
  }

  // SID-68: switch the logged-in persona — swaps the rail and clears the right
  // pane to compose (a fresh session as that person).
  function handleSelectPersona(p: Requester) {
    setCurrentPersona(p);
    handleReset();
  }

  // SID-68: open one of this persona's past tickets, read-only. Leaves any active
  // conversation (it persists in the feed) and shows the selected ticket.
  function handleSelectPast(id: string) {
    resetStore();
    diagnose.reset();
    setPendingAgentId(null);
    setTraceSettled(false);
    setPastSelectedId(id);
  }

  // SID-71: launch the orientation tour. Force the End-User compose state first so
  // every step's target is in the DOM (edge case: tour fired from Admin or mid-
  // conversation). Used by the first-visit auto-fire and the Help button.
  // SID-81: set the "seen" flag here, on OPEN — this is the single open path for
  // both the auto-fire and the Help button. Setting it on open (not on dismiss)
  // means a mid-tour refresh can't re-trigger it; the Help button stays ungated
  // and re-opens regardless of flag state.
  function launchTour() {
    try {
      localStorage.setItem(WALKTHROUGH_KEY, "1");
    } catch {
      // private mode / storage disabled — tour just won't be remembered
    }
    setPersonaView("end-user");
    handleReset(); // clear any active conversation / past ticket → empty compose
    window.setTimeout(() => {
      void runWalkthrough(() => {});
    }, 120); // let the reset re-render so [data-tour="compose"] exists
  }

  // SID-81 first visit (no "seen" key): fire the tour once after the page settles.
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(WALKTHROUGH_KEY);
    } catch {
      seen = true;
    }
    if (seen) return;
    const t = window.setTimeout(() => launchTour(), 500);
    return () => window.clearTimeout(t);
    // Mount-only: launchTour's closure uses stable setters + store actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SID-82: visitor-triggered demo reset. Calls the unauthenticated /api/reset-public
  // (same resetAllPersonas() the cron runs), then reseed()s the local feed back to
  // baseline so the admin sees a clean slate. No confirmation modal — the click IS
  // the intent. The rate limiter returns 429; its message surfaces in the toast.
  async function handleResetDemo() {
    if (resetting) return;
    setResetting(true);
    setResetToast(null);
    try {
      const res = await fetch("/api/reset-public", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setResetToast(data.error ?? "Reset failed.");
      } else {
        reseed();
        setResetToast("Demo reset to baseline.");
      }
    } catch {
      setResetToast("Reset failed — network error.");
    } finally {
      setResetting(false);
    }
  }

  // Auto-dismiss the reset toast after a few seconds.
  useEffect(() => {
    if (!resetToast) return;
    const t = window.setTimeout(() => setResetToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [resetToast]);

  return (
    <main className="flex h-screen w-full flex-col bg-background-primary text-text-primary">
      {/* Shared top bar — the persona toggle is the structural shell switch. */}
      <header className="flex flex-wrap items-center justify-between gap-x-md gap-y-sm border-b border-border px-lg py-md">
        {/* SID-67 wordmark — type-only, the mark IS the type. Display serif
            (Newsreader), no shield glyph. Page h1 (SID-64 a11y) preserved.
            SID-76: a mono-uppercase byline sits beneath it (eyebrow vocabulary),
            subordinate to the wordmark, present in every page state. */}
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-[22px] font-medium leading-none tracking-display text-text-primary">
            Cleared
          </h1>
          <span className="mt-[4px] truncate font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
            Portfolio demo · Built by Sidharth Sundaram
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-sm md:gap-md">
          <PersonaToggle
            value={personaView}
            onChange={handlePersonaChange}
            unseenCount={unseenCount}
            endUserUnseenCount={endUserUnseenCount}
          />
          {/* SID-82: visitor-triggered demo reset — admin view only. During a
              broadcast the hourly cron can't keep up with peak traffic, so anyone
              can clear the demo to baseline on demand. No confirm modal by design. */}
          {personaView === "admin" && (
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              className="inline-flex min-h-[44px] items-center gap-xs rounded-md border border-border px-md py-xs text-body text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {resetting ? "Resetting…" : "Reset demo"}
            </button>
          )}
          {/* SID-71: replay the orientation tour. Quiet — same weight as the
              GitHub icon. SID-81: launchTour is ungated, so this re-opens on
              demand regardless of the "seen" flag (which it re-sets on open). */}
          <button
            type="button"
            onClick={() => launchTour()}
            aria-label="Replay the walkthrough"
            className="inline-flex h-[44px] w-[44px] items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
          >
            <HelpCircle className="h-5 w-5" aria-hidden />
          </button>
          {/* SID-76: about-this-demo — opens the portfolio-context modal. */}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            aria-label="About this demo"
            className="inline-flex h-[44px] w-[44px] items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
          >
            <Info className="h-5 w-5" aria-hidden />
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="inline-flex h-[44px] w-[44px] items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
        </div>
      </header>

      {personaView === "end-user" ? (
        // END-USER — personal help portal (SID-68): persona-aware history (left
        // rail) + a right pane that is compose / past-ticket (read-only) / active
        // conversation. ChatGPT-style two-pane on desktop; single-pane stacked on
        // mobile with drill-in to a past ticket.
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* LEFT RAIL — persona switcher, "New request", this persona's Recent.
              Hidden on mobile while a detail/active view is open (drill-in). */}
          <aside
            className={`min-h-0 shrink-0 flex-col border-border md:flex md:max-h-none md:w-[320px] md:border-b-0 md:border-r ${
              mobileDetailOpen ? "hidden md:flex" : "flex max-h-[50vh] border-b"
            }`}
          >
            <div className="shrink-0 border-b border-border p-sm">
              <PersonaSwitcher
                personas={PERSONAS}
                current={currentPersona}
                onSelect={handleSelectPersona}
              />
              <button
                type="button"
                onClick={handleReset}
                className="mt-xs inline-flex min-h-[40px] w-full items-center rounded-md px-sm text-sm text-text-secondary transition-colors hover:bg-background-secondary hover:text-text-primary"
              >
                + New request
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-md">
              <p className="mb-sm font-display text-displaySm italic lowercase text-text-muted">
                recent
              </p>
              {personaSubs.length > 0 ? (
                <TicketFeed
                  submissions={personaSubs}
                  selectedId={pastSelectedId}
                  now={now}
                  onSelect={handleSelectPast}
                  final
                />
              ) : (
                <p className="text-sm text-text-muted">No recent tickets.</p>
              )}
            </div>
          </aside>

          {/* RIGHT PANE — compose / past ticket / active conversation. */}
          <section className="flex min-w-0 flex-1 flex-col">

            {/* Mobile drill-out — only when a detail/active view is open. */}
            {mobileDetailOpen && (
              <button
                type="button"
                onClick={handleReset}
                className="flex min-h-[44px] shrink-0 items-center gap-xs border-b border-border px-md text-sm text-text-secondary transition-colors hover:text-text-primary md:hidden"
              >
                ← Back
              </button>
            )}

            <div className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col">
              {active ? (
                // ACTIVE CONVERSATION — the live stream + input (multi-turn).
                <>
                  <div className="flex min-h-0 flex-1 flex-col overflow-auto px-md pt-lg">
                    <div
                      role="log"
                      aria-live="polite"
                      aria-relevant="additions"
                      className="flex flex-col gap-md"
                    >
                      {turns.map((t) =>
                        t.role === "user" ? (
                          <UserBubble key={t.id} text={t.text} />
                        ) : (
                          <EndUserCard
                            key={t.id}
                            output={t.output}
                            status={active?.status}
                            // SID-90-revise: the timeline shows on the current final
                            // answer — the last agent turn with nothing in flight.
                            showTimeline={!pendingAgentId && t.id === lastAgentTurnId}
                            revealed={timelineRevealed}
                            onAdvance={openActiveInMethodology}
                          />
                        ),
                      )}
                      {pendingAgentId && !diagnose.isError && (
                        // The live card: timeline animates as the loading state.
                        <EndUserCard
                          key={pendingAgentId}
                          output={diagnose.data ?? null}
                          status={active?.status}
                          showTimeline
                          revealed={timelineRevealed}
                          onAdvance={openActiveInMethodology}
                        />
                      )}
                      {pendingAgentId && diagnose.isError && (
                        <ErrorState
                          message={diagnose.error.message}
                          onRetry={() => runDiagnose(submitted, pendingAgentId)}
                        />
                      )}
                      {/* SID-75: approval payoff lands as a new card below. */}
                      {approvalResultBlock(active)}
                      <div ref={bottomRef} />
                    </div>
                  </div>
                  <div className="px-md pb-lg pt-md">
                    <DiagnosisInput
                      value={symptom}
                      onChange={setSymptom}
                      onSubmit={() => handleSubmit(symptom)}
                      disabled={diagnose.isPending}
                    />
                  </div>
                </>
              ) : pastSub ? (
                // PAST TICKET — read-only conversation (no input). SID-69: a
                // continuation (clarify → resolve) renders below a muted
                // "— N min later" divider so the two moments read as a real thread.
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-md py-lg">
                  <div className="flex flex-col gap-md">
                    {pastSub.turns.map((t) =>
                      t.role === "user" ? (
                        <UserBubble key={t.id} text={t.text} />
                      ) : (
                        <EndUserCard
                          key={t.id}
                          output={t.output}
                          status={pastSub.status}
                        />
                      ),
                    )}
                    {pastSub.follow_up_turns &&
                      pastSub.follow_up_turns.length > 0 && (
                        <>
                          <ThreadDivider label={`${pastGapMin} min later`} />
                          {pastSub.follow_up_turns.map((t) =>
                            t.role === "user" ? (
                              <UserBubble key={t.id} text={t.text} />
                            ) : (
                              <EndUserCard
                                key={t.id}
                                output={t.output}
                                status={pastSub.status}
                              />
                            ),
                          )}
                        </>
                      )}
                    {/* SID-75: a past escalate that was approved/denied shows its
                        result card here, same as the live thread. */}
                    {approvalResultBlock(pastSub)}
                  </div>
                </div>
              ) : (
                // COMPOSE — empty state. "What's blocked?" + chips + input.
                <div data-tour="compose" className="flex min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col justify-end overflow-auto px-md pt-lg">
                    <div className="flex flex-col gap-md pb-md">
                      <div className="flex flex-col gap-xs">
                        <h2 className="font-display text-[28px] font-medium leading-heading tracking-display text-text-primary [text-wrap:balance]">
                          What&rsquo;s blocked?
                        </h2>
                        <p className="font-display text-[15px] italic text-text-muted [text-wrap:pretty]">
                          Describe what you can&rsquo;t reach — I&rsquo;ll check
                          your access and answer, or ask one question before
                          guessing.
                        </p>
                      </div>
                      <ScenarioChips
                        onPick={handlePickChip}
                        disabled={diagnose.isPending}
                      />
                    </div>
                  </div>
                  <div className="px-md pb-lg pt-md">
                    <DiagnosisInput
                      value={symptom}
                      onChange={setSymptom}
                      onSubmit={() => handleSubmit(symptom)}
                      disabled={diagnose.isPending}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : personaView === "methodology" ? (
        // METHODOLOGY (SID-91) — the middle act. Empty (aerial) when no verdict is
        // active this session; full content with receipts + verdict-aware anchor once
        // one is. CTA pivots on to Admin with the active ticket pre-selected.
        <MethodologyView
          output={methodologyOutput}
          onTryQuestion={() => handlePersonaChange("end-user")}
          onSeeAdmin={openActiveInAdmin}
        />
      ) : (
        // ADMIN — ticket system (SID-63): feed (list) + selected ticket (detail),
        // both reading the shared store. This replaces the diagnose.data-coupled
        // view (which desynced on reset). Responsive: stacked on mobile, side-by-
        // side on md+.
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="max-h-[40vh] shrink-0 overflow-auto border-b border-border p-md md:max-h-none md:w-[340px] md:border-b-0 md:border-r">
            <TicketFeed
              submissions={submissions}
              selectedId={selectedId}
              now={now}
              onSelect={selectTicket}
            />
          </aside>
          <section className="min-w-0 flex-1 overflow-auto p-lg">
            {selectedSub ? (
              <TicketDetail
                key={selectedSub.id}
                submission={selectedSub}
                now={now}
                live={live}
              />
            ) : (
              <p className="text-text-secondary">Select a ticket to view it.</p>
            )}
          </section>
        </div>
      )}

      {/* SID-76: about-this-demo modal — portfolio context, opened from the header. */}
      <AboutPanel open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* SID-82: inline reset confirmation — a quiet warm-surface toast, bottom
          centre, auto-dismissed. Polite live region so it's announced. */}
      {resetToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-lg left-1/2 z-20 -translate-x-1/2 rounded-md border border-border bg-background-secondary px-md py-sm text-body text-text-primary"
        >
          {resetToast}
        </div>
      )}
    </main>
  );
}
