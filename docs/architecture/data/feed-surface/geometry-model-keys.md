# Feed Geometry Keys

## Purpose

This file owns geometry terms, keys, content shape hashing, and buckets split from [geometry-model.md](geometry-model.md).

## Details

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
- **Enrichment state**: reference resolution, media resolution, nested repost,
  and action or reaction summary state.
- **Measured height**: observed materialized row height for the active geometry
  key and layout bucket.
- **Estimated height**: deterministic model output used before measurement.
- **Reserved height**: active block height used by the scroll model.
- **Confidence**: fallback, session, durable, degraded, or stale.
- **Measurement generation**: schema-controlled number that invalidates old
  observations when row geometry rules change.


## Geometry Key

A persisted observation key includes:

```text
row kind
event kind when present
content shape hash
width bucket
font scale bucket
density bucket
materialization tier
reference resolution state
media resolution state
nested repost state
action or reaction summary state
geometry schema generation
```

The row state also carries semantic and visual row keys so a mounted row can
match its own observations, but those keys are not a license to include owner
state. The persisted key must not include tab id, pane id, owner handle, current
scroll offset, request id, relay socket id, wall-clock render timing, or active
subscription identity.


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
media resolution state bucket
nested repost state bucket
action or reaction summary state bucket
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
