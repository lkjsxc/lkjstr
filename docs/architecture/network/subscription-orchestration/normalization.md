# Demand Normalization

## Purpose

Normalization makes equivalent Demands produce identical lease fingerprints so
overlapping panes can share relay work.

## Filter Canonicalization

Before hashing:

1. Sanitize filters through `relaySafeFilters`.
2. Sort `authors` and `kinds` arrays lexicographically and dedupe.
3. Sort tag arrays (`#e`, `#p`, `#t`, etc.) lexicographically per tag name.
4. Drop empty tag arrays and redundant fields.
5. Normalize relay URLs through the shared relay URL normalizer, sort, dedupe.

## Relay List Canonicalization

- Input relay lists become sorted unique normalized URLs.
- Order in the user interface does not affect the fingerprint.

## Phase and Purpose

- `phase` and `purpose` are part of the fingerprint.
- Bootstrap and live Demands with otherwise identical filters never merge.

## Cursor Windows

- For `page` phase, include normalized `since`, `until`, and `limit` in the
  fingerprint when present.
- For `live` phase, round `since` to the anchored second used by the planner
  (newest accepted event time, not wall clock).

## Fingerprint

The lease fingerprint is a stable JSON string of:

```json
{
  "relays": ["wss://..."],
  "filters": [{ "...": "canonical" }],
  "phase": "live",
  "purpose": "feed"
}
```

Hash with the project stable hash helper for compact keys. The hash must be
deterministic across runs and environments.

## Excluded Fields

Never include in the fingerprint:

- `owner`
- `tabId` or pane id
- `visibility`
- `priority` (planner uses priority only for scheduling, not merge)
- Diagnostic labels or UI-only metadata

## Wire Request Key

The subscription manager may still use a compact wire id derived from the
fingerprint. Logical listener keys restore the fingerprint for event routing.
