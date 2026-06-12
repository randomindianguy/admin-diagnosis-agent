// Authored escalation constants (CHUNK2-DESIGN-DECISIONS Q12).
//
// When the gate overrides a model `resolve` into `escalate` (a gate signal
// failed), the model supplied no owner — it called the `resolve` tool. The
// forced escalation routes to this authored constant. Authored, not generated
// (facts/judgment discipline). Future chunks extend escalation logic here —
// Seed 4's contested-routing (chunk 6) grows this file into a routing module.
export const FALLBACK_ESCALATION_OWNER = "human-reviewer";
