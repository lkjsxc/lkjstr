# Identity Rendering

## Purpose

Identity rendering converts pubkeys and cached profile data into compact
display UI.

## Contract

- `IdentityChip` renders avatar, title, and subtitle.
- Timeline avatar and author controls are buttons that open Profile tabs.
- Missing metadata falls back to shortened public key text.
- Profile metadata events update the in-memory profile cache.
