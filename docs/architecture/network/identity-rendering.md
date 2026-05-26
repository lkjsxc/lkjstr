# Identity Rendering

## Purpose

Identity rendering converts pubkeys and cached profile data into compact
display UI.

## Contract

- `IdentityChip` renders avatar, title, and optional subtitle.
- Timeline avatar and author controls are buttons that open Profile tabs.
- Missing metadata falls back to a neutral title such as `Unknown`. Feed rows
  do not show shortened npub or hex pubkey text beside the display name.
- When nip05 is present and should be shown, it may appear as the subtitle on
  feed rows only. npub and hex never appear as feed-row subtitles.
- Event metadata renders the author control and date.
- Full public-key text is not shown in post rows; identity details belong in
  identity and profile surfaces.
- Profile header surfaces may show full `npub` and copy actions. That is outside
  the feed-row contract.
- Profile metadata events update the in-memory profile cache.
- Profile metadata hydration is latest-only. Newer cached metadata wins over
  older async relay or cache responses, and stale hydration must not overwrite
  or briefly render over newer identity state.
- Visible event authors are hydrated across Home, Global, Notifications,
  Profile notes, and Thread when cached or relay metadata exists.
- Hydration is cache-first, relay-backed, batched, in-flight deduped, timed out,
  and gated by `profiles.fetchMetadata`.
- Broken or slow avatar images fall back to deterministic initials without
  changing row geometry.
- Timeline rows keep their event authors stable while hydration enriches
  identity labels and avatars.
