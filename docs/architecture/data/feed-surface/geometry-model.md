# Feed Geometry Model

## Purpose

This contract defines durable row-height estimates, measurements, and anchor
compensation for feed surfaces.

## Status

Status: partially implemented. Rust owns feature extraction, estimation,
fragment planning, anchor reducers, and the WASM bridge. The shipped Svelte feed
warms the bridge and uses explicitly temporary TypeScript fallback logic while
Leptos feed parity and SQLite observation persistence remain incomplete.

## Geometry Key

A geometry key identifies reusable measurements for one visual row shape:

```text
surface-row-kind
event kind when present
event id or stable non-event row id
content-shape hash
fragment kind
fragment index
width bucket
font-scale bucket
geometry schema hash
```

The key must not include tab id, pane id, request id, owner handle, relay socket
id, current scroll offset, or timing data.

## Content-Shape Hash

The content-shape hash is deterministic and derived from features that affect
height without storing full content:

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
```

The hash changes when the semantic layout shape changes. It does not replace the
event id and does not store event text in SQLite.

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

Crossing a bucket invalidates the active estimate for that row until a matching
observation exists. Rows may shrink after widening; stale narrow measurements
must not become permanent minimum heights.

## Estimate Confidence

Every estimate carries confidence:

| Confidence | Meaning |
| --- | --- |
| `fallback` | No matching observation; content-aware formula only. |
| `session` | Current browser session has matching measured rows. |
| `durable` | SQLite has matching observations for this geometry key. |
| `degraded` | Anchor fallback or stale observation was used. |

Product UI may show aggregate diagnostics, but it must not expose unbounded
per-event labels.

## Measurement Sources

Session measurements are bounded in memory by least-recent observation and by a
maximum count per surface family. Durable measurements are stored in worker-owned
SQLite through typed repositories.

SQLite geometry rows store only:

```text
geometry key
width bucket
font-scale bucket
estimated height
measured height
confidence
sample count
last observed time
schema hash
```

They do not store full event content, tab ownership, pane ownership, or relay
connection handles.

## Anchor Compensation

When a measured row changes height, the scroll owner applies this delta:

```text
scroll_delta = sum(new_height - old_height for changed rows above anchor)
```

If the anchor row itself changes while partially visible, preserve the offset
inside that row:

```text
new_scroll_top = new_anchor_top + anchor_offset_inside_row - viewport_relative_top
```

If the anchor row disappears because filters or retention changed, choose the
nearest surviving row and mark confidence `degraded`.

## Split-Pane Resize Behavior

- Inline resize recomputes width buckets for visible and near-visible rows.
- The virtualizer receives estimates for the new bucket before enrichment.
- Measurements from the old bucket remain stored but inactive.
- Widening after a narrow measurement can reduce estimated height.
- Shrinking to a narrow bucket can increase estimates before measurement.

## Stale Observation Deletion

Delete or ignore geometry observations when:

- the schema hash changes.
- the content-shape hash for a key changes.
- the row family is no longer produced by the planner.
- the sample is older than the retention horizon and has low confidence.
- retention pressure selects geometry rows after protected product records.

## Verification

- Very long text receives a large initial estimate.
- Many line breaks and long unbroken tokens affect the estimate.
- Late profile, reference, and media hydration above the viewport preserve the
  visible anchor.
- Live inserts above a non-top anchor do not yank the viewport.
- Width bucket changes recompute and can shrink rows.
- Stats reports bounded geometry counts and stale-drop counts.
