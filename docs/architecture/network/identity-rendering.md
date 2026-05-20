# Identity Rendering

## Purpose

Identity rendering converts pubkeys and cached profile data into compact
display UI.

## Contract

- `IdentityChip` renders avatar, title, and subtitle.
- Timeline avatar and author controls are buttons that open Profile tabs.
- Missing metadata falls back to shortened public key text.
- Event metadata renders the author control and date.
- Full public-key text is not shown in post rows; identity details belong in
  identity and profile surfaces.
- Profile metadata events update the in-memory profile cache.
- Profile metadata hydration is latest-only. Newer cached metadata wins over
  older async relay or cache responses, and stale hydration must not overwrite
  or briefly render over newer identity state.
- Visible event authors are hydrated across Home, Global, Notifications,
  Profile notes, and Thread when cached or relay metadata exists.
- Timeline rows keep their event authors stable while hydration enriches
  identity labels and avatars.
- Missing metadata shows shortened public key text as title and secondary
  fallback.
