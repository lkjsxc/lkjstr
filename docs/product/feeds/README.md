# Feed Surfaces

## Purpose

Feed surface docs define relay-backed read tabs and action-opened read tabs.

## Table of Contents

- [followees.md](followees.md): viewed-profile following list.
- [global.md](global.md): relay-wide note feed behavior.
- [home.md](home.md): account-follow feed behavior.
- [notifications.md](notifications.md): account activity behavior.
- [profiles.md](profiles.md): profile opening and authored notes.
- [public-chat.md](public-chat.md): NIP-28 channel chat behavior.
- [threads.md](threads.md): event thread opening and rendering.
- [user-timeline.md](user-timeline.md): public timeline for another user's follow graph.

## Shared Contract

- Event-backed tabs use shared near-end thresholds and bottom status rows. See
  [event-surface-paging.md](../../architecture/data/event-surface-paging.md).
- Event rows render avatar, display name, secondary identity fallback,
  timestamp, and wrapped content consistently.
- Identity actions open Profile tabs in the same tile.
- Profile following counts open Followees tabs in the same tile when a real
  follow list is known.
- Followee rows and profile actions open User Timeline tabs in the same tile.
- Event rows, references, and continuation actions open Thread tabs in the same
  tile.
- Cached rows are safe to render when persisted arrays or optional fields are
  absent.
- Feed tabs may show partial relay rows while slower relays continue. Empty
  states mean terminal coverage, not merely "no fast relay answered yet."
- User Timeline discovery reports attempted route groups, degraded target-only
  mode, retry affordances, and incomplete diagnostics without inferring absence
  from cache misses.
- Event-rendering tabs automatically restore per-tab row anchors on Home,
  Global, Profile, Notifications, Thread, Search, Custom Request, Author
  Context, and Public Chat.
