# Long Feed Content

## Purpose

This contract defines how feed surfaces represent very long real event content
without adding nested scrolling, fake rows, or placeholder product data.

## Status

Status: active implementation target. The shipped Svelte feed must consume this
model while Leptos parity remains incomplete. Rust owns the durable planner
when the WASM bridge is available; any TypeScript path is temporary host glue.

## Scroll Invariant

- A feed tab has one vertical scroll owner: the element marked
  `[data-scroll-owner]`.
- Oversized semantic events stay in that same scroll flow.
- Posts must not contain nested vertical `overflow: auto`, `overflow-y: auto`,
  or independent virtual lists.
- Horizontal overflow is prevented at row and content boundaries; long text uses
  safe wrapping instead of widening the scroll owner.

## Visual Fragment Model

A normal event may render as one `event-full` visual row. An oversized event is
split into real visual fragments that all point back to the same semantic Nostr
event:

```text
event-header
event-text-segment...
event-media-segment...
event-reference-segment...
event-actions
```

Fragments are layout rows, not protocol events. They inherit:

- event id, event kind, pubkey, created-at time, and relay provenance.
- tab action semantics such as reply, repost, reaction, zap, menu, and thread
  navigation.
- ordering relative to surrounding feed rows.
- content warning and custom emoji rendering rules from the semantic event.

## Text Preservation

- Text segmentation preserves exact content: joining every segment in order must
  equal the original event `content` byte-for-byte after JavaScript string or
  Rust `String` decoding.
- Splits occur only at valid Unicode boundaries.
- The planner prefers paragraph boundaries, then whitespace boundaries, then
  scalar-value boundaries when a single token is too long.
- Long unbroken tokens are not rewritten. CSS may wrap them visually, but copy
  and event identity still use the original content.

## Allowed Fragment Families

- Text segments from real `content`.
- Media groups parsed from real tags or real content references.
- Reference previews backed by real events, or a compact unavailable fragment.
- Action bars attached to the semantic event.
- Header or metadata chrome derived from the real event and hydrated profile
  state.

The planner must never synthesize posts, previews, profiles, media, relay
results, success states, or missing content.

## Segment Constants

These constants keep one visual row near a predictable height while preserving
readability:

| Constant | Value | Rationale |
| --- | ---: | --- |
| `TEXT_SEGMENT_TARGET_CHARS` | 1800 | Usually below one tall viewport on narrow panes. |
| `TEXT_SEGMENT_MAX_CHARS` | 2400 | Prevents runaway virtualizer estimates for paragraphs. |
| `OVERSIZE_ESTIMATED_HEIGHT` | 1400 px | Above this, a semantic event should fragment. |
| `MEDIA_ITEMS_PER_SEGMENT` | 2 | Keeps media groups measurable without nested scroll. |
| `REFERENCES_PER_SEGMENT` | 1 | Reference previews hydrate independently. |

Tests must lock these values or explicitly update this document with a better
rationale.

## Fragment Keys

Fragment keys are stable and content-derived:

```text
event:<event-id>:shape:<content-shape-hash>:kind:<fragment-kind>:index:<index>
```

Keys must not include tab id, pane id, request id, owner id, relay connection
id, or any volatile runtime handle.

## Verification

- Normal-size notes render as a single `event-full` row.
- Oversized text notes render multiple real text fragments.
- `segments.join("")` equals the original content.
- Fragment keys stay stable across rerenders and change when content shape
  changes.
- Actions remain associated with the semantic event.
- No nested scroll container appears inside a post.
- Home, Global, Profile, Thread, Search, and Notifications use the same model.
