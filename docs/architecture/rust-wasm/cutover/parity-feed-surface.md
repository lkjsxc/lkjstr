# Feed Surface Parity

## Purpose

This file owns feed surface parity requirements and current evidence.

## Details

Feed-like surfaces cannot be marked `implemented` until this shared proof exists:

| Requirement                 | Proof before feed-surface parity                                       |
| --------------------------- | ---------------------------------------------------------------------- |
| Rust row-fragment planner   | oversized text, media, reference, and action tests                     |
| Rust geometry estimator     | feature, bucket, hash, and confidence tests                            |
| Rust anchor reducer         | height delta, live insert, resize, and fallback tests                  |
| Stable height after unload  | event, profile, notification, repost target, shell, and LOD tests      |
| Anchor after dematerialize  | unload-preserved height and allowed shrink compensation tests          |
| Pane resize remeasurement   | width-bucket change can shrink or grow with anchor preservation        |
| WASM bridge tests           | serialization and explicit unavailable/error states                    |
| Svelte temporary bridge use | shipped feeds consume the same model while Svelte remains runtime      |
| Leptos feed surface use     | visible rows, footer rows, and scroll retention match product behavior |
| Scroll regression tests     | tall text, long token, hydration, media, resize, and overflow coverage |
| Deletion-ledger update      | `src/lib/feed-surface` row records files, tests, and no-import proof   |

Current feed-surface evidence: Rust planner, estimator, anchor reducer,
height-reservation reducer, row view model, first Home row rendering, WASM
bridge, and typed row-height observation/model SQLite rows exist with focused
tests; fragmented row-key anchors restore the intended fragment after inserted
rows and from stored feed anchors, and Home browser proofs cover long-post
segments plus profile/reference hydration, media-resize growth/shrink, live insert top/non-top,
and pane-width growth/shrink plus Profile long-token wrapping and event
LOD/profile/notification/repost-target shell reserved-height anchor preservation.
Home, Global, Notifications, Profile, Thread, Search, Author Context, and User
Timeline cached rows consume durable models; Custom Request relay snapshots load
matching durable models before rebuild. Converted event and header relay rebuilds retain them. Rust Home, Global,
Notifications, and Profile tabs can load SQLite cache evidence into shared feed
rows, keep exact
coverage proof explicit, start bounded relay reads where converted, and suppress
late completions after cleanup. Notifications cache-complete visible rows skip
initial relay reads, while empty exact windows keep probing older history.
Home, Global, Notifications, Profile, Thread, Search, Author Context,
User Timeline, Custom Request, Followees, Public Chat, and lkjstr Log prove one
scroll-owner row flow, converted structural scroll boundaries, non-scrolling
pane bodies, no horizontal overflow, and feed/form tab track-edge alignment.
Notifications also proves chrome/source-event sharing plus overflow wrapping, and Global proves footer, scroll and
viewport-fill older requests,
plus compound older relay cursor filtering.
The shipped Svelte Home, Global, Profile, Thread, and Notifications tabs now mount Rust bodies as WASM
islands, forward real workspace actions, and use worker feed providers.
Profile also proves cached and relay-refreshed
metadata/follow-count header rendering, the Followees/User Timeline/Profile
Edit actions, local/NIP-07 follow publish, and sparse empty coverage rules.
Rust Followees now has first Leptos rows from real NIP-02 entries injected
through a provider, and the default browser provider reads cached kind `3` rows
from worker SQLite, starts selected-relay or stored author-route kind `3`
discovery on cache miss, excludes disabled stored route relays, and closes the
owner relay read on cleanup; no-event selected reads render retry diagnostics,
and the shipped workspace mounts the Rust body through generic island host glue
with row Profile, Timeline, and Copy npub actions. Followees headers and rows
now carry cached kind `0` display names, NIP-05 subtitles, and avatars when
present, with non-raw fallbacks instead of compact raw pubkeys.
Rust User Timeline
has first Leptos feed rows from a real NIP-02 author set injected through a
provider and a default browser provider that reads cached kind `3` author sets
plus display rows as partial cache evidence, starts selected-relay kind `3`
discovery on cache miss, and keeps real cached target-authored posts as
explicit target-posts-only degraded mode after exhausted follow-list discovery;
stored NIP-65/provenance/target author routes can discover kind `3` without
selected relays, disabled stored route relays stay excluded, no-event selected
AUTH/rate-limited/timeout reads render explicit diagnostics, partial route
failure stays diagnostic, and owner cleanup closes the relay read. Coverage
and deletion proof remain open. The shipped Svelte User Timeline tab now mounts
the Rust body as a WASM island, forwards profile, thread, and Author Context
actions without no-op fallbacks, and releases the island on visibility changes
or destruction.
The shipped Svelte Search tab now mounts the Rust body as a WASM island,
forwards real workspace actions, and preserves `searchQuery` snapshots through
typed callback glue. Search deletion proof remains open.
The shipped Svelte Custom Request tab now mounts the Rust body as a WASM
island, forwards real workspace actions, and preserves `customRequestInput`
plus `customRequestRan` snapshots through typed callback glue. Custom Request
Rust app/UI/Web tests also prove exact search mode, user filter-bound wire
requests, selected-relay demand, NIP-11 clamp diagnostics, relay result rows,
and restore. Deletion proof remains open.
Rust Author Context now has a first Leptos body that renders real shared-feed
rows supplied through an injected `AuthorContextFeedProvider`. The app view
model exposes anchor and nearby query-demand inputs, and missing event id,
missing author pubkey, no route/relay input, and missing anchor timestamp
produce explicit unavailable or partial rows. The default browser provider reads
cached anchor and nearby author event rows from worker SQLite and renders them
as partial cache evidence. Bounded selected-relay reads around the cached
anchor, exact anchor lookup through stored author routes, and row action
buttons plus host-backed event-id copy/status reset and the Rust menu shell are wired,
the shipped Svelte tab mounts the Rust body with required workspace callbacks,
and browser proof covers explicit unavailable states plus island mount/unmount.
No-import proof and deletion proof remain open.
Rust Thread now loads cached focused/root events, cached replies by `#e` root
or focused-event tags, bounded cached parent-chain rows by exact id, bounded
bootstrap relay snapshots, explicit older footer-command page reads,
downward-scroll older requests, and underfilled viewport older requests into
`ThreadFeedView` rows. Bootstrap completion starts a bounded live reply window
from the newest retained row. Terminal parent misses render unavailable-parent
rows, capped branches render continuation rows, and Thread stays partial until
broader parity and deletion proof are converted.
Broader Rust feed runtime tests prove owner release removes live demand, closes
wire traffic, and keeps bounded windows for every shared `QuerySurface`: Home,
Global, Profile, User Timeline, Thread, Notifications, Search, Custom Request,
and Author Context. The shipped Svelte feed
uses temporary matching host glue for content-aware estimates,
unload-preserved active reservations, and long-content fragments. Durable
geometry model consumption beyond
Home/Global/Notifications/Profile/Thread/Search/Custom Request/Author Context/User Timeline,
deeper runtime Stats counters, deletion proof, and broader browser scroll
regression proof remain open.
