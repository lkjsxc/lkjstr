# Notifications, Profile, Thread, and Tools

## Purpose

Describe how non-Home feed surfaces submit orchestrator intents.

## Notifications

- Live: `submitLiveIntent` with `#p` filters built in `demand-build.ts`.
- Page: `readPageByIntent` for initial and older notification windows.
- Owner: tab id; dedupe by account, relays, and cursor bounds.

## Profile

- Live and page intents include profile pubkey as author scope.
- Route plan may widen to author write relays via `surface-routing.ts`.

## Thread

- Live intents include thread root and reply filters.
- Hint relays from event receipts may widen the route plan.

## Global

- Similar to Home without follow-list bootstrap; global live uses selected relays.

## Search, Custom Request, Author Context

- Isolated owners per tool tab.
- Same orchestrator; dedupe applies when semantic intent matches.

## Related

- [routing-by-surface.md](routing-by-surface.md)
- [../../feeds/orchestration-bridge.md](../../feeds/orchestration-bridge.md)
