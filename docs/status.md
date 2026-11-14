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

## Foundation (2026-11-14)

The [design](design.md) is copied verbatim. Themes, tiled workspaces, local
storage and shared relay planning are implemented. Protocol signing and
verification use `lkjstr-nips`. The previous resolved merge is retained in
`tmp/phase-a-merge.git`; original Git metadata is read-only outside this tree.
No commit or deployment was made.

## Phase C corrections (2026-11-14)

This phase is partial. The [parity inventory](parity.md) records mainstream
capabilities honestly. The art director's prerequisite corrections took priority;
no new account, messaging, payment or sync features were started.

Clean public addresses and focused document titles replace JSON hashes.
Focus changes replace history; in-tab navigation pushes it. Explicit addresses
add a tab to the saved desk; reload resumes that tab's saved history. Malformed
or unsupported routes have an honest Nothing here view. Old hashes are ignored.
Welcome is removed from the model, presets and launcher; the feed banner stays.

Japanese labels, tooltips, hints, states, time labels and formatting use core
string tables. A native build guard rejects direct literal UI prose and missing
translation entries. Settings retains storage status and retry feedback. Secret
searches never enter public view persistence, URLs or relay queries; signer
exceptions cannot echo arbitrary text into errors.

Identical preview details now open independently. Tabs have named, linked ARIA
panels, roving focus and arrow navigation. Account and tab menus restore focus and close on Escape.
Exact 40px keyboard resizing respects subtree minima and retains feed anchors.
The remaining view/action width caps are removed; short tiles hide feed banners
and filters. Sliver More menus retain Reply and Repost. See [details.md](details.md)
for the daily-use review and [design-review.md](design-review.md) for ambiguities.

The steward directory and the remote site branch did not exist at inspection.
No ADR files or separate static pages were available to merge or package.

## Phase B progress (2026-11-14)

This phase is partial. Nine independent workspaces have a top-bar switcher,
phone More chips, names, palette selection, keyboard selection/movement,
cache-based unseen dots, shared runtime, persistence and same-origin layout
sync. Switching remounts view bodies; network grace and robust cross-desk Undo
remain open. First run opens Global with a dismissible banner and removable
script filter; the script filter is a heuristic and resets on remount.
Tab allocation shares a bank-wide high-water mark across moves, switches and
imports; layout resets remap identities. Stale zoom clears on switching or tile
removal. Manual reference wants release with their owning view visibility.

Tabs add recent-activation focus, middle-close setting, filtered All tabs,
fixed or fit widths, stable closing widths, menu duplication/pinning/movement,
Escape drag cancellation, workspace-chip drops, draft-kept Undo and background
middle-click details. Container rules cover all current views down to 160px,
stack relay rows, simplify short tiles, equalise handles and zoom with Alt+Enter.
Complete touch gestures and all menu shortcuts remain.

Reading adds two-column reserved image galleries, whole-line text folds,
click-to-load audio/video, validated custom emoji names/notification reactions,
actor targets inside reposts and quotes, updating relative time, batched bounded
activity counts, offline status and data saver. The detail review is in
[details.md](details.md); source comparison is in [repost.md](repost.md).

Not implemented: NIP-23 article tiles, collapsed thread runs, feed windowing,
reliable reload/read markers, the emoji picker/set browser, complete reaction
optimism, redesigned composer, send hold/Undo, quote creation, uploads, own-note
deletion UI, worker verification, focus prefetch, noise expansion, translation,
phone swipes/pull. Existing posts and reactions
still use the account selected globally, not an independent voice per tile.

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

## Current verification

All four quiet gates pass, along with 117 smoke and 629 design/browser checks.
The final release tarball is `tmp/lkjstr-dist.tar.gz`; 166 PNGs are indexed below.
See [verification.md](verification.md) for the final quiet gates, fake-relay
results and limitations. Screenshots are indexed in `tmp/screens/INDEX.md`.
Packaging follows [README.md](../README.md#build). Docker image verification is
excluded by the worktree-only write rule. No public relays are used by tests.

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
2. Complete the remaining Phase B items above, then verify scroll restore and
   IndexedDB pruning at its bound.
3. Worker-side ingest (verification and indexing) with the same core crate.
4. Initial follow list creation after a proven empty relay response, relay
   list editing (publish kind 10002), and mute lists (kind 10000).
5. Adapt `lkjstr-host` to Trunk's `dist/` and restore the self-hosted image.
6. DMs via NIP-17 once `lkjstr-nips` lands; plug its scoring and outbox
   selection behind `plan::Directory` and `relays::Scores`.
