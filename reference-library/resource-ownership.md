# Owner-controlled resources and requesting access from the owner

**Tags:** resource owner, owned by, request access, no group grants access, owner-controlled documents and plans

## When no group grants access

Some resources are not provisioned through team groups at all. They are **owner-controlled**: a specific person or team owns the resource and decides who gets access, one request at a time. Strategy documents, planning files, and other sensitive single-owner resources are commonly set up this way.

For these resources there is no group membership that grants access. A user who is not on the owner's access list has no path to the resource through any group they belong to — and adding them to a group will not help, because the resource does not grant to a group.

## How to recognize this case

1. Check the resource's grants. If it grants to no group the user is in — or to no group at all — group membership is not the route.
2. Check the resource's owner. An owner-controlled resource names an owning person or team.
3. If both are true (no group path, and there is an owner), the access decision belongs to the owner.

## What to tell the user

This is a resolvable, self-serve answer — the user does not need an admin. Tell them who owns the resource and that access is granted by the owner, then give them the action: use the resource's Request Access control, which routes the request to the owner for approval. Name the owner so they know who will be deciding.

Do not escalate owner-controlled access requests to the identity or support teams — those teams do not own the resource and cannot grant it. The owner does.
