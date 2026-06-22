# Deletion Ledger Evidence

## Purpose

This file owns current partial deletion evidence and remaining blockers.

## Details

Current `src/lib/feed-surface` evidence is partial only: Rust geometry,
fragments, row-key anchor restoration for inserted and stored anchors,
unload-stable reservations, and WASM bridge exist; shipped Svelte uses
temporary host fragments, estimates, and active reservation preservation. Rust
feed event bodies, `FeedEventRow` content/action rows,
unavailable preview states, author metadata fallback, sensitive warning reveal,
common state rows, and nearby/copy event menus now share Leptos rendering across
converted feed surfaces; copy-only menu providers and converted Author
Context/User Timeline action providers keep the menu available only from real
providers, and Rust event copy status text/reset timing matches retained Svelte.
Empty Rust action menus are suppressed when no provider exists.
Retained Svelte copy actions report clipboard
unavailable and rejected writes explicitly, optional retained event/profile
actions render static rows instead of no-op buttons, and Rust-island hosts
forward required workspace callbacks instead of dummy row actions while late
mount handles are unmounted before stale islands can attach. The dedicated
Author Context, Followees, and User Timeline Svelte tab wrappers are removed
and guarded absent by `pnpm check:repo`; generic workspace Rust-island host
glue mounts those Rust bodies, and `pnpm check:repo` rejects product-source
imports or mounts of retained Svelte feed tab bodies, TimelineTab support
files, and deleted feed tab wrappers while
`src/lib/follow-graph` and `src/lib/user-timeline` runtime modules stay blocked.
The old `src/lib/tabs/followees` helper directory is removed. The retained
shared Svelte event menu file and old menu helper are removed after product
import proof; `EventMeta.svelte` keeps overflow labels, propagation, nearby-author
dispatch, copy-action propagation, and copy status through `event-meta-overflow.ts`
and `event-meta-copy-status.ts`, and `pnpm check:repo` rejects old helper imports
plus copied deleted helper API names. Retained `EventRow.svelte` and
`EventFragmentRow.svelte` share tested activation dispatch, highlight scheduling/cleanup, and local-control helpers so
Enter opens the row, nested keys do not, and menu/action clicks do not open the
parent thread row; retained row frame/avatar chrome, row presentation, metadata, profile mentions, and reaction actors
share tested profile-open label, profile mention presentation, and no-op suppression, retained content references,
nested reposts, repost-target labels, attachments, summaries, and sensitive-content gates plus
warning chrome and labels/reveal propagation share tested content planning,
retained content tokens and emojified labels share tested key/token/emoji
planning, media attachments share tested open-target/dispatch, link-policy, and
propagation planning, and custom emoji images share tested safe-attribute/fallback planning. Inline event mentions
share tested resolver, relay, opener suppression, excerpt, and profile hydration/load-state planning; retained
reference previews share tested loading status/state, render visibility, load lifecycle, toggle propagation, and hydration planning. Retained reaction/repost
summaries share tested keys, labels, expansion, own markers, actor display/chrome, and actor open planning.
Retained event-list statuses share tested error/loading/end planning, and near-end
sentinels, near-start row targeting, auto-fill intent resets, newer-check scheduling,
paging gates, tree-cache keys, row-height key/tier selection, row render branches, and row data share tested planning.
Retained event action state scoping and event actions share tested mode,
action-label, control-state, panel-state, inline-panel and button chrome, run/completion lifecycle,
reply-submit/default prevention, key-submit, action-completion, emoji-source/reaction payload,
zap-panel labels, zap-submit lifecycle/gating/default prevention/state, zap-row
projection and chrome, invoice-copy lifecycle, and invoice-open planning/dispatch.
Retained reference previews share tested resolver-key and missing-author hydration planning plus tested list
toggle, card label, excerpt, media, relay/profile, opener availability, propagation, and keyboard/click activation planning. Docker
final-gate proof exists for the current repo state, and collapsed thread
continuation rows use `event-tree-list-continuation-plan.ts` for tested unavailable/openable planning and open dispatch, but broader
component deletion remains blocked until remaining parity and no-import gates
pass.
The unused `src/lib/feed-surface/staged-rows.ts` re-export, obsolete `row-shell.ts` helper, and standalone
`feed-geometry-estimate.ts`, `feed-scroll-key.ts`, `near-end-observer.ts`,
`notification-view-rows.ts`, `scroll-intent.ts`, and
`speculative-older.ts` helpers are removed and guarded absent from product imports.
Unused transitional helpers `src/lib/cache/event-store.ts`,
`src/lib/telemetry/runtime-health.ts`,
`src/lib/tweet/media-upload-providers.ts`, and
`src/lib/workspace/split-commands.ts` are removed and guarded absent from
product imports, while their parent module groups remain blocked.
Product source imports of retained `src/lib/user-timeline/**` runtime helpers are also guarded absent while tests may still cover those helpers.
Product source imports of retained `src/lib/follow-graph/**` runtime helpers
are also guarded absent outside retained Follow Graph and User Timeline internals.
Product source imports of retained `src/lib/search/search-query.ts` are guarded
absent while Search tokenizer/index helpers remain retained for storage paths.
Product source imports of retained `src/lib/notifications/notification-runtime.ts`
are guarded absent while notification state/store helpers remain retained.
Product source imports of retained `src/lib/profile/profile-runtime.ts` are
guarded absent while Profile paging/state/header helpers remain retained.
Product source imports of retained `src/lib/thread/thread-runtime.ts` are
guarded absent while Thread paging/store helpers remain retained.
Rust tests cover bounded action/repost rows, public User Timeline discovery
states, verified nested repost target rows with UI attribute proof,
nested-repost reservation invalidation, Rust/TypeScript declared-target
mismatch rejection, typed row-height observation/model SQLite rows, and Custom
Request durable relay geometry plus shared content dispatch/openers, row activation, opener parity, tab reuse, and action/link/media isolation proof, while
browser/deletion proof stays open except for the Home, Global, Notifications,
Profile, Thread, Search, Author Context, User Timeline, Custom Request,
Followees, Public Chat, and lkjstr Log one-scroll-owner row-flow, converted structural boundary, pane-body,
and horizontal-overflow browser proofs, Profile long-token wrapping, Notifications chrome/source-event sharing and wrapping, plus the Home long-post
segment, horizontal-overflow, multiline, tall-text scroll-continuity, late
profile hydration anchor, reference-preview hydration anchor, and media-resize
growth/shrink plus pane-width growth/shrink, live-insert top/non-top anchor, and event
LOD/profile/notification/repost-target shell anchor browser proofs.
Deleted row-shell, geometry-estimate, staged-row, feed-scroll key, near-end observer, notification view rows, scroll-intent, and speculative older helpers
are guarded absent. Broader Svelte event-row parity and no-import proof remain open.

Current storage deletion evidence remains blocked: Rust Stats consumes SQLite
inventory and health and renders feed-geometry and scan optimizer count rows;
active selector, pressure rows, command metadata, retention and repair readiness, and the
storage boundary guard have proof. TypeScript storage repositories still own
shipped Svelte surfaces until feed, Search, Stats surface parity, host-glue
carveout, and no-import proof exist.

When a row becomes removable, update the row with the Rust files, tests, and
verification commands that proved parity, then delete the TypeScript or Svelte
files in the same coherent change.
