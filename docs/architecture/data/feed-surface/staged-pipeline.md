# Feed Surface Staged Pipeline

## Purpose

Older-page latency is reduced by rendering real event rows before profile,
reference, and media enrichment finishes.

## Stages

1. **Relay or cache page**: acquire real events; persist through the repository.
2. **Geometry estimate**: build stable row features and reserve predicted height.
3. **Event rows**: merge real relay or cache rows into the feed window and
   render from event bodies immediately.
4. **Enrichment**: hydrate profiles, reference previews, media metadata, and
   action chrome for visible and near-visible rows first.
5. **Measurement**: persist measured heights and compensate anchors when rows
   above the viewport change height.

Stage 4 must not block stage 3. Stage 5 must not fabricate content or
suppress real rows.

## Rollout

| Surface | Staged pipeline |
| ------- | ---------------- |
| Home, Global | Required |
| Profile notes, Thread | Required |
| Notifications | Target events and notification chrome |
| Search, Custom Request | Cache-first page and async enrichment |

## Verification

- Unit: profile and feed paging tests cover direct event-window merges.
- focused tests: older-page rows appear before profile names on synthetic relay
- Scroll: enrichment above the viewport preserves the current visible anchor
