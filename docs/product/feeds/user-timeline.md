# User Timeline

## Purpose

User Timeline shows a public home-like feed for a target pubkey based on that
pubkey's latest NIP-02 follow list.

## Entry Points

User Timeline opens from Profile actions, Followees rows, and future
identity-related menus. It is not a New Tab choice unless a later contract adds
free-form entry.

Opening User Timeline focuses an existing same-tile User Timeline tab with the
same target pubkey. If none exists, the workspace creates one in that tile.

## Input

The tab input is:

- target pubkey.
- optional source of `profile`, `followees`, or `manual-action`.

The target pubkey is the subject whose public follow graph is used. The viewer's
active signing account is optional and must not be required for reading.

## Feed Contract

User Timeline loads the target pubkey's latest kind `3`, extracts valid followee
pubkeys, adds the target pubkey, and reads feed-display events from those
authors. It uses the same row rendering, sensitive-content gate, profile
hydration, paging, and bounded runtime rules as Home and Profile.

The tab clearly labels whose timeline is being shown. It must not imply private
or personalized access.

## Relay Routing

Selected read relays are the base and fallback. The runtime may add bounded
protocol-derived routes from target profile metadata, follow-list relay hints,
relay receipts, and local route evidence. Disabled or removed relays remain
excluded.

Global routing rules do not apply. User Timeline is target-scoped.

## Cache Contract

Cached rows may render before relay results only when coverage evidence supports
the target pubkey, route fingerprint, selected relay fingerprint, page size,
feed policy, and time interval. Cached rows for one target must not appear in
another target's timeline unless the underlying author set and coverage evidence
match the new target query.

## Empty States

- No follow list has been received for this user.
- Follow list has no valid authors beyond the target pubkey.
- Relay reads are unavailable, with diagnostics.
- No covered events exist for the current bounded interval.

Empty states never synthesize posts or profile data.
