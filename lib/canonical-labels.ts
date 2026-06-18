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
  // SID-56 Phase 3: resolve broadened beyond failure-only diagnoses. These two
  // are answer-shaped resolves the user can act on without an admin —
  //   existing_group_access: the user ALREADY has access via a group they're in
  //     (the answer is "you have it, here's where").
  //   resource_owner_routing: access is controlled by the resource's owner and
  //     the user has no group path (the answer is "request it from the owner").
  "existing_group_access",
  "resource_owner_routing",
] as const;

export type CanonicalRootCause = (typeof CANONICAL_ROOT_CAUSES)[number];
