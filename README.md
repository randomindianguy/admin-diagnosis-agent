# Cleared

A workspace access triage agent that refuses when it's not sure.

Live: **[admin-diagnosis-agent.vercel.app](https://admin-diagnosis-agent.vercel.app)**

---

## What it does

When someone at work can't open a file, folder, or dashboard, they file a ticket. Most go to an admin's queue. The admin spends real time figuring out what's wrong — group memberships, owner routing, resources they don't even control — often for tickets the access graph could have answered.

Cleared does that triage. It investigates the request and commits to one of three outcomes:

- **Resolve** — the answer is clear. Return it with reasoning.
- **Escalate** — admin work is genuinely needed. Send a complete investigation, not a raw ticket.
- **Refuse** — the request is vague or out of scope. Ask one specific question. Don't guess.

The third one is the differentiator. Most agents in this space try to be confident. This one tries to not be wrong.

## Try the demo

Open **[admin-diagnosis-agent.vercel.app](https://admin-diagnosis-agent.vercel.app)** and try these in order:

**A clean resolve.** *"I need the analytics dashboard."* Cleared checks access, finds you're already in the right team, and tells you to open it directly.

**A refusal that becomes a resolve.** *"I can't open the dashboard."* Cleared doesn't know which one. Instead of guessing, it asks: *"Analytics or data warehouse?"* Reply with *"the analytics dashboard"* and the loop closes into a resolve.

**An escalation.** *"I joined the analytics team last week and need access to the data warehouse dashboards."* Cleared recognizes onboarding routing and sends a complete package to the identity team — who, what, why, and the recommended fix. The admin gets a triaged investigation, not a raw ticket.

The workspace is real but seeded with a fixed set of users, groups, and resources. The scenarios above exercise the verdict shapes against that data; questions about resources outside the seed may not have data to ground.

Toggle to **Admin** to see what an admin actually receives.

## How it works

Cleared integrates with three real workspaces. Okta backs identity and group memberships. Notion backs runbook content that the agent retrieves over and reasons about. Slack backs team channel activity that appears in the admin view but never reaches the model's reasoning. This split between evidence and context is enforced architecturally, not at the prompt layer.

The agent runs a fixed pipeline against retrieval, identity graph, and permission state:

1. **Scope check** — workspace access question, or out of scope?
2. **Retrieval** — look up the relevant runbook with a sufficiency threshold. Below the threshold, refuse.
3. **Identity** — resolve memberships from Okta, including nested subgroups.
4. **Permission** — does the resource actually grant access?
5. **Self-consistency** — three samples must agree before committing.
6. **Verdict** — the model picks resolve, escalate, or refuse via tools with explicit prerequisites.

The pipeline is fixed. The model picks the verdict; the gates decide what evidence is on the table.

Refusal is a real verdict, not a fallback. When the agent can't ground an answer, it asks one specific question instead of enumerating options.

## Evaluation

Two tiers, scored independently:

- **Basics** (40 cases) — correct verdict, correct routing. **40 / 40.**
- **Nuance** (40 cases) — speaks to outcomes, no jargon, grounded in real data. **39 / 40.**

Methodology: seed-and-mutate. Golden cases authored manually, then mutated along seven failure axes. Graders validated against deliberately bad outputs before being trusted to discriminate good ones.

Pipeline in `eval/`. Run with `npm run eval`.

## Stack

Next.js 14 · TypeScript · Tailwind · Anthropic SDK (claude-sonnet-4-6, tool-use, self-consistency) · Voyage embeddings · Okta + Notion + Slack APIs · Zustand · Vercel.

## Credits

Visual polish pass done with [Impeccable](https://github.com/pbakaus/impeccable).
