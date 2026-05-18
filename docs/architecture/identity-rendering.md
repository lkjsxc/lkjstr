# Identity Rendering

## Purpose

Identity rendering converts pubkeys and cached profile data into compact
display UI.

## Contract

- `IdentityChip` renders avatar, title, and subtitle.
- Timeline avatar and author controls are buttons that open Profile tabs.
- Missing metadata falls back to shortened public key text.
- Event metadata renders the full author `npub` immediately after the author
  control and before the date.
- Full `npub` text uses wrapping monospace styling so it remains visible
  without widening the event row.
- Profile metadata events update the in-memory profile cache.
