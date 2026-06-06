# Feed Geometry Model

## Purpose

This contract defines row geometry keys, reservations, invalidation, retention,
and persistence for feed-like scroll surfaces.

## Status

Status: partially implemented. Rust owns feature extraction, estimation,
content-shape hashing, anchor reducers, and WASM bridge calls. The shipped
Svelte feed uses temporary matching host glue while Leptos feed parity and
SQLite observation persistence remain active targets.

## Terms

- **Semantic row key**: stable identity of the product row, such as an event id,
  notification id, profile summary id, log row id, or unavailable reference id.
- **Visual row key**: semantic row key plus visual fragment kind and fragment
  index. A semantic event may produce several visual rows.
- **Geometry key**: reusable measurement key for a visual row shape in a layout
  bucket.
- **Content shape hash**: deterministic hash of height-affecting features that
  does not store full content.
- **Layout bucket**: width bucket, font scale bucket, density bucket, and
  geometry schema generation.
- **Measured height**: observed materialized row height for the active geometry
  key and layout bucket.
- **Estimated height**: deterministic model output used before measurement.
- **Reserved height**: active block height used by the scroll model.
- **Confidence**: fallback, session, durable, degraded, or stale.
- **Measurement generation**: schema-controlled number that invalidates old
  observations when row geometry rules change.

## Geometry Key

A geometry key includes:

```text
semantic row key
visual row key
surface row kind
event kind when present
content shape hash
fragment kind
fragment index
width bucket
font scale bucket
density bucket
measurement generation
```

It must not include tab id, pane id, request id, owner handle, relay socket id,
current scroll offset, wall-clock render timing, or transient hydration state.

## Content Shape Hash

The content shape hash is derived from:

```text
content length
Unicode scalar count
line break count
longest unbroken token length
URL count
media count
reference preview count
custom emoji count
content warning flag
fragment count
known media dimension bucket
known reference state bucket
```

It changes when the semantic layout shape changes. It does not replace event id
identity and does not store event text in SQLite.

## Buckets

Width buckets:

```text
0-319
320-479
480-639
640-799
800-1023
1024+
```

Font-scale buckets:

```text
0.75-0.89
0.90-1.09
1.10-1.29
1.30-1.59
1.60+
```

Density buckets are explicit app-density labels such as compact, normal, and
comfortable. Crossing any bucket makes measurements from the previous bucket
inactive for the current row.

## Reserved Height Decision

The reducer receives previous state and an action, then returns the next active
reservation and diagnostics.

Actions:

```text
row_measured
row_unloaded
row_rematerialized
width_bucket_changed
font_bucket_changed
density_bucket_changed
content_shape_changed
schema_generation_changed
measurement_expired
```

Rules:

- `row_unloaded` keeps the previous reserved height.
- `row_rematerialized` keeps the reservation until measurement in the current
  layout bucket.
- `row_measured` may increase or decrease only when materialized in the current
  layout bucket.
- Width, font, density, content shape, and schema-generation changes choose a
  matching observation or estimate; they may shrink.
- Expired measurement falls back to an estimate with stale or degraded
  confidence, not a false current measurement.

## Confidence

| Confidence | Meaning |
| --- | --- |
| `fallback` | No matching observation; content-aware formula only. |
| `session` | Current browser session has a matching measured row. |
| `durable` | SQLite has matching observations for this geometry key. |
| `degraded` | Anchor fallback or stale compatible data was used. |
| `stale` | Old measurement is visible only as diagnostic history. |

Product UI may show aggregate diagnostics, but it must not expose unbounded
per-event labels.

## SQLite Persistence Target

Worker-owned SQLite stores only:

```text
geometry key
semantic row key
visual row key
content shape hash
width bucket
font scale bucket
density bucket
estimated height
measured height
confidence
sample count
measurement generation
last observed time
```

It does not store full event content, profile records, tab ownership, pane
ownership, relay handles, or raw diagnostic traces.

## Invalidation Rules

Ignore or discard observations when:

- measurement generation changes.
- semantic row key or visual row key changes.
- content shape hash changes.
- width, font, or density bucket changes without a matching observation.
- row family is no longer produced by the planner.
- sample is beyond retention horizon and low confidence.
- storage pressure selects geometry rows after protected product records.

Old observations for other buckets may remain durable until retention removes
them, but they are not active reservations for the current bucket.

## Bounded Retention

Session memory keeps a bounded least-recent observation map per surface family.
Durable storage keeps bounded samples by geometry key and drops low-confidence,
old, or superseded rows first. Durable cached events are not capped by this
geometry rule; only geometry observations are bounded here.

## Anchor Compensation

When an allowed remeasurement changes rows above the anchor:

```text
scroll_delta = sum(new_reserved_height - old_reserved_height)
```

The scroll owner applies the delta once. If the anchor row changes while visible,
preserve the offset inside that row. If the anchor row disappears because filters
or retention changed, choose the nearest surviving row and mark confidence
`degraded`.

## Verification

- Very long text receives a large initial estimate.
- Many line breaks and long tokens affect the estimate.
- Unload and dematerialization preserve reserved height.
- Width-bucket resize can shrink stale narrow measurements.
- Content-shape and measurement-generation changes invalidate old measurements.
- Late profile, reference, and media hydration above the viewport preserve the
  visible anchor.
- Stats reports bounded geometry counts, unload-preserved counts, anchor
  compensations, stale ignores, and retention drops.
