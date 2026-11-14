# Status

## Purpose

What works today, what does not, and what to do next, in order. Update this
file in the same change that moves any of it.

## Cutover (2026-11-14)

The SvelteKit app, its TypeScript product code, the SQLite OPFS worker and the
Rust "island" crates (`lkjstr-app`, `lkjstr-domain`, `lkjstr-relays`,
`lkjstr-storage`, `lkjstr-ui`, the old `lkjstr-web`) were removed. The owner
asked for a WASM-first client with no backward compatibility. What remains:

- `lkjstr-protocol`: the tested Nostr kernel (events, ids, signatures, NIP-19,
  filters, relay messages, NIP-65, NIP-10 tags, NIP-36, NIP-57 helpers).
- `lkjstr-core` (new, pure, native tests): tiling layout, workspace commands,
  event store, request planner (orchestration), relay scoring, timelines,
  content segmentation.
- `lkjstr-web` (new): Leptos UI plus thin browser adapters (WebSocket,
  IndexedDB, NIP-07). Built by Trunk from the root `index.html`.

Stored data from the old app (SQLite OPFS, old IndexedDB layout) is ignored.

## Why the old app was replaced (evidence, 2026-11-14)

Probed with Chromium (Playwright) against the shipped SvelteKit dev server:

- Home on a clean start showed "Account storage unavailable",
  "account-storage-blocked" and "Configuration unavailable"; no timeline.
- Global rendered raw events of every kind: encrypted base64 blobs, JSON
  payloads, truncated hex ids and Unix timestamps, no names or avatars.
- The WASM bridge's start function mounted a second, hidden Rust shell into the
  Svelte page; that shell said feeds, relays and storage were not converted.
- Default relay `wss://relay.damus.io` failed (HTTP 521) and nothing routed
  around it.

## Implemented

Which of these were exercised in a real browser, and how, is recorded in
[verification.md](verification.md).

- Tiled workspace: split, stack, resize, drag tabs to edges or strips, close,
  New tab launcher, keyboard focus and movement, layout saved per device.
- Single-column mode under 760px: only the focused tile shows.
- Global, Home (follows of the active account), Notifications (mentions,
  replies, reactions, reposts, zaps), Profile (header plus notes), Thread
  (root, replies, indentation, focused note), Search (local cache plus NIP-50
  relays; npub, nprofile, note and nevent open directly).
- Accounts: create a local key, import nsec (signs) or npub (read only), NIP-07
  extension, switch, remove, explicit "Back up key".
- Compose and reply with drafts kept per tab; like (and unlike via deletion),
  repost, follow and unfollow (refused until the follow list is loaded).
- Publishing is optimistic: the note shows at once, each relay's OK or refusal
  is listed, silence after 10 s counts as no answer.
- Relays view: per-relay state, requests, latency, events and score.
- Light, dark and system themes; three text sizes.

## Orchestration: implemented versus planned

Implemented:

- Tiles register wants (`Notes`, `Global`, `Mentions`, `Thread`, `Events`,
  `Profiles`, `Search`) only while visible; hidden tabs and hidden browser tabs
  release them.
- The planner (pure, tested) routes authors to their NIP-65 write relays
  (outbox), falls back to scored defaults, merges authors across tiles into one
  REQ per relay, batches profile and event lookups, caps distinct relays.
- The runtime diffs plans into REQ and CLOSE, queues beyond 10 requests per
  relay, closes one-shot requests at EOSE, and reports progress per want.
- Relay scoring: latency (EWMA), answer rate, connect failures, yield of new
  events, freshness; slow requests (4 s) lower the score so replans hedge
  elsewhere; failures back off with equal-jitter exponential delay; scores
  persist in IndexedDB. NIP-42 AUTH is answered with a local key only.
- Ingest verifies ids and signatures in 8 ms slices off the socket callback,
  deduplicates before verifying, unpacks kind 6 reposts, applies kind 5
  deletions by the same author, keeps at most 20000 events in memory.
- Local-first: the newest 8000 stored events load before the first plan;
  timelines render from the store and new notes wait behind a "new" marker
  unless the reader is at the top.
- Prefetch: profiles, reply parents, quotes and repost targets of the first 60
  rendered rows of each visible tile.

Planned (not built):

- Parsing and verification in a Web Worker running the same WASM core.
- Hover or focus warming of threads and profiles; idle-time budgets.
- `since` on re-subscription to avoid re-fetching after a replan.
- Scroll position restore across reloads; per-tab feed state persistence.
- IndexedDB pruning (the events store grows without bound today).

## Does not work yet

- `lkjstr-host` (self-hosting server) still validates the old bridge layout;
  it compiles and its tests pass but it rejects Trunk's `dist/`.
- No DMs (NIP-04, NIP-17), zap sending, media upload, relay list editing,
  mute lists, custom emoji picker, profile editing.
- Virtualisation is `content-visibility` plus a 600-row cap, not windowing.
- Notification read state is not tracked.

## Next steps, in order

1. Browser smoke against a scripted fake relay in CI (publish, reload,
   persistence) using `scripts/browser-smoke.mjs`.
2. Worker-side ingest (verification and indexing) with the same core crate.
3. Relay list editing (publish kind 10002) and mute lists (kind 10000).
4. DMs via NIP-17 once `lkjstr-nips` lands; plug its scoring and outbox
   selection behind `plan::Directory` and `relays::Scores`.
5. IndexedDB pruning and scroll restore.
6. Adapt `lkjstr-host` to Trunk's `dist/` and restore the self-hosted image.
