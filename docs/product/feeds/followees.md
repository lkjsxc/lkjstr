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
render as fake users. If no follow list is available, the tab shows a real
unavailable state with retry.

## Row Contract

Each row shows:

- avatar when real profile metadata has one.
- best display name from profile metadata.
- verified NIP-05 marker when verification evidence exists.
- compact `npub` fallback.
- petname from the follow-list tag as local context.
- normalized relay hint when present and valid.
- actions to open Profile, open User Timeline, and copy `npub`.

Rows never invent avatars, names, verification, relay support, or relationships.

## Runtime Rules

The runtime owns a bounded visible row window, hydrates visible profiles through
the shared profile cache and coordinator, and closes all subscriptions when the
tab closes. Partial relay failure is diagnostic and does not hide reachable
relay data.

## Empty States

- Loading while a cache or relay read is in progress.
- No follow list received for this profile.
- Follow list contains no valid `p` tags.
- Relay unavailable, with details in diagnostics.
