# Confirming access a user already has through a group

**Tags:** existing access, group membership grants, already have access, where to find a resource, dashboards and shared resources

## The common case: access is already there

Not every access request is a failure. A frequent pattern is a user asking for access to a resource they **already have** — usually because the resource grants access to a group they are a direct member of, and they simply haven't found it yet or didn't realize the grant covers them.

When a resource grants access to a group, every **direct member** of that group has that access immediately. If the user asking is a direct member of a granted group, the answer is not to provision anything — it is to confirm they already have it and point them to where to open it.

## How to check

1. Look at the resource's grants — which groups (or users) it grants, and at what level (viewer, editor).
2. Look at the user's direct group memberships.
3. If the user is a direct member of a group the resource grants to, they already have access at that level. No change is needed.

## What to tell the user

Confirm it plainly: they already have access through the named group, and at what level (e.g. viewer). Then give them the action that unblocks them — open the resource directly from the workspace, or use the direct link. Do not route this to an admin; there is nothing to provision.

If the user reports they still cannot open it after confirming the grant, that is a different problem (propagation lag, an explicit deny, or a stale session) and should be diagnosed separately.
