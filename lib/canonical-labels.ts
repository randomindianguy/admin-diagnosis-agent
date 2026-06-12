// The canonical root_cause label list (chunk-2 starting set).
// Per Phase 1 §3 / CHUNK2-DESIGN-DECISIONS Q4: if no label matches, the system
// MUST escalate — it never invents a label. This list is the runtime source for
// the tool-use enum (step 6) AND the type below, so the two cannot drift.
// Chunks 3–6 widen this list; each new label maps to a scenario's expected root_cause.
export const CANONICAL_ROOT_CAUSES = [
  "nested_subgroup_inheritance_gap",
  "propagation_lag",
  "explicit_deny_override",
  "group_membership_revoked",
] as const;

export type CanonicalRootCause = (typeof CANONICAL_ROOT_CAUSES)[number];
