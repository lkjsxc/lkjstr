# Notifications

## Purpose

Notification indexing, relay sync, presentation, and runtime for the
Notifications tab.

## Documents

[docs/architecture/feeds/sources/notifications.md](../../../docs/architecture/feeds/sources/notifications.md)

## Modules

| Module                         | Role                           |
| ------------------------------ | ------------------------------ |
| `notification-runtime.ts`      | Tab runtime and relay Demands  |
| `notification-filters.ts`      | `#p` wire filters              |
| `notification-reducer.ts`      | Record merge by id             |
| `notification-index.ts`        | Derive records from events     |
| `notification-store.ts`        | Local notification storage     |
| `notification-window.ts`       | 180-record window              |
| `notification-relays.ts`       | Relay selection for `#p` reads |
| `notification-presentation.ts` | Row labels and context         |

## Rules

- Filters target `#p`, not Home `authors`.
- Self-authored events are excluded in `deriveNotifications`.
