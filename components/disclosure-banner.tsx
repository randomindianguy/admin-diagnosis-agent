// Disclosure banner (B.4) — end-user only. Tells the viewer the simplification is
// JTBD-driven, not role-based gating. SID-67: a single line of italic display
// serif at the top, not a boxed callout — trust the type to carry it (no card,
// no icon).
export function DisclosureBanner() {
  return (
    <p className="font-display text-[15px] italic leading-body text-text-muted">
      End-user view — what the person who&rsquo;s blocked sees. Toggle to Admin for
      what the support team sees when handling your request.
    </p>
  );
}
