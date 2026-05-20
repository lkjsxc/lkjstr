# Feed Surfaces

## Purpose

Feed surface docs define relay-backed read tabs and action-opened read tabs.

## Documents

- [global.md](global.md): relay-wide note feed behavior.
- [home.md](home.md): account-follow feed behavior.
- [notifications.md](notifications.md): account activity behavior.
- [profiles.md](profiles.md): profile opening and authored notes.
- [threads.md](threads.md): event thread opening and rendering.

## Shared Contract

- Event rows render avatar, display name, secondary identity fallback,
  timestamp, and wrapped content consistently.
- Identity actions open Profile tabs in the same tile.
- Event rows, references, and continuation actions open Thread tabs in the same
  tile.
- Cached rows are safe to render when persisted arrays or optional fields are
  absent.
