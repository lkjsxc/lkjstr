# Feed Surfaces

## Purpose

Feed surface docs define relay-backed read tabs and action-opened read tabs.

## Table of Contents

- [global.md](global.md): relay-wide note feed behavior.
- [home.md](home.md): account-follow feed behavior.
- [notifications.md](notifications.md): account activity behavior.
- [profiles.md](profiles.md): profile opening and authored notes.
- [threads.md](threads.md): event thread opening and rendering.

## Shared Contract

- Event-backed tabs use shared near-end thresholds and bottom status rows. See
  [event-surface-paging.md](../../architecture/data/event-surface-paging.md).
- Event rows render avatar, display name, secondary identity fallback,
  timestamp, and wrapped content consistently.
- Identity actions open Profile tabs in the same tile.
- Event rows, references, and continuation actions open Thread tabs in the same
  tile.
- Cached rows are safe to render when persisted arrays or optional fields are
  absent.
- Feed tabs may show partial relay rows while slower relays continue. Empty
  states mean terminal coverage, not merely "no fast relay answered yet."
- Event-rendering tabs preserve per-tab row anchors. The shared icon-only
  restore control is visible on Home, Global, Profile, Notifications, Thread,
  Search, Custom Request, and Author Context.
