// Authored escalation constants (CHUNK2-DESIGN-DECISIONS Q12, extended in Q18).
//
// Two separate concerns, kept structurally distinct:
//
//   CANONICAL_ESCALATION_OWNERS (Q18): the closed enum the model MUST pick from
//     when it calls the `escalate` tool. Parallel to Q11's CANONICAL_ROOT_CAUSES
//     — the model cannot invent an owner; if no canonical authority class fits,
//     the catchment `support-team` is in the enum specifically as the
//     within-enum fallback (different from FALLBACK_ESCALATION_OWNER below,
//     which is system-only).
//
//   FALLBACK_ESCALATION_OWNER (Q12): the system-only constant that fires when
//     the gate OVERRIDES a model-resolve into an escalate. The model called
//     `resolve` and supplied no owner; the system substitutes this value.
//     Distinct from anything the model itself can pick — `human-reviewer` means
//     "the system overrode a confident resolve and we don't trust either the
//     diagnosis or the routing."
//
// Q18 forward-link: Seed 4's contested-routing (chunk 6) grows this file into a
// routing module. The CANONICAL_ESCALATION_OWNERS list is the starting set;
// chunk 6 may add owners and/or refactor `owner: <enum>` into the richer
// `routing: { state, owners, recommended }` shape Q4 forward-linked.

export const CANONICAL_ESCALATION_OWNERS = [
  "identity-team",   // user accounts, group memberships, SSO/IdP, provisioning
  "resource-owner",  // the specific resource's owner (e.g., Drive folder owner)
  "security-team",   // security policy, DLP, conditional access, compliance gates
  "support-team",    // generic IT support — within-enum catchment for issues
                     // that don't cleanly fit any specialist authority class
] as const;

export type CanonicalEscalationOwner = (typeof CANONICAL_ESCALATION_OWNERS)[number];

export const FALLBACK_ESCALATION_OWNER = "human-reviewer" as const;
export type FallbackEscalationOwner = typeof FALLBACK_ESCALATION_OWNER;
