# Followees

## Purpose

Followees tabs show the real accounts listed in a profile's latest NIP-02
follow list.

## Entry Points

Followees opens from the Profile following count and profile-related actions. It
is not a New Tab choice unless a later contract adds free-form entry.

Opening Followees focuses an existing same-tile Followees tab for the same
viewed profile pubkey. If none exists, the workspace creates one in that tile.

## Input

The tab input is:

- viewed profile pubkey.
- optional latest kind `3` event id.
- optional source profile tab id.

The viewed pubkey is the subject whose follow list is shown. The active signing
account is not required.

## Data Contract

Followees uses the latest kind `3` event for the viewed pubkey. It extracts
valid `p` tags, deduplicates by pubkey, and preserves first valid relay hint and
petname values from the follow-list event.

Invalid pubkeys are ignored. Invalid rows may increment diagnostics but must not
render as fake users. If no cached follow list is available, the tab starts
relay discovery. A cache miss is not an unavailable state.

## Discovery States

The tab reports one truthful state at a time:

- cache-hit displayed immediately.
- relay discovery in progress.
- found on selected relay.
- found on author route or NIP-65 relay.
- found on receipt route.
- found on discovery fallback.
- empty valid follow list.
- partial relay failure with retry.
- not found only after complete EOSE evidence from attempted relays.
- all failed with attempted relay diagnostics.

Partial failure, timeout, AUTH, socket close, or missing EOSE never proves that a
follow list is absent.

Profile consumes the same discovery state for its following count. It may render
`N following` or `0 following` only after the latest kind `3` is known. Cache
miss, relay discovery, partial failure, unavailable routes, and all-failed reads
remain separate count states with stable loading or retry copy.

## Leading Header

Followees places a `FeedIdentityHeader` for the viewed profile pubkey as the
first in-flow row inside the shared virtual scroll owner. Discovery guidance,
retry controls, and followee rows share that scroll surface. The header never
shows raw `npub` or hex pubkey text.

## Row Contract

Each row uses the shared user-row component and shows:

- avatar when real profile metadata has one.
- best display name from profile metadata, or `Unknown`.
- NIP-05 subtitle when available.
- petname from the follow-list tag as local context.
- normalized relay hint when present and valid.

Row click opens Profile. Secondary actions live in a three-dot overflow menu:

- Open User Timeline
- Copy npub

Rows never invent avatars, names, verification, relay support, or relationships.
Inline Profile, Timeline, and Copy npub buttons must not appear on list rows.
Overflow menu clicks must not trigger row navigation.

## Runtime Rules

The runtime owns a bounded visible row window, hydrates visible and near-visible
profiles through the shared profile cache and coordinator, and closes all reads
when the tab closes. It may read selected relays, target NIP-65 routes, receipt
routes, local route evidence, and bounded discovery fallback relays. Disabled or
removed relays are excluded.

Row hydration priority is visible rows first, near-visible rows within roughly
two viewports second, active offscreen rows third, hidden mounted tabs paused,
and closed or stale generations cancelled. Duplicate profile jobs use the
pubkey as the semantic key so rows and tabs share work.

## Empty States

- Loading while cache read or relay discovery is in progress.
- No public follow list was found on attempted relays.
- Follow list contains no valid `p` tags.
- Follow-list discovery is incomplete, with relay diagnostics and retry.
- Relay reads all failed, with attempted-relay diagnostics.

Retry starts a new bounded discovery generation. It does not clear a known newer
cached follow list unless a newer relay kind `3` replaces it.
