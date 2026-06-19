"use client";

import { create } from "zustand";
import type { DiagnosisOutput } from "./schema";
import { seedSubmissions } from "./seed-submissions";

// Shared submissions store (SID-62; read by SID-63's admin feed).
//
// One Submission = one end-user request thread. It may be multi-turn: a refuse
// (resource/intent ambiguity) asks a clarifying question, and the user's next
// message continues the SAME submission. The end-user view operates on the
// ACTIVE submission; SID-63's admin feed reads the full `submissions` list
// (pre-seeded with the demo scenarios + each live submission appended here).
//
// Frontend state only (Q1): the diagnosis backend is single-shot and stateless;
// conversation continuity is a UI concern, lost on refresh (reset is a feature).

export type Requester = { name: string; role: string; team: string };

export type Turn =
  | { id: string; role: "user"; text: string; at?: number }
  | { id: string; role: "agent"; output: DiagnosisOutput; at?: number };

export type Submission = {
  id: string;
  requester: Requester;
  turns: Turn[];
  createdAt: number;
  seen: boolean;
  // SID-69: hand-authored continuation of a "needs detail" refuse (the user
  // clarifies, the agent resolves). END-USER-FACING SEED DATA ONLY — the admin
  // view reads `turns` and never this field, so it stays byte-identical. Carries
  // its own `at` timestamps (~5–15 min after the original) for the realism divider.
  follow_up_turns?: Turn[];
};

// The logged-in end user (matches scenario.json current_user = Alex). Stored on
// every live submission now; SID-63 surfaces it as the requester in the feed.
export const CURRENT_USER: Requester = {
  name: "Alex Chen",
  role: "Analyst",
  team: "Analytics team",
};

// Monotonic id generator — stable, SSR-safe (no crypto/Date in the hot path),
// and shared so a turn's id can be minted in the page (for the in-flight card's
// key) and handed back to addAgentTurn so the card morphs in place (SID-59).
let _seq = 0;
export const makeId = (prefix = "t"): string => `${prefix}-${++_seq}`;

type SubmissionsState = {
  submissions: Submission[];
  activeId: string | null; // the end-user's in-progress conversation
  selectedId: string | null; // the admin's selected ticket (SID-63)
  seeded: boolean;
  startSubmission: (requester: Requester, firstText: string) => void;
  addUserTurn: (text: string) => void;
  addAgentTurn: (output: DiagnosisOutput, turnId: string) => void;
  reset: () => void;
  seed: () => void; // pre-load the demo tickets once (SID-63)
  selectTicket: (id: string) => void; // admin picks a feed ticket
  markAllSeen: () => void; // clears the unseen indicator (on toggle → Admin)
};

// Map over submissions, replacing the active one via `fn`.
function withActive(
  s: SubmissionsState,
  fn: (sub: Submission) => Submission,
): Partial<SubmissionsState> {
  if (!s.activeId) return {};
  return {
    submissions: s.submissions.map((sub) =>
      sub.id === s.activeId ? fn(sub) : sub,
    ),
  };
}

export const useSubmissions = create<SubmissionsState>((set) => ({
  submissions: [],
  activeId: null,
  selectedId: null,
  seeded: false,

  // Begin a new thread: append it to the feed, make it the active conversation,
  // AND auto-select it for the admin (SID-63: the selection-change IS the live-
  // ingestion feature — toggle to Admin and the new ticket is already open). It
  // starts unseen, so the Admin toggle shows the change indicator.
  startSubmission: (requester, firstText) =>
    set((s) => {
      const id = makeId("sub");
      const submission: Submission = {
        id,
        requester,
        createdAt: Date.now(),
        seen: false,
        turns: [{ id: makeId("u"), role: "user", text: firstText }],
      };
      return {
        submissions: [...s.submissions, submission],
        activeId: id,
        selectedId: id,
      };
    }),

  addUserTurn: (text) =>
    set((s) =>
      withActive(s, (sub) => ({
        ...sub,
        turns: [...sub.turns, { id: makeId("u"), role: "user", text }],
      })),
    ),

  // turnId is minted by the caller before the request so the in-flight card and
  // the settled card share a key (SID-59 continuous morph).
  addAgentTurn: (output, turnId) =>
    set((s) =>
      withActive(s, (sub) => ({
        ...sub,
        turns: [...sub.turns, { id: turnId, role: "agent", output }],
      })),
    ),

  // Reset clears only the ACTIVE pointer — the submission persists in the feed
  // (the live-ingestion seam SID-63 reads). End user returns to the home state.
  reset: () => set({ activeId: null }),

  // Pre-load the demo tickets once, on first mount. createdAt is computed relative
  // to now so "X ago" reads sensibly. Selects the most recent ticket by default.
  seed: () =>
    set((s) => {
      if (s.seeded) return {};
      const seeds = seedSubmissions(Date.now());
      const newest = seeds.reduce<Submission | null>(
        (a, b) => (!a || b.createdAt > a.createdAt ? b : a),
        null,
      );
      return { submissions: seeds, seeded: true, selectedId: newest?.id ?? null };
    }),

  selectTicket: (id) => set({ selectedId: id }),

  markAllSeen: () =>
    set((s) => ({
      submissions: s.submissions.map((sub) =>
        sub.seen ? sub : { ...sub, seen: true },
      ),
    })),
}));
