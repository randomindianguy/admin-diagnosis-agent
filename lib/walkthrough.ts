// First-visit orientation tour (SID-71). Driver.js, dynamically imported on launch
// so it stays out of the initial bundle. Four steps, orientation-only (no forced
// actions). Visual register matches SID-67: warm-dark surface, hairline border,
// mono eyebrow + Newsreader title + Inter body, amber outline buttons. Buttons and
// the eyebrow/title markup are built in onPopoverRender for exact control over the
// copy and behaviour (Skip = dismiss, Back = previous, Next/Done).

import type { Config, PopoverDOM, State } from "driver.js";

export const WALKTHROUGH_KEY = "cleared.walkthrough.dismissed";

type StepContent = {
  eyebrow: string;
  title: string;
  body: string;
  element?: string;
};

// Exact copy from the card — do not paraphrase.
const STEPS: StepContent[] = [
  {
    eyebrow: "WELCOME",
    title: "This is Cleared.",
    body: "An access triage agent that refuses when it's not sure rather than guessing. Three things to know.",
  },
  {
    eyebrow: "PERSONA · 1 OF 3",
    title: "You're Demo User.",
    body: "A fresh account with no access yet. Switch personas to ask as a different user — submissions come through as whoever's active. Alex has past tickets; Sam and Dana have multi-turn histories.",
    element: '[data-tour="persona-switcher"]',
  },
  {
    eyebrow: "COMPOSE · 2 OF 3",
    title: "Ask the agent.",
    body: "Try a suggestion or write your own. Vague requests trigger refusal — try 'I can't open the dashboard' to see it ask for specifics before guessing.",
    element: '[data-tour="compose"]',
  },
  {
    eyebrow: "ADMIN · 3 OF 3",
    title: "See the reasoning.",
    body: "Toggle to Admin to read the agent's full audit trail. For escalations that need a group membership, scroll to the bottom of the ticket and click Approve — Cleared writes the grant to real Okta.",
    element: '[data-tour="admin-toggle"]',
  },
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function runWalkthrough(onDismiss: () => void): Promise<void> {
  const { driver } = await import("driver.js");

  const config: Config = {
    showProgress: false,
    overlayColor: "#0F0E0C",
    overlayOpacity: 0.85,
    stagePadding: 6,
    stageRadius: 4,
    popoverClass: "cleared-tour",
    smoothScroll: true,
    allowClose: true, // ESC / overlay click dismisses
    disableActiveInteraction: true, // orientation-only — don't let clicks fall through
    steps: STEPS.map((s) => ({
      element: s.element,
      popover: { title: s.title, description: s.body },
    })),
    onPopoverRender: (popover: PopoverDOM, opts: { state: State }) => {
      const i = opts.state.activeIndex ?? 0;
      const s = STEPS[i];
      const last = i === STEPS.length - 1;

      // Eyebrow + title as structured markup (mono eyebrow over serif title).
      popover.title.innerHTML = `<span class="tour-eyebrow">${esc(s.eyebrow)}</span><span class="tour-title">${esc(s.title)}</span>`;

      // We render our own footer buttons; hide Driver's corner close (X).
      if (popover.closeButton) popover.closeButton.style.display = "none";

      // Left button: Skip (steps 1–3, dismiss) or Back (last step, previous).
      const prev = popover.previousButton;
      prev.disabled = false;
      prev.removeAttribute("disabled");
      if (last) {
        prev.textContent = "Back";
        prev.onclick = () => obj.movePrevious();
      } else {
        prev.textContent = i === 0 ? "Skip tour" : "Skip";
        prev.onclick = () => obj.destroy();
      }

      // Right button: Get started / Next / Done.
      const next = popover.nextButton;
      next.textContent = i === 0 ? "Get started" : last ? "Done" : "Next";
      next.onclick = () => (last ? obj.destroy() : obj.moveNext());
    },
    onDestroyed: () => onDismiss(),
  };

  const obj = driver(config);
  obj.drive();
}
