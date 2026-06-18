# Nested-group inheritance and access propagation

**Tags:** nested-group inheritance, access propagation, subgroup membership, membership-level checks

## Symptom

A user cannot open a folder, file, or shared resource in Drive that their team is supposed to have access to. They are a member of the team and appear under the team's group, but still get "permission denied" or no access when they try to open it. The team's group does have a grant on the resource, which makes the block surprising.

## The default behavior

When a group grants access to a resource, that grant applies to **direct members** of the group. By default, the grant does **not** propagate down to members of nested subgroups.

If `group-parent` has a grant on a resource, and `group-child` is nested under `group-parent`, then:

- Users who are direct members of `group-parent` get access via the grant.
- Users who are direct members of `group-child` (but **not** also direct members of `group-parent`) do **not** automatically inherit access.

This catches operators by surprise because the UI often shows the nested group hierarchy in a way that suggests inheritance. It does not.

## How to check actual membership level

When diagnosing an access issue, do not stop at "the user is in `group-parent`'s tree somewhere." Check **which specific group the user is a direct member of.**

In the admin console:

1. Open the user's profile.
2. Look at the "Direct group memberships" field — not the "All groups" or expanded-tree view.
3. The direct-membership entry is the one that determines which grants apply.

A user can appear under a parent group's tree (because they're in a nested subgroup) without being a direct member of the parent. The grant level is decided by **direct membership only.**

## The fix

When a user lacks access because they're in a nested subgroup that doesn't inherit:

- **Option A**: Add the grant directly to the nested subgroup (e.g., grant `group-child` access to the resource alongside `group-parent`).
- **Option B**: Move the user up to direct membership in `group-parent`. Usually only correct if the nested subgroup wasn't meaningful in the first place.

Option A is the standard fix because it preserves the subgroup's purpose. Option B is only correct if the subgroup boundary was a mistake.

## Reconciling with operator claims

A common operator error: "I checked, the user is in the group that has access." This claim is often based on viewing the expanded group tree (which shows the user under the parent) rather than the direct-membership field (which would show the user is only in the nested subgroup).

When this happens, the correction is to name both levels explicitly: which group the operator checked (the parent, with the grant) and which group the user is actually a direct member of (the nested subgroup, without inheritance).
