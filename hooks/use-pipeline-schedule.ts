"use client";

import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// SID-90-revise: the MOCK pipeline schedule (client-only; no backend signal). Each
// bump of `triggerKey` (the page's submitKey, bumped at submit) restarts a fixed
// non-linear schedule that activates the 5 timeline tiles during the diagnose wait:
//   t=1.5s Retrieval · 3s Identity · 5s Reasoning · 7s Gate · 8s Verdict
// then HOLDS at 5 until the real response lands (the verdict tile colors from the
// payload at that point — handled by the component, not here). useTraceReveal can't
// drive this: it's linear (even stepMs), and this schedule is deliberately uneven.
//
// Like useTraceReveal: count is DERIVED from elapsed time (exact under interval
// throttling, idempotent under Strict Mode), setInterval keeps running in a
// background tab, and prefers-reduced-motion jumps straight to the final count.
const SCHEDULE_MS = [1500, 3000, 5000, 7000, 8000];
export const PIPELINE_STAGES = SCHEDULE_MS.length;

export function usePipelineSchedule(triggerKey: number): number {
  const [count, setCount] = useState(0);
  const [lastKey, setLastKey] = useState(triggerKey);

  // Reset synchronously when a new submission starts (adjust-state-on-prop-change),
  // so a second submission never flashes the prior run's revealed tiles.
  if (triggerKey !== lastKey) {
    setLastKey(triggerKey);
    setCount(0);
  }

  useEffect(() => {
    if (triggerKey === 0) return; // no submission yet
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      setCount(PIPELINE_STAGES);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = SCHEDULE_MS.filter((t) => elapsed >= t).length;
      setCount(next);
      if (next >= PIPELINE_STAGES) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
  }, [triggerKey]);

  return count;
}
