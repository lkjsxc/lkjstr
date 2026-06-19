# Feed Scroll Regression Tests

## Purpose

This checklist defines focused tests that prove feed scrolling remains stable
for oversized content, delayed enrichment, unload, dematerialization, repost
rendering, and split-pane resize.

## Status

Status: active implementation target. Unit tests cover pure Rust reducers and
host-boundary tests cover DOM scroll behavior that Node cannot represent. Home
browser proofs cover oversized text, long tokens, Profile note overflow, line breaks, late profile
hydration, reference-preview hydration, media dimension growth/shrink,
pane-width growth/shrink, live insert top/non-top provider updates,
Notifications chrome/source-event scroll ownership and overflow wrapping, feed/form tab track-edge
alignment, converted-feed structural scroll-owner, pane-body, and
horizontal-overflow boundaries, Public Chat honest empty-state and lkjstr Log
durable-row scroll ownership, and event LOD, profile-card, notification, and repost-target shell
dematerialization above the visible row anchor. Home disables native overflow anchoring so Rust owns row height
compensation.

## Required Fixtures

Fixtures must be deterministic real Nostr event-shaped records. Prefer valid
ids and signatures generated through the protocol path. If a host test cannot
sign at runtime, store the generated event with a comment naming the generator.

Fixture set:

- text note with at least 20,000 visible characters.
- text note with at least 300 line breaks.
- text note with one very long unbroken token or URL.
- note with real reference tags and delayed profile hydration.
- note with media metadata that becomes known after initial render.

Synthetic relays are allowed only as test harnesses. Product rows must represent
real event data or explicit unavailable states.

## Browser Or Host-Boundary Tests

| Test | Assertion |
| --- | --- |
| Tall text note | User can scroll from above the note to below it. |
| Long unbroken URL or token | `[data-scroll-owner]` has no horizontal overflow. |
| Many line breaks | Row segmentation preserves order and scroll continuity. |
| Late profile hydration above viewport | `scrollTop` changes by measured delta and visible anchor remains. |
| Reference preview hydration above viewport | `scrollTop` changes by measured delta and visible anchor remains. |
| Media dimension growth/shrink above viewport | Rust changes `scrollTop` by measured delta and visible anchor remains. |
| Event row unload | Measured reservation does not shrink. |
| Profile card unload | Dematerialized profile shell preserves measured block height and the visible anchor. |
| Notification row unload | Dematerialized notification shell preserves measured block height and the visible anchor. |
| Repost target unload | Dematerialized repost-target shell preserves measured block height and the visible anchor. |
| LOD shell | Dematerialized shell preserves measured block height and the visible anchor. |
| Split-pane width shrink | Row remeasurement grows above-viewport height and preserves the visible anchor. |
| Split-pane width widen | Row remeasurement shrinks above-viewport height and preserves the visible anchor. |
| Live insert above non-top anchor | Existing visible content remains visible. |
| User at top with live insert | Top-anchor policy shows new resident rows immediately. |
| Notifications | Notification chrome and referenced event preview share one scroll owner. |
| Profile summary | Profile summary and notes share one scroll owner. |
| Public Chat | Honest empty channel/message states share one scroll owner. |
| lkjstr Log | Durable log actions, status, and rows share one scroll owner. |
| Horizontal overflow | Scroll owners report `scrollWidth <= clientWidth + 1`. |
| Tab kind switch in same pane | Feed and form tab scroll owners share the same track-edge inset within one device pixel. |

## Structural Audit Tests

Each feed-like surface must assert:

- exactly one `[data-scroll-owner]` inside the tab body.
- no nested vertical `overflow: auto` between `.feed-tab` and the scroll owner.
- `.pane-body` is not the feed tab's vertical scroll owner.
- status rows are inside the scroll flow.
- scrollbar right edge is inset by the shared `--scroll-track-edge` token within
  one device pixel.

Feed-like surfaces: Home, Global, Profile, Thread, Search, Notifications,
Custom Request, Author Context, Public Chat feed paths, and lkjstr Log when it
renders long chronological rows.

## Pure Reducer Tests

Rust tests must cover:

- feature extraction for short notes, long notes, line breaks, long tokens,
  URLs, media, references, and custom emoji.
- content-shape hash stability and change detection.
- normal rows staying single and oversized rows fragmenting.
- text segments joining exactly to original content.
- stable fragment keys.
- reservation reducer for row measured, unloaded, rematerialized, width bucket,
  font bucket, density bucket, content shape, schema generation, and expiration
  actions.
- anchor reconcile for height increase, height decrease, row removal, live
  inserts, partial anchor-row changes, dematerialization, and empty feeds.
- shared event display planning for normal event rows, repost targets, compact
  unavailable targets, and notification repost references.

## Diagnostics Tests

Stats must show bounded aggregate diagnostics for:

- geometry bridge status.
- measured session row count.
- persisted observation count.
- visible fragment count.
- oversized semantic row count.
- unload-preserved reservation count.
- anchor compensation count and last delta.
- width-bucket distribution.
- stale observations dropped.
