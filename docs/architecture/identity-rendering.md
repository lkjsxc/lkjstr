# Identity Rendering

## Purpose

Identity rendering converts pubkeys and cached profile data into compact
display UI.

## Contract

- `IdentityChip` renders avatar, title, and subtitle.
- Timeline avatar and author controls are buttons that open Profile tabs.
- Missing metadata falls back to shortened public key text.
- Event metadata renders the author control, date, and short event id.
- Full public-key text is not shown in post rows; identity details belong in
  identity and profile surfaces.
- Profile metadata events update the in-memory profile cache.
