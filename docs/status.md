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
The incompatible WASM schema uses `lkjstr-wasm`, leaving previous `lkjstr` alone.

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

## Phase A foundation (2026-11-14)

The authoritative [design](design.md) is copied verbatim. Exact theme tokens,
readable contrast tests, system type, hairlines, plain tabs, SVG note actions,
reaction chips, rounded-square avatars, date dividers, density and motion rules
are implemented. The frame has an avatar menu and search/command entry. The
phone frame fills 390px, with scrolling tabs, bottom navigation and More.

Identical views open independently, including launchers and reply drafts.
Details use neighbour previews or a split with a 360px minimum per half;
kept tabs, per-tab history, public view URLs, layout undo and reopening are
implemented. History retains 64 entries per tab; recovery retains 32 layouts.
Image links open image tiles. Website tiles offer an external-browser action.
Visible relay wants have cancellable 12-second deadlines and retry actions;
storage promises have 15-second deadlines, signer promises 30 seconds.
Mixed relay deadlines retain answered live streams and cancel unanswered work;
retry preserves healthy subscriptions. Reopening an unchanged preview activates
it without changing history. Image retries create a fresh request. Reactions
and reposts use protocol targets. Pane recovery records one closure.

The NIP branch is integrated in source; signing and signature verification use
`lkjstr-nips`. Original linked-worktree Git metadata is read-only outside this
worktree. The resolved, uncommitted merge is in `tmp/phase-a-merge.git`; the
orchestrator must record it in the original metadata. No commit was made.

Not finished: nine workspaces, first-run Global/banner/language filter,
complete Japanese strings, emoji picker, full note menus, phone gestures,
advanced tab gestures/settings, container-size rules, and all modifier paths.
Scroll restoration after reload still needs a dedicated browser regression.
The source document's experience promises are not all complete.

## Implemented

Which of these were exercised in a real browser, and how, is recorded in
[verification.md](verification.md).

- Tiled workspace: split, stack, resize, drag tabs to edges or strips, close,
  New tab launcher, keyboard focus and movement, layout saved per device.
- Single-column mode under 760px: only the focused tile shows.
- Global, Home (follows of the active account plus your own notes; without
  a follow list it shows your notes; an empty feed explains the missing list),
  Notifications (mentions,
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

## Current verification (2026-11-14)

The foundation fake-relay browser smoke passes 90 checks on a release build. The earlier 51-check suite passed debug and release builds.
It covers generated local accounts, invalid and read-only imports, account
switching and removal, signing, compose, threads, profiles, empty and populated
notifications, local and relay search, and direct NIP-19 navigation. It verifies
all submitted ids and signatures through `lkjstr-protocol`. Reload checks
prove cached events render with relay replay disabled. All sockets terminate
at the fake relay and external HTTP is blocked; no public relays are used.

Review regressions cover storage open/write/transaction-abort failures,
modified note keys, missing reply parents, late repost targets, terminal
thread lookups, filtered pagination (including timestamp ties), AUTH retries
and idle socket release. Native tests cover deletion ownership, replaceable
ties and retention/index cleanup, publication guards and relay scheduling.
Account changes install only after secret/session records commit atomically.
Quotes and reply parents share the terminal lookup states used by reposts.
Second-review fixes bind extension signatures to every requested field and verify
IDs/signatures, await storage commits, retry failed event batches, and bound
pending persistence to 20000 events plus a 500-event transaction snapshot.
Storage-open failure buffers nothing. Synchronous socket construction failures
use the same backoff/replan path as connection loss. Displayed notes have live
deletion watches; quote and mention references do not count as replies.
Content-only note/nevent quotes prefetch their targets and relay hints.
Plain text, invalid markup and trailing punctuation are scanned linearly.
Quiet gates print one success line; build aliases handle `NO_COLOR=1`.

`pnpm check:repo`, `pnpm test:quiet`, `pnpm rust-wasm:quiet` and
`pnpm verify:quiet` pass.
The gates produce a checked Trunk release; the static output loads without
asset or page errors. Docker verification is pending because
this run forbids writes outside the worktree; image builds write to daemon
storage. See [verification.md](verification.md) for evidence and limits.
The static hosting tarball procedure is in [README.md](../README.md#build).

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
  deletions by the same author (including targets arriving later). Independent
  caps retain 16000 regular and 4000 replaceable events, cleaning all indexes
  on eviction; rejected events do not retain relay hints.
- Local-first: the newest 8000 stored events load before the first plan;
  timelines render from the store and new notes wait behind a "new" marker
  unless the reader is at the top.
- Prefetch: profiles, reply parents, quotes (tags and content pointers) and
  repost targets of the first 60 rows; live deletion watches cover up to 600
  rendered rows plus 120 cached references. Hints are capped at 12 per want.

Built but not working or not verified:

- Scroll memory per feed tab: the top visible note is saved (checked in
  IndexedDB), but restoring it after a reload did not work in a browser check
  on Global. Investigate `ui/feed_memory.rs` and the first Global render first.
  The review smoke's cache discrepancy was a test wait bug: an async predicate
  returned a truthy Promise before the cache flush. Explicit polling now waits
  for committed event rows before reloading.
- IndexedDB pruning (oldest rows beyond 60000, down to 50000, 20 s after
  boot) is implemented but not exercised in a browser.

Planned (not built):

- Parsing and verification in a Web Worker running the same WASM core.
- Hover or focus warming of threads and profiles; idle-time budgets.
- `since` on re-subscription to avoid re-fetching after a replan.
- Per-account feed state persistence beyond the current tab anchor.

## Does not work yet

- `lkjstr-host` (self-hosting server) still validates the old bridge layout;
  it compiles and its tests pass but it rejects Trunk's `dist/`.
- A new account cannot create its first follow list from Profile; follow and
  unfollow require an existing loaded kind 3 event.
- No DMs (NIP-04, NIP-17), zap sending, media upload, relay list editing,
  mute lists, custom emoji picker, profile editing.
- Virtualisation is `content-visibility` plus a 600-row cap, not windowing.
  Each feed scans at most 6000 raw rows, including hidden noise.
- Release WASM is 13.6 MB (1.2 MB gzip) because wasm-opt is off
  (`data-wasm-opt="0"` avoids a download); enable it for size.
- Notification read state is not tracked.

## Next steps, in order

1. Run Docker Compose `verify` where image storage writes are allowed, then
   add the fake-relay browser smoke to CI (needs Chromium in the image).
2. Complete the remaining Phase A items above, then verify scroll restore and
   IndexedDB pruning at its bound.
3. Worker-side ingest (verification and indexing) with the same core crate.
4. Initial follow list creation after a proven empty relay response, relay
   list editing (publish kind 10002), and mute lists (kind 10000).
5. Adapt `lkjstr-host` to Trunk's `dist/` and restore the self-hosted image.
6. DMs via NIP-17 once `lkjstr-nips` lands; plug its scoring and outbox
   selection behind `plan::Directory` and `relays::Scores`.
