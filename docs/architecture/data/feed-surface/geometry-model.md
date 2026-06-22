# Feed Geometry Model

## Purpose

This contract defines row geometry keys, reservations, invalidation, retention,
and persistence for feed-like scroll surfaces.

## Status

Status: partially implemented. Rust owns feature extraction, estimation,
content-shape hashing, reserved-height decisions, anchor reducers, and WASM
bridge calls. Svelte is host glue for observers, measurements, and style
application. Session caches may hold returned row states, but SQLite observation
persistence remains an active target until typed worker repositories store the
bounded model rows.

## Detail Map

- [geometry-model-keys.md](geometry-model-keys.md): terms, keys, content shape hashes, and buckets.
- [geometry-model-persistence.md](geometry-model-persistence.md): SQLite rows, invalidation, retention, anchor compensation, and verification.

## Reserved Height Decision

The reducer receives previous state and an action, then returns the next active
reservation and diagnostics.

Actions:

```text
row_measured
row_became_visible
row_became_near_visible
row_became_far_or_structural
row_unloaded
row_rematerialized
width_bucket_changed
font_bucket_changed
density_bucket_changed
content_shape_changed
reference_state_changed
media_state_changed
nested_repost_state_changed
action_summary_state_changed
schema_generation_changed
measurement_expired
```

Rules:

- `row_unloaded` keeps the previous reserved height.
- `row_rematerialized` keeps the reservation until measurement in the current
  layout bucket.
- `row_measured` may increase or decrease only when materialized in the current
  layout bucket.
- Width, font, density, content shape, enrichment state, and schema-generation
  changes choose a matching observation or estimate; they may shrink after
  recomputation.
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
