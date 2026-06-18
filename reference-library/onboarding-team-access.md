# Onboarding gaps: new team members missing baseline group access

**Tags:** onboarding, new hire, new team member, baseline group membership, team access provisioning, data warehouse access, identity team provisioning

## Baseline access for a team

Most teams have a baseline set of group memberships that every member is expected to have. Those memberships are what grant access to the team's shared resources. When onboarding works, a new member is added to the team's baseline groups and inherits the team's access automatically.

For example, members of the analytics team are expected to be in the **data-team** group, because the data warehouse dashboards (and other shared data resources) grant access to data-team. An analytics member who is in their team's group but **not** in data-team will be blocked from those data resources even though their teammates are not.

## How to recognize an onboarding gap

1. The user is new to the team (recently joined) and is requesting access they have never had.
2. The resource grants to a baseline group (e.g. data-team) that the team is expected to be in.
3. The user is not yet a member of that baseline group.

This is not a diagnosis of a broken mechanism — the user simply has not been provisioned into the group they should have. It is a new-access request that requires authorization.

## What to do

Granting a new group membership is an admin action — it cannot be self-served by the user, and it requires someone to authorize the new access. Route it to the **identity team**, who own group membership and provisioning.

Hand off a complete package so the user does not have to re-explain: who they are (new member, which team), what they are blocked from, why (the resource requires the baseline group and they are not in it), and the recommended fix (add them to the specific group). Do not promise a specific turnaround time — the timing is the admin's to set.
