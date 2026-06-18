"use client";

import { create } from "zustand";
import type { DiagnosisOutput } from "./schema";

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
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; output: DiagnosisOutput };

export type Submission = {
  id: string;
  requester: Requester;
  turns: Turn[];
  createdAt: number;
  seen: boolean;
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
  activeId: string | null;
  startSubmission: (requester: Requester, firstText: string) => void;
  addUserTurn: (text: string) => void;
  addAgentTurn: (output: DiagnosisOutput, turnId: string) => void;
  reset: () => void;
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

  // Begin a new thread: append it to the feed and make it active.
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
      return { submissions: [...s.submissions, submission], activeId: id };
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
}));
