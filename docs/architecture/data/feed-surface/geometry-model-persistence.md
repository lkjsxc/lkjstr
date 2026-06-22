# Feed Geometry Persistence

## Purpose

This file owns SQLite persistence, invalidation, retention, anchor compensation, and verification split from [geometry-model.md](geometry-model.md).

## Details

## SQLite Persistence Target

Worker-owned SQLite stores only bounded observation rows:

```text
persisted observation key
semantic row key
visual row key
row kind
event kind
content shape hash
width bucket
font scale bucket
density bucket
materialization tier
reference resolution state
media resolution state
nested repost state
action or reaction summary state
estimated height
measured height
confidence
sample count
geometry schema generation
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
them, but they are not active reservations or permanent minimums for the current
bucket.


## Bounded Retention

Session memory keeps a bounded least-recent observation map per surface family.
Durable SQLite keeps bounded samples by persisted observation key through typed
worker repositories. Retention drops low-confidence, old, superseded, or
pressure-selected geometry rows first. Durable cached events are not capped by
this geometry rule; only geometry observations are bounded here.


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
