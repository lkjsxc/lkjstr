# Demand

## Purpose

A Demand describes what one runtime surface wants from relays. Demands are
pure data. They do not open sockets.

## Shape

| Field        | Meaning                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `surface`    | `home`, `global`, `profile`, `thread`, `notifications`, `search`, `custom-request`, `author-context` |
| `phase`      | `bootstrap`, `live`, or `page`                                                                       |
| `relays`     | Normalized, sorted relay URL list for this Demand                                                    |
| `filters`    | Sanitized Nostr filters after canonical normalization                                                |
| `purpose`    | `feed`, `metadata`, `event-lookup`, `route-discovery`, `search`                                      |
| `priority`   | `high`, `normal`, or `low` -- planner may defer low Demands under pressure                           |
| `owner`      | Stable owner id (`tabId` or tool session id) for refcount only                                       |
| `visibility` | `visible` or `hidden` -- hidden Demands do not keep live Leases                                      |

Optional fields:

- `since` / `until` for cursor windows on `page` and `live` phases.
- `limit` for bootstrap and page caps.
- `stalenessMs` for reattach without full bootstrap when a tab becomes visible again.

## Phase Semantics

- **bootstrap**: first paint window; bounded `limit`; closes on `EOSE`.
- **live**: forward tail after bootstrap cursor exists; uses `since` anchored to
  the newest accepted stored event plus a small clock-skew allowance (`30` s).
- **page**: explicit older or newer history fetch; one-shot; closes on `EOSE`,
  cap, timeout, or abort.

## Owner Rules

- `owner` is required for refcount and diagnostics.
- `owner` must never appear in lease fingerprints or relay-facing subscription ids.
- Multiple owners may attach to one Lease when Demands are compatible.
- Releasing a Demand decrements owner refcount synchronously on tab hide, tab
  close, or runtime `close()`.

## Visibility Rules

- `visible` feed Demands may hold live Leases after bootstrap completes.
- `hidden` feed Demands release live Leases immediately but keep durable
  cursors and in-memory windows until the runtime closes.
- Tool surfaces (`search`, `custom-request`) treat tab visibility the same way.

## Producer Rules

- Home, Global, Profile, Thread, and Notifications runtimes create Demands;
  they do not call `subscribeLive` or `readPage` directly.
- Follow-list discovery, metadata hydration, and route discovery use separate
  Demands with `purpose: metadata` or `route-discovery`.
- Feed bootstrap Demands accept only feed-renderable note kinds documented in
  each runtime page.
