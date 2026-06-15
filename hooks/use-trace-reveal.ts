"use client";

import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Reactive prefers-reduced-motion (SID-50). SSR-safe: starts false, corrects on
// mount. Used to branch render (sequential reveal vs static) and to short-circuit
// the reveal timer.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// Sequential reveal driver (SID-50). Each bump of `submitKey` restarts the
// reveal: row i becomes visible at (i+1)*stepMs — row 0 at ~500ms, the last row
// at ~total*stepMs (~3s for 6 rows). This is PACING of the reveal, not real-time
// streaming: diagnose() runs independently and the UI gates the output card on
// (revealedRowCount === total) AND (api resolved). Reduced-motion jumps straight
// to `total` (no timers, no sequential reveal).
export function useTraceReveal(
  submitKey: number,
  total: number,
  stepMs = 500,
): number {
  const [count, setCount] = useState(0);
  const [lastKey, setLastKey] = useState(submitKey);

  // Reset synchronously when a new submission starts — done during render (the
  // React "adjust state on prop change" pattern) so a second submission never
  // flashes the prior run's rows before the effect re-schedules.
  if (submitKey !== lastKey) {
    setLastKey(submitKey);
    setCount(0);
  }

  useEffect(() => {
    if (submitKey === 0) return; // no submission yet
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      setCount(total);
      return;
    }
    // Elapsed-time reveal: count is DERIVED from real elapsed time (not
    // accumulated per-tick), so it's exact even if the interval is throttled, and
    // idempotent under React Strict Mode (two intervals compute the same count).
    // setInterval (not rAF) so it keeps running in a background/unfocused tab.
    // Row i becomes visible at ~(i+1)*stepMs; full reveal at ~total*stepMs.
    const start = Date.now();
    const id = setInterval(() => {
      const next = Math.min(total, Math.floor((Date.now() - start) / stepMs));
      setCount(next);
      if (next >= total) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
  }, [submitKey, total, stepMs]);

  return count;
}
