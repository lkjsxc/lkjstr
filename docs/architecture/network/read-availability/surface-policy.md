# Surface Policy

## Purpose

Define which surfaces may degrade to session default public read relays when
durable relay settings are unavailable.

## Allowed Read-Only Fallback

- Global.
- Public Profile.
- Search.
- Author Context.
- Followees.
- Public User Timeline.
- Custom Request event-list reads.
- Home and Notifications only when a real active account pubkey is already
  supplied by the page shell.

## Forbidden Fallback

Writes, signing actions, profile edits, follow/unfollow, reactions, reposts,
publishing, upload flows, and relay settings changes cannot use session default
public read relays as write evidence.

When policy forbids fallback, the effective plan is `settings-unavailable` and
queryless. When durable settings are loaded but have no enabled read relay, the
effective plan is `durable-empty` and may render `no-enabled-relay`.
